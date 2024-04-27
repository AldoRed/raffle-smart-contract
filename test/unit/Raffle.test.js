const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let raffle,
              vrfCoordinatorV2Mock,
              chai,
              assert,
              expect,
              raffleEntranceFee,
              deployer,
              interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              chai = await import("chai")
              assert = chai.assert
              expect = chai.expect
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])

              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer,
              )
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("initializes constructor correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  const entraceFee = await raffle.getEntranceFee()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId].interval,
                  )
                  assert.equal(
                      entraceFee.toString(),
                      networkConfig[chainId].entranceFee,
                  )
              })
          })

          describe("enterRaffle", function () {
              it("revert when you don't pay enough ETH", async function () {
                  await expect(raffle.enterRaffle()).to.be.rejectedWith(
                      "Raffle__NotEnoughETHEntered",
                  )
              })
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emits event on enter", async function () {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.emit(raffle, "RaffleEnter")
              })
              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.rejectedWith("Raffle__StateNotOpen")
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } =
                      await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
              })
              it("returns false if state is not open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } =
                      await raffle.checkUpkeep.staticCall("0x")
                  assert.equal(raffleState.toString(), "1")
                  assert(!upkeepNeeded)
              })
              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) - 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } =
                      await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, and state is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } =
                      await raffle.checkUpkeep.staticCall("0x")
                  assert(upkeepNeeded)
              })
          })
          describe("performUpkeep", function () {
              it("revert if upKeepNeeded is false", async function () {
                  const { upkeepNeeded } =
                      await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
                  await expect(raffle.performUpkeep("0x")).to.be.rejectedWith(
                      "Raffle__UpKeepNotNeeded",
                  )
              })
              it("it can only run if upKeepNeeded is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("updates the raffle state, emits an event and calls the vrf Coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.logs[1].args[0]
                  const raffleState = await raffle.getRaffleState()
                  assert(Number(requestId) > 0)
                  assert.equal(raffleState, "1")
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpKeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
                  ).to.be.rejectedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
                  ).to.be.rejectedWith("nonexistent request")
              })
              it("picks a winner, resets the lottery, and sends money", async function () {
                  const aditionalsEntrants = 3
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i <= aditionalsEntrants; i++) {
                      const account = raffle.connect(accounts[i])
                      await account.enterRaffle({ value: raffleEntranceFee })
                  }
                  const startingTimeStamp = await raffle.getLatestTimestamp()

                  // PerformUpKeep (mock being Chainlink Keepers)
                  // fulfillRandomWords (mock being Chainlink VRF)
                  // We will have to wait for the fulfillRandomWords to be called
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          //   console.log("Found the event WinnerPicked!")
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner()
                              //   console.log(recentWinner)
                              //   console.log(accounts[0].address)
                              //   console.log(accounts[1].address)
                              //   console.log(accounts[2].address)
                              //   console.log(accounts[3].address)
                              const raffleState = await raffle.getRaffleState()
                              const numPlayers =
                                  await raffle.getNumberOfPlayers()
                              const endingTimeStamp =
                                  await raffle.getLatestTimestamp()
                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(
                                      accounts[1].address,
                                  )

                              assert.equal(numPlayers.toString(), 0)
                              assert.equal(raffleState.toString(), "0")
                              expect(Number(endingTimeStamp)).to.be.greaterThan(
                                  Number(startingTimeStamp),
                              )
                              assert.equal(
                                  Number(winnerEndingBalance).toString(),
                                  (
                                      Number(winnerStartingBalance) +
                                      Number(raffleEntranceFee) *
                                          Number(aditionalsEntrants) +
                                      Number(raffleEntranceFee)
                                  ).toString(),
                              )
                          } catch (error) {
                              reject(error)
                          }
                          resolve()
                      })
                      // Setting up the listener
                      // Below, we will fire the event, the listener will pick it up, and resolve it
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance =
                          await ethers.provider.getBalance(accounts[1].address)
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.logs[1].args[0],
                          raffle.target,
                      )
                  })
              })
          })
      })
