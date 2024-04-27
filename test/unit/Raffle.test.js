const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let raffle, vrfCoordinatorV2Mock, chai, assert, expect
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
          })

          describe("constructor", async function () {
              it("Initializes constructor correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  const interval = await raffle.getInterval()
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

          describe("enterRaffle", async function () {
              it("Revert when you don't pay enough ETH", async function () {
                  //   await expect(raffle.enterRaffle()).to.throw(
                  //       "Raffle__NotEnoughETHEntered",
                  //   )
                  await expect(raffle.enterRaffle()).to.be.reverted
              })
          })
      })
