const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContracts, increaseTime } = require("./helpers");

describe("Integration", function () {
    let stablecoin, nft, marketplace, auction, faucet;
    let owner, seller, buyer, bidder2;  // 添加 bidder2

    beforeEach(async function () {
        const contracts = await deployContracts();
        stablecoin = contracts.stablecoin;
        nft = contracts.nft;
        marketplace = contracts.marketplace;
        auction = contracts.auction;
        faucet = contracts.faucet;
        owner = contracts.owner;
        seller = contracts.user1;
        buyer = contracts.user2;
        bidder2 = contracts.user3;  // 保存 user3 作为 bidder2
    });

    describe("Full Marketplace Flow", function () {
        it("Should complete full marketplace transaction", async function () {
            // 1. Seller 铸造 NFT
            await nft.safeMint(seller.address, "ipfs://test/1.json");
            expect(await nft.ownerOf(0)).to.equal(seller.address);

            // 2. Buyer 从水龙头获取 CHKD
            await faucet.connect(buyer).claim();
            expect(await stablecoin.balanceOf(buyer.address)).to.equal(ethers.parseEther("1000"));

            // 3. Seller 上架 NFT
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("500"));
            expect(await nft.ownerOf(0)).to.equal(await marketplace.getAddress());

            // 4. Buyer 购买 NFT
            await stablecoin.connect(buyer).approve(await marketplace.getAddress(), ethers.parseEther("500"));
            await marketplace.connect(buyer).buyNFT(await nft.getAddress(), 0);

            // 5. 验证结果
            expect(await nft.ownerOf(0)).to.equal(buyer.address);
            expect(await stablecoin.balanceOf(seller.address)).to.equal(ethers.parseEther("500"));
            expect(await stablecoin.balanceOf(buyer.address)).to.equal(ethers.parseEther("500"));
        });
    });

    describe("Full Auction Flow", function () {
        it("Should complete full auction with bidding", async function () {
            const bidder1 = buyer;
            // 使用保存的 bidder2 而不是 contracts.user3

            // 1. 准备
            await nft.safeMint(seller.address, "ipfs://test/1.json");
            await stablecoin.mint(bidder1.address, ethers.parseEther("1000"));
            await stablecoin.mint(bidder2.address, ethers.parseEther("1000"));

            // 2. 创建拍卖
            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600
            );

            // 3. bidder1 出价
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            // 4. bidder2 出更高价
            await stablecoin.connect(bidder2).approve(await auction.getAddress(), ethers.parseEther("200"));
            await auction.connect(bidder2).bid(0, ethers.parseEther("200"));

            // bidder1 应该被退款
            expect(await stablecoin.balanceOf(bidder1.address)).to.equal(ethers.parseEther("1000"));

            // 5. 结算
            await auction.connect(seller).settle(0);

            // 6. 验证结果
            expect(await nft.ownerOf(0)).to.equal(bidder2.address);
            expect(await stablecoin.balanceOf(seller.address)).to.equal(ethers.parseEther("200"));
        });

        it("Should return NFT on auction with no bids", async function () {
            await nft.safeMint(seller.address, "ipfs://test/1.json");

            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600
            );

            await auction.connect(seller).settle(0);

            expect(await nft.ownerOf(0)).to.equal(seller.address);
        });
    });

    describe("ETH to CHKD Flow", function () {
        it("Should buy and burn CHKD", async function () {
            // 1. 用 ETH 购买 CHKD
            await stablecoin.connect(buyer).buyWithETH({ value: ethers.parseEther("1") });
            expect(await stablecoin.balanceOf(buyer.address)).to.equal(ethers.parseEther("15600"));

            // 2. 销毁 CHKD 换回 ETH
            const balanceBefore = await ethers.provider.getBalance(buyer.address);
            await stablecoin.connect(buyer).burnForETH(ethers.parseEther("15600"));
            const balanceAfter = await ethers.provider.getBalance(buyer.address);

            expect(await stablecoin.balanceOf(buyer.address)).to.equal(0);
            expect(balanceAfter).to.be.gt(balanceBefore);
        });
    });
});