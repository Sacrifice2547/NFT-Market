const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContracts, increaseTime } = require("./helpers");

describe("Auction", function () {
    let stablecoin, nft, auction;
    let owner, seller, bidder1, bidder2;

    beforeEach(async function () {
        const contracts = await deployContracts();
        stablecoin = contracts.stablecoin;
        nft = contracts.nft;
        auction = contracts.auction;
        owner = contracts.owner;
        seller = contracts.user1;
        bidder1 = contracts.user2;
        bidder2 = contracts.user3;

        // 给 seller 铸造 NFT
        await nft.safeMint(seller.address, "ipfs://test/1.json");

        // 给 bidders 一些 CHKD
        await stablecoin.mint(bidder1.address, ethers.parseEther("10000"));
        await stablecoin.mint(bidder2.address, ethers.parseEther("10000"));
    });

    describe("Start Auction", function () {
        it("Should start auction successfully", async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600  // 1 hour
            );

            expect(await auction.isActive(0)).to.be.true;
            expect(await nft.ownerOf(0)).to.equal(await auction.getAddress());
        });

        it("Should emit AuctionStarted event", async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);

            await expect(
                auction.connect(seller).startAuction(
                    await nft.getAddress(),
                    0,
                    ethers.parseEther("100"),
                    3600
                )
            ).to.emit(auction, "AuctionStarted");
        });

        it("Should store correct auction info", async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600
            );

            const info = await auction.getAuction(0);
            expect(info.seller).to.equal(seller.address);
            expect(info.startPrice).to.equal(ethers.parseEther("100"));
            expect(info.highestBid).to.equal(0);
        });

        it("Should fail with invalid parameters", async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);

            await expect(
                auction.connect(seller).startAuction(await nft.getAddress(), 0, 0, 3600)
            ).to.be.revertedWith("Start price must > 0");

            await expect(
                auction.connect(seller).startAuction(await nft.getAddress(), 0, ethers.parseEther("100"), 0)
            ).to.be.revertedWith("Duration must > 0");
        });
    });

    describe("Bidding", function () {
        beforeEach(async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600
            );
        });

        it("Should place bid successfully", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            const info = await auction.getAuction(0);
            expect(info.highestBid).to.equal(ethers.parseEther("150"));
            expect(info.highestBidder).to.equal(bidder1.address);
        });

        it("Should emit BidPlaced event", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));

            await expect(
                auction.connect(bidder1).bid(0, ethers.parseEther("150"))
            ).to.emit(auction, "BidPlaced")
                .withArgs(bidder1.address, 0, ethers.parseEther("150"));
        });

        it("Should refund previous bidder", async function () {
            // bidder1 出价
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            const balanceBefore = await stablecoin.balanceOf(bidder1.address);

            // bidder2 出更高价
            await stablecoin.connect(bidder2).approve(await auction.getAddress(), ethers.parseEther("200"));
            await auction.connect(bidder2).bid(0, ethers.parseEther("200"));

            // bidder1 应该被退款
            const balanceAfter = await stablecoin.balanceOf(bidder1.address);
            expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("150"));
        });

        it("Should fail with bid below start price", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("50"));

            await expect(
                auction.connect(bidder1).bid(0, ethers.parseEther("50"))
            ).to.be.revertedWith("Below start price");
        });

        it("Should fail with bid not high enough", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            await stablecoin.connect(bidder2).approve(await auction.getAddress(), ethers.parseEther("150"));

            await expect(
                auction.connect(bidder2).bid(0, ethers.parseEther("150"))
            ).to.be.revertedWith("Bid not high enough");
        });

        it("Should fail after auction ended", async function () {
            await increaseTime(3601);

            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));

            await expect(
                auction.connect(bidder1).bid(0, ethers.parseEther("150"))
            ).to.be.revertedWith("Auction ended");
        });
    });

    describe("Settle", function () {
        beforeEach(async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600
            );
        });

        it("Should settle with winner", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            const sellerBalanceBefore = await stablecoin.balanceOf(seller.address);

            await auction.connect(seller).settle(0);

            // NFT 转给 bidder1
            expect(await nft.ownerOf(0)).to.equal(bidder1.address);

            // CHKD 转给 seller
            const sellerBalanceAfter = await stablecoin.balanceOf(seller.address);
            expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + ethers.parseEther("150"));

            // 拍卖结束
            expect(await auction.isActive(0)).to.be.false;
        });

        it("Should settle without winner (return NFT)", async function () {
            await auction.connect(seller).settle(0);

            // NFT 退还给 seller
            expect(await nft.ownerOf(0)).to.equal(seller.address);
            expect(await auction.isActive(0)).to.be.false;
        });

        it("Should emit AuctionSettled event", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            await expect(
                auction.connect(seller).settle(0)
            ).to.emit(auction, "AuctionSettled")
                .withArgs(seller.address, bidder1.address, 0, ethers.parseEther("150"));
        });

        it("Should fail if not seller", async function () {
            await expect(
                auction.connect(bidder1).settle(0)
            ).to.be.revertedWith("Not seller");
        });
    });

    describe("Cancel Auction", function () {
        beforeEach(async function () {
            await nft.connect(seller).approve(await auction.getAddress(), 0);
            await auction.connect(seller).startAuction(
                await nft.getAddress(),
                0,
                ethers.parseEther("100"),
                3600
            );
        });

        it("Should cancel auction with no bids", async function () {
            await auction.connect(seller).cancelAuction(0);

            expect(await nft.ownerOf(0)).to.equal(seller.address);
            expect(await auction.isActive(0)).to.be.false;
        });

        it("Should emit AuctionCancelled event", async function () {
            await expect(
                auction.connect(seller).cancelAuction(0)
            ).to.emit(auction, "AuctionCancelled")
                .withArgs(seller.address, 0);
        });

        it("Should fail with bids", async function () {
            await stablecoin.connect(bidder1).approve(await auction.getAddress(), ethers.parseEther("150"));
            await auction.connect(bidder1).bid(0, ethers.parseEther("150"));

            await expect(
                auction.connect(seller).cancelAuction(0)
            ).to.be.revertedWith("Has bids");
        });

        it("Should fail if not seller", async function () {
            await expect(
                auction.connect(bidder1).cancelAuction(0)
            ).to.be.revertedWith("Not seller");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await nft.safeMint(seller.address, "ipfs://test/2.json");
            await nft.connect(seller).setApprovalForAll(await auction.getAddress(), true);

            await auction.connect(seller).startAuction(await nft.getAddress(), 0, ethers.parseEther("100"), 3600);
            await auction.connect(seller).startAuction(await nft.getAddress(), 1, ethers.parseEther("200"), 7200);
        });

        it("Should return all auctions", async function () {
            const auctions = await auction.getAllAuctions();
            expect(auctions.length).to.equal(2);
        });

        it("Should return auction by token ID", async function () {
            const info = await auction.getAuction(0);
            expect(info.startPrice).to.equal(ethers.parseEther("100"));
        });

        it("Should check if active", async function () {
            expect(await auction.isActive(0)).to.be.true;
            expect(await auction.isActive(999)).to.be.false;
        });
    });
});