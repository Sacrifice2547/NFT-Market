const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContracts, increaseTime } = require("./helpers");

describe("Faucet", function () {
    let stablecoin, faucet;
    let owner, user1, user2;

    beforeEach(async function () {
        const contracts = await deployContracts();
        stablecoin = contracts.stablecoin;
        faucet = contracts.faucet;
        owner = contracts.owner;
        user1 = contracts.user1;
        user2 = contracts.user2;
    });

    describe("Claim", function () {
        it("Should claim tokens successfully", async function () {
            await faucet.connect(user1).claim();

            const balance = await stablecoin.balanceOf(user1.address);
            expect(balance).to.equal(ethers.parseEther("1000"));
        });

        it("Should emit TokensClaimed event", async function () {
            await expect(faucet.connect(user1).claim())
                .to.emit(faucet, "TokensClaimed")
                .withArgs(user1.address, ethers.parseEther("1000"));
        });

        it("Should respect cooldown", async function () {
            await faucet.connect(user1).claim();

            await expect(
                faucet.connect(user1).claim()
            ).to.be.revertedWith("Cooldown");
        });

        it("Should allow claim after cooldown", async function () {
            await faucet.connect(user1).claim();

            await increaseTime(61);

            await faucet.connect(user1).claim();

            const balance = await stablecoin.balanceOf(user1.address);
            expect(balance).to.equal(ethers.parseEther("2000"));
        });
    });

    describe("Cooldown", function () {
        it("Should return remaining cooldown", async function () {
            await faucet.connect(user1).claim();

            const remaining = await faucet.getRemainingCooldown(user1.address);
            expect(remaining).to.be.closeTo(60n, 2n);
        });

        it("Should return 0 when no cooldown", async function () {
            const remaining = await faucet.getRemainingCooldown(user1.address);
            expect(remaining).to.equal(0);
        });
    });

    describe("Admin", function () {
        it("Should update amount per claim", async function () {
            await faucet.setAmountPerClaim(ethers.parseEther("2000"));
            await faucet.connect(user1).claim();

            expect(await stablecoin.balanceOf(user1.address)).to.equal(ethers.parseEther("2000"));
        });

        it("Should update cooldown time", async function () {
            await faucet.setCooldownTime(120);

            await faucet.connect(user1).claim();
            await increaseTime(61);

            await expect(
                faucet.connect(user1).claim()
            ).to.be.revertedWith("Cooldown");

            await increaseTime(60);
            await faucet.connect(user1).claim();
        });
    });
});