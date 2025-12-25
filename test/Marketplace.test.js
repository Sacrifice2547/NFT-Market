const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContracts } = require("./helpers");

describe("Marketplace", function () {
    let stablecoin, nft, marketplace;
    let owner, seller, buyer;

    beforeEach(async function () {
        const contracts = await deployContracts();
        stablecoin = contracts.stablecoin;
        nft = contracts.nft;
        marketplace = contracts.marketplace;
        owner = contracts.owner;
        seller = contracts.user1;
        buyer = contracts.user2;

        // 给 seller 铸造 NFT
        await nft.safeMint(seller.address, "ipfs://test/1.json");

        // 给 buyer 一些 CHKD
        await stablecoin.mint(buyer.address, ethers.parseEther("10000"));
    });

    describe("List NFT", function () {
        it("Should list NFT successfully", async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"));

            expect(await marketplace.isListed(await nft.getAddress(), 0)).to.be.true;
            expect(await nft.ownerOf(0)).to.equal(await marketplace.getAddress());
        });

        it("Should emit NFTListed event", async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);

            await expect(
                marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"))
            ).to.emit(marketplace, "NFTListed")
                .withArgs(seller.address, await nft.getAddress(), 0, ethers.parseEther("100"));
        });

        it("Should store correct listing info", async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"));

            const listing = await marketplace.getListing(await nft.getAddress(), 0);
            expect(listing.seller).to.equal(seller.address);
            expect(listing.price).to.equal(ethers.parseEther("100"));
        });

        it("Should fail with price 0", async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);

            await expect(
                marketplace.connect(seller).listNFT(await nft.getAddress(), 0, 0)
            ).to.be.revertedWith("Price must > 0");
        });

        it("Should fail if not owner", async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);

            await expect(
                marketplace.connect(buyer).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"))
            ).to.be.revertedWith("Not owner");
        });

        it("Should fail if already listed", async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"));

            await expect(
                marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("200"))
            ).to.be.revertedWith("Already listed");
        });
    });

    describe("Buy NFT", function () {
        beforeEach(async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"));
        });

        it("Should buy NFT successfully", async function () {
            await stablecoin.connect(buyer).approve(await marketplace.getAddress(), ethers.parseEther("100"));
            await marketplace.connect(buyer).buyNFT(await nft.getAddress(), 0);

            expect(await nft.ownerOf(0)).to.equal(buyer.address);
            expect(await stablecoin.balanceOf(seller.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should emit NFTSold event", async function () {
            await stablecoin.connect(buyer).approve(await marketplace.getAddress(), ethers.parseEther("100"));

            await expect(
                marketplace.connect(buyer).buyNFT(await nft.getAddress(), 0)
            ).to.emit(marketplace, "NFTSold")
                .withArgs(seller.address, buyer.address, await nft.getAddress(), 0, ethers.parseEther("100"));
        });

        it("Should remove listing after purchase", async function () {
            await stablecoin.connect(buyer).approve(await marketplace.getAddress(), ethers.parseEther("100"));
            await marketplace.connect(buyer).buyNFT(await nft.getAddress(), 0);

            expect(await marketplace.isListed(await nft.getAddress(), 0)).to.be.false;
        });

        it("Should fail if not listed", async function () {
            await expect(
                marketplace.connect(buyer).buyNFT(await nft.getAddress(), 999)
            ).to.be.revertedWith("Not listed");
        });

        it("Should fail if buyer is seller", async function () {
            await stablecoin.mint(seller.address, ethers.parseEther("100"));
            await stablecoin.connect(seller).approve(await marketplace.getAddress(), ethers.parseEther("100"));

            await expect(
                marketplace.connect(seller).buyNFT(await nft.getAddress(), 0)
            ).to.be.revertedWith("Cannot buy own");
        });
    });

    describe("Cancel Listing", function () {
        beforeEach(async function () {
            await nft.connect(seller).approve(await marketplace.getAddress(), 0);
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"));
        });

        it("Should cancel listing successfully", async function () {
            await marketplace.connect(seller).cancelListing(await nft.getAddress(), 0);

            expect(await nft.ownerOf(0)).to.equal(seller.address);
            expect(await marketplace.isListed(await nft.getAddress(), 0)).to.be.false;
        });

        it("Should emit ListingCancelled event", async function () {
            await expect(
                marketplace.connect(seller).cancelListing(await nft.getAddress(), 0)
            ).to.emit(marketplace, "ListingCancelled")
                .withArgs(seller.address, await nft.getAddress(), 0);
        });

        it("Should fail if not seller", async function () {
            await expect(
                marketplace.connect(buyer).cancelListing(await nft.getAddress(), 0)
            ).to.be.revertedWith("Not seller");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            // 铸造更多 NFT 并上架
            await nft.safeMint(seller.address, "ipfs://test/2.json");
            await nft.safeMint(seller.address, "ipfs://test/3.json");

            await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

            await marketplace.connect(seller).listNFT(await nft.getAddress(), 0, ethers.parseEther("100"));
            await marketplace.connect(seller).listNFT(await nft.getAddress(), 1, ethers.parseEther("200"));
        });

        it("Should return all listings", async function () {
            const listings = await marketplace.getAllListings();
            expect(listings.length).to.equal(2);
        });

        it("Should return correct listing by NFT", async function () {
            const listing = await marketplace.getListing(await nft.getAddress(), 0);
            expect(listing.price).to.equal(ethers.parseEther("100"));
        });
    });
});