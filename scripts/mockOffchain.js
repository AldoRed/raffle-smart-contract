const { ethers, network } = require("hardhat")
const { ethers: ethers2 } = require("ethers")

async function mockKeepers() {
    const raffle = await ethers.getContract("Raffle")
    // const checkData = ethers2.keccak256(ethers2.toUtf8Bytes(""))
    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
    const numPlayers = await raffle.getNumberOfPlayers()
    console.log(`Number of players: ${numPlayers}`)
    console.log(`Upkeep needed: ${upkeepNeeded}`)
    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep("0x")
        const txReceipt = await tx.wait(1)
        const requestId = txReceipt.logs[1].args[0]
        console.log(`Performed upkeep with RequestId: ${requestId}`)
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, raffle)
        }
    } else {
        console.log("No upkeep needed!")
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok let's pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target)
    console.log("Responded!")
    const recentWinner = await raffle.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
