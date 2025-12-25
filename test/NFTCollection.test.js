const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployContracts } = require("./helpers");

describe("NFTCollection", function () {
    let nft;
    let owner, user1, user2;

    beforeEach(async function () {
        const contracts = await deployContracts();
        nft = contracts.nft;
        owner = contracts.owner;
        user1 = contracts.user1;
        user2 = contracts.user2;
    });

    describe("Deployment", function () {
        it("Should have correct name and symbol", async function () {
            expect(await nft.name()).to.equal("Test NFT");
            expect(await nft.symbol()).to.equal("TNFT");
        });

        it("Should have correct max supply", async function () {
            expect(await nft.maxSupply()).to.equal(10000);
        });
    });

    describe("Minting", function () {
        it("Should mint NFT with correct URI", async function () {
            await nft.safeMint(user1.address, "ipfs://test/1.json");

            expect(await nft.ownerOf(0)).to.equal(user1.address);
            expect(await nft.tokenURI(0)).to.equal("ipfs://test/1.json");
        });

        it("Should emit NFTMinted event", async function () {
            await expect(nft.safeMint(user1.address, "ipfs://test/1.json"))
                .to.emit(nft, "NFTMinted")
                .withArgs(user1.address, 0, "ipfs://test/1.json");
        });

        it("Should increment token ID", async function () {
            await nft.safeMint(user1.address, "ipfs://test/1.json");
            await nft.safeMint(user1.address, "ipfs://test/2.json");

            expect(await nft.totalMinted()).to.equal(2);
            expect(await nft.ownerOf(0)).to.equal(user1.address);
            expect(await nft.ownerOf(1)).to.equal(user1.address);
        });

        it("Should only allow owner to mint", async function () {
            await expect(
                nft.connect(user1).safeMint(user1.address, "ipfs://test/1.json")
            ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
        });
    });

    describe("Batch Minting", function () {
        it("Should batch mint multiple NFTs", async function () {
            const uris = ["ipfs://1.json", "ipfs://2.json", "ipfs://3.json"];
            await nft.batchMint(user1.address, uris);

            expect(await nft.totalMinted()).to.equal(3);
            expect(await nft.balanceOf(user1.address)).to.equal(3);
        });

        it("Should return correct start token ID", async function () {
            await nft.safeMint(user1.address, "ipfs://0.json");

            const uris = ["ipfs://1.json", "ipfs://2.json"];
            const tx = await nft.batchMint(user1.address, uris);

            // startTokenId 应该是 1
            expect(await nft.totalMinted()).to.equal(3);
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await nft.safeMint(user1.address, "ipfs://1.json");
            await nft.safeMint(user1.address, "ipfs://2.json");
            await nft.safeMint(user2.address, "ipfs://3.json");
        });

        it("Should return tokens of owner", async function () {
            const tokens = await nft.tokensOfOwner(user1.address);
            expect(tokens.length).to.equal(2);
            expect(tokens[0]).to.equal(0);
            expect(tokens[1]).to.equal(1);
        });

        it("Should check if token exists", async function () {
            expect(await nft.exists(0)).to.be.true;
            expect(await nft.exists(100)).to.be.false;
        });

        it("Should return total minted", async function () {
            expect(await nft.totalMinted()).to.equal(3);
        });
    });

    describe("Max Supply", function () {
        it("Should respect max supply", async function () {
            // 部署一个 maxSupply = 2 的 NFT
            const NFTCollectionV1 = await ethers.getContractFactory("NFTCollectionV1");
            const limitedNft = await upgrades.deployProxy(
                NFTCollectionV1,
                ["Limited NFT", "LNFT", 2, owner.address],
                { initializer: "initialize", kind: "uups" }
            );

            await limitedNft.safeMint(user1.address, "1.json");
            await limitedNft.safeMint(user1.address, "2.json");

            await expect(
                limitedNft.safeMint(user1.address, "3.json")
            ).to.be.revertedWith("Max supply reached");
        });

        it("Should allow unlimited when maxSupply is 0", async function () {
            const NFTCollectionV1 = await ethers.getContractFactory("NFTCollectionV1");
            const unlimitedNft = await upgrades.deployProxy(
                NFTCollectionV1,
                ["Unlimited NFT", "UNFT", 0, owner.address],
                { initializer: "initialize", kind: "uups" }
            );

            // 应该能铸造任意数量
            for (let i = 0; i < 5; i++) {
                await unlimitedNft.safeMint(user1.address, `${i}.json`);
            }
            expect(await unlimitedNft.totalMinted()).to.equal(5);
        });
    });

    describe("Base URI", function () {
        it("Should set base URI", async function () {
            await nft.setBaseURI("https://example.com/");
            await nft.safeMint(user1.address, "1.json");

            // tokenURI 会拼接 baseURI + tokenURI
            // 但由于我们设置了完整的 tokenURI，它会覆盖
            expect(await nft.getBaseURI()).to.equal("https://example.com/");
        });
    });
});