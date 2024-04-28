const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Test", function () {
          let raffle, raffleEntranceFee, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", function () {
              it("work with live Chainlink Keepers and Chainlink VRF, get a random winner", async function () {
                  // Enter in the Raffle
                  const startingTimeStamp = await raffle.getLatestTimestamp()
                  const accounts = await ethers.getSigners()

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await ethers.provider.getBalance(accounts[0].address)
                              const endingTimeStamp = await raffle.getLatestTimestamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner, accounts[0].address)
                              assert.equal(raffleState.toString(), "0")
                              //   assert.equal(
                              //       Number(winnerEndingBalance),
                              //       Number(winnerStartingBalance) +
                              //           Number(raffleEntranceFee) -
                              //           10103649821913220
                              //   ) check why it doesn't work
                              expect(Number(endingTimeStamp)).to.be.greaterThan(Number(startingTimeStamp))
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })

                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerStartingBalance = await ethers.provider.getBalance(accounts[0].address)
                  })
              })
          })
      })
