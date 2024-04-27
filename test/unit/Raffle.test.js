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
      })
