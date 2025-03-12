const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PancakeSwap Contract", function () {
    let PancakeSwap, pancakeSwap, owner, addr1;
    let MockRouter, mockRouter, MockToken, mockToken;
    let WBNB;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        MockToken = await ethers.getContractFactory("MockERC20");
        mockToken = await MockToken.deploy("Mock Token", "MOCK", ethers.parseEther("100000")); // ✅ FIXED
        await mockToken.waitForDeployment();

        MockRouter = await ethers.getContractFactory("MockPancakeRouter");
        mockRouter = await MockRouter.deploy();
        await mockRouter.waitForDeployment();

        WBNB = "0x0000000000000000000000000000000000000001";

        PancakeSwap = await ethers.getContractFactory("PancakeSwap");
        pancakeSwap = await PancakeSwap.deploy(await mockRouter.getAddress(), WBNB);
        await pancakeSwap.waitForDeployment();
    });

    it("Should deploy correctly", async function () {
        expect(await pancakeSwap.router()).to.equal(await mockRouter.getAddress());
        expect(await pancakeSwap.WBNB()).to.equal(WBNB);
    });

    it("Should emit TokensPurchased and LiquidityAdded events", async function () {
        const amountOut = ethers.parseEther("10");
        const addBNB = ethers.parseEther("1");
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now
        const amountTokenMin = ethers.parseEther("9");
        const amountETHMin = ethers.parseEther("0.9");
    
        const amountsIn = await mockRouter.getAmountsIn(amountOut, [WBNB, await mockToken.getAddress()]);
        console.log("Required BNB for Swap:", ethers.formatEther(amountsIn[0]));
    
        const totalBNBRequired = amountsIn[0] + addBNB + ethers.parseEther("0.5");
        console.log("Total BNB Sent:", ethers.formatEther(totalBNBRequired));
    
        const tx = await pancakeSwap.connect(addr1).buyAndAddLiquidity(
            await mockToken.getAddress(),
            amountOut,
            addBNB,
            addr1.address,
            deadline,
            amountTokenMin,
            amountETHMin,
            { value: totalBNBRequired }
        );
        const receipt = await tx.wait();
    
        let liquidityEvent;
        for (const log of receipt.logs) {
            try {
                const parsedLog = pancakeSwap.interface.parseLog(log);
                if (parsedLog.name === "LiquidityAdded") {
                    liquidityEvent = parsedLog;
                    break;
                }
            } catch (error) {
                // This log is not from our contract, ignore it.
            }
        }
        if (!liquidityEvent) {
            throw new Error("LiquidityAdded event not found");
        }
        console.log("Actual BNB Added:", liquidityEvent.args[3].toString());
    
        await expect(tx)
            .to.emit(pancakeSwap, "TokensPurchased")
            .withArgs(
                addr1.address,
                await mockToken.getAddress(),
                amountsIn[0],
                amountOut
            )
            .and.to.emit(pancakeSwap, "LiquidityAdded")
            .withArgs(
                addr1.address,
                await mockToken.getAddress(),
                amountOut,
                liquidityEvent.args[3]
            );
    });
    
    
});
