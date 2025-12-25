const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContracts } = require("./helpers");

describe("Stablecoin", function () {
    let chainlink, stablecoin, faucet;
    let owner, user1, user2;

    beforeEach(async function () {
        const contracts = await deployContracts();
        chainlink = contracts.chainlink;
        stablecoin = contracts.stablecoin;
        faucet = contracts.faucet;
        owner = contracts.owner;
        user1 = contracts.user1;
        user2 = contracts.user2;
    });

    describe("Deployment", function () {
        it("Should have correct name and symbol", async function () {
            expect(await stablecoin.name()).to.equal("cHKD Stablecoin");
            expect(await stablecoin.symbol()).to.equal("CHKD");
        });

        it("Should have correct chainlink address", async function () {
            expect(await stablecoin.chainlink()).to.equal(await chainlink.getAddress());
        });

        it("Should have correct owner", async function () {
            expect(await stablecoin.owner()).to.equal(owner.address);
        });
    });

    describe("Price", function () {
        it("Should return correct ETH price", async function () {
            // MockChainlink: 15600 * 10^8, 转换为 18位精度
            const price = await stablecoin.getETHPrice();
            expect(price).to.equal(ethers.parseEther("15600"));
        });

        it("Should update when chainlink price changes", async function () {
            await chainlink.setPrice(20000_00000000n);
            const price = await stablecoin.getETHPrice();
            expect(price).to.equal(ethers.parseEther("20000"));
        });
    });

    describe("Buy with ETH", function () {
        it("Should mint correct amount of CHKD", async function () {
            // 1 ETH = 15600 CHKD
            const ethAmount = ethers.parseEther("1");

            await stablecoin.connect(user1).buyWithETH({ value: ethAmount });

            const balance = await stablecoin.balanceOf(user1.address);
            expect(balance).to.equal(ethers.parseEther("15600"));
        });

        it("Should emit TokensPurchased event", async function () {
            const ethAmount = ethers.parseEther("1");

            await expect(stablecoin.connect(user1).buyWithETH({ value: ethAmount }))
                .to.emit(stablecoin, "TokensPurchased")
                .withArgs(user1.address, ethAmount, ethers.parseEther("15600"));
        });

        it("Should receive ETH in contract", async function () {
            const ethAmount = ethers.parseEther("1");

            await stablecoin.connect(user1).buyWithETH({ value: ethAmount });

            const balance = await ethers.provider.getBalance(await stablecoin.getAddress());
            expect(balance).to.equal(ethAmount);
        });

        it("Should fail with 0 ETH", async function () {
            await expect(
                stablecoin.connect(user1).buyWithETH({ value: 0 })
            ).to.be.revertedWith("Must send ETH");
        });
    });

    describe("Burn for ETH", function () {
        beforeEach(async function () {
            // user1 先购买一些 CHKD
            await stablecoin.connect(user1).buyWithETH({ value: ethers.parseEther("1") });
        });

        it("Should burn CHKD and return ETH", async function () {
            const tokenAmount = ethers.parseEther("15600");
            const balanceBefore = await ethers.provider.getBalance(user1.address);

            const tx = await stablecoin.connect(user1).burnForETH(tokenAmount);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(user1.address);
            const chkdBalance = await stablecoin.balanceOf(user1.address);

            expect(chkdBalance).to.equal(0);
            expect(balanceAfter).to.be.closeTo(
                balanceBefore + ethers.parseEther("1") - gasUsed,
                ethers.parseEther("0.001")
            );
        });

        it("Should emit TokensBurned event", async function () {
            const tokenAmount = ethers.parseEther("15600");

            await expect(stablecoin.connect(user1).burnForETH(tokenAmount))
                .to.emit(stablecoin, "TokensBurned")
                .withArgs(user1.address, tokenAmount, ethers.parseEther("1"));
        });

        it("Should fail with insufficient balance", async function () {
            await expect(
                stablecoin.connect(user2).burnForETH(ethers.parseEther("100"))
            ).to.be.revertedWith("Insufficient balance");
        });
    });

    describe("Mint", function () {
        it("Should allow owner to mint", async function () {
            await stablecoin.mint(user1.address, ethers.parseEther("1000"));
            expect(await stablecoin.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
        });

        it("Should allow faucet to mint", async function () {
            await faucet.connect(user1).claim();
            expect(await stablecoin.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
        });

        it("Should fail for unauthorized caller", async function () {
            await expect(
                stablecoin.connect(user1).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Not authorized");
        });
    });

    describe("Estimate", function () {
        it("Should estimate tokens from ETH correctly", async function () {
            const tokens = await stablecoin.estimateTokensFromETH(ethers.parseEther("2"));
            expect(tokens).to.equal(ethers.parseEther("31200"));
        });

        it("Should estimate ETH from tokens correctly", async function () {
            const eth = await stablecoin.estimateETHFromTokens(ethers.parseEther("15600"));
            expect(eth).to.equal(ethers.parseEther("1"));
        });
    });

    describe("Admin", function () {
        it("Should allow owner to withdraw ETH", async function () {
            await stablecoin.connect(user1).buyWithETH({ value: ethers.parseEther("1") });

            const balanceBefore = await ethers.provider.getBalance(owner.address);
            await stablecoin.withdrawETH(owner.address, ethers.parseEther("0.5"));
            const balanceAfter = await ethers.provider.getBalance(owner.address);

            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("Should allow owner to change chainlink", async function () {
            const newChainlink = await (await ethers.getContractFactory("MockChainlink")).deploy(20000_00000000n);
            await stablecoin.setChainlink(await newChainlink.getAddress());

            const price = await stablecoin.getETHPrice();
            expect(price).to.equal(ethers.parseEther("20000"));
        });
    });
});