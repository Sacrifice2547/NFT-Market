const { ethers, upgrades } = require("hardhat");

// 部署所有合约
async function deployContracts() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // 1. 部署 MockChainlink (1 ETH = 15600 HKD, 8位精度)
    const MockChainlink = await ethers.getContractFactory("MockChainlink");
    const chainlink = await MockChainlink.deploy(15600_00000000n);
    await chainlink.waitForDeployment();

    // 2. 部署 Stablecoin (CHKD)
    const StablecoinV1 = await ethers.getContractFactory("StablecoinV1");
    const stablecoin = await upgrades.deployProxy(
        StablecoinV1,
        [await chainlink.getAddress(), owner.address],
        { initializer: "initialize", kind: "uups" }
    );
    await stablecoin.waitForDeployment();

    // 3. 部署 NFTCollection
    const NFTCollectionV1 = await ethers.getContractFactory("NFTCollectionV1");
    const nft = await upgrades.deployProxy(
        NFTCollectionV1,
        ["Test NFT", "TNFT", 10000, owner.address],
        { initializer: "initialize", kind: "uups" }
    );
    await nft.waitForDeployment();

    // 4. 部署 Marketplace
    const MarketplaceV1 = await ethers.getContractFactory("MarketplaceV1");
    const marketplace = await upgrades.deployProxy(
        MarketplaceV1,
        [await stablecoin.getAddress(), owner.address],
        { initializer: "initialize", kind: "uups" }
    );
    await marketplace.waitForDeployment();

    // 5. 部署 Auction
    const AuctionV1 = await ethers.getContractFactory("AuctionV1");
    const auction = await upgrades.deployProxy(
        AuctionV1,
        [await stablecoin.getAddress(), owner.address],
        { initializer: "initialize", kind: "uups" }
    );
    await auction.waitForDeployment();

    // 6. 部署 Faucet
    const FaucetV1 = await ethers.getContractFactory("FaucetV1");
    const faucet = await upgrades.deployProxy(
        FaucetV1,
        [
            await stablecoin.getAddress(),
            ethers.parseEther("1000"),  // 每次领取1000 CHKD
            60,                          // 60秒冷却
            owner.address
        ],
        { initializer: "initialize", kind: "uups" }
    );
    await faucet.waitForDeployment();

    // 7. 设置 Faucet 地址到 Stablecoin
    await stablecoin.setFaucet(await faucet.getAddress());

    return {
        chainlink,
        stablecoin,
        nft,
        marketplace,
        auction,
        faucet,
        owner,
        user1,
        user2,
        user3
    };
}

// 时间操作
async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
}

async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

module.exports = {
    deployContracts,
    increaseTime,
    getBlockTimestamp
};