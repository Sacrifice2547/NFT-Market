const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Chainlink ETH/USD 地址
const CHAINLINK_ADDRESSES = {
    sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
};

// 部署配置
const CONFIG = {
    mockEthUsdPrice: 2500_00000000n,     // $2500 (8位精度)
    faucetAmount: ethers.parseEther("10000"),  // 每次领取 10000 CHKD
    faucetCooldown: 3600,                 // 1小时冷却
    nftName: "COMP5521 NFT",
    nftSymbol: "C5NFT",
    nftMaxSupply: 10000
};

async function main() {
    const [deployer] = await ethers.getSigners();
    const networkName = network.name;
    const chainId = (await ethers.provider.getNetwork()).chainId;

    console.log("=".repeat(60));
    console.log("Deploying contracts...");
    console.log("Network:", networkName);
    console.log("Chain ID:", chainId.toString());
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("=".repeat(60));

    // 存储部署地址
    const deployedAddresses = {
        network: networkName,
        chainId: chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {}
    };

    // ==================== 1. 部署 Chainlink (或使用真实地址) ====================

    let chainlinkAddress;

    if (networkName === "hardhat" || networkName === "localhost") {
        console.log("\n1. Deploying MockChainlink...");
        const MockChainlink = await ethers.getContractFactory("MockChainlink");
        const mockChainlink = await MockChainlink.deploy(CONFIG.mockEthUsdPrice);
        await mockChainlink.waitForDeployment();
        chainlinkAddress = await mockChainlink.getAddress();
        deployedAddresses.contracts.chainlink = {
            address: chainlinkAddress,
            type: "MockChainlink"
        };
        console.log("   MockChainlink:", chainlinkAddress);
    } else {
        chainlinkAddress = CHAINLINK_ADDRESSES[networkName];
        if (!chainlinkAddress) {
            throw new Error(`No Chainlink address for network: ${networkName}`);
        }
        deployedAddresses.contracts.chainlink = {
            address: chainlinkAddress,
            type: "Chainlink ETH/USD"
        };
        console.log("\n1. Using Chainlink ETH/USD:", chainlinkAddress);
    }

    // ==================== 2. 部署 Stablecoin ====================

    console.log("\n2. Deploying Stablecoin (CHKD)...");
    const StablecoinV1 = await ethers.getContractFactory("StablecoinV1");
    const stablecoin = await upgrades.deployProxy(
        StablecoinV1,
        [chainlinkAddress, deployer.address],
        { initializer: "initialize", kind: "uups" }
    );
    await stablecoin.waitForDeployment();
    const stablecoinAddress = await stablecoin.getAddress();
    const stablecoinImpl = await upgrades.erc1967.getImplementationAddress(stablecoinAddress);

    deployedAddresses.contracts.stablecoin = {
        proxy: stablecoinAddress,
        implementation: stablecoinImpl
    };
    console.log("   Proxy:", stablecoinAddress);
    console.log("   Implementation:", stablecoinImpl);

    // ==================== 3. 部署 NFTCollection ====================

    console.log("\n3. Deploying NFTCollection...");
    const NFTCollectionV1 = await ethers.getContractFactory("NFTCollectionV1");
    const nft = await upgrades.deployProxy(
        NFTCollectionV1,
        [CONFIG.nftName, CONFIG.nftSymbol, CONFIG.nftMaxSupply, deployer.address],
        { initializer: "initialize", kind: "uups" }
    );
    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();
    const nftImpl = await upgrades.erc1967.getImplementationAddress(nftAddress);

    deployedAddresses.contracts.nft = {
        proxy: nftAddress,
        implementation: nftImpl
    };
    console.log("   Proxy:", nftAddress);
    console.log("   Implementation:", nftImpl);

    // ==================== 4. 部署 Marketplace ====================

    console.log("\n4. Deploying Marketplace...");
    const MarketplaceV1 = await ethers.getContractFactory("MarketplaceV1");
    const marketplace = await upgrades.deployProxy(
        MarketplaceV1,
        [stablecoinAddress, deployer.address],
        { initializer: "initialize", kind: "uups" }
    );
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    const marketplaceImpl = await upgrades.erc1967.getImplementationAddress(marketplaceAddress);

    deployedAddresses.contracts.marketplace = {
        proxy: marketplaceAddress,
        implementation: marketplaceImpl
    };
    console.log("   Proxy:", marketplaceAddress);
    console.log("   Implementation:", marketplaceImpl);

    // ==================== 5. 部署 Auction ====================

    console.log("\n5. Deploying Auction...");
    const AuctionV1 = await ethers.getContractFactory("AuctionV1");
    const auction = await upgrades.deployProxy(
        AuctionV1,
        [stablecoinAddress, deployer.address],
        { initializer: "initialize", kind: "uups" }
    );
    await auction.waitForDeployment();
    const auctionAddress = await auction.getAddress();
    const auctionImpl = await upgrades.erc1967.getImplementationAddress(auctionAddress);

    deployedAddresses.contracts.auction = {
        proxy: auctionAddress,
        implementation: auctionImpl
    };
    console.log("   Proxy:", auctionAddress);
    console.log("   Implementation:", auctionImpl);

    // ==================== 6. 部署 Faucet ====================

    console.log("\n6. Deploying Faucet...");
    const FaucetV1 = await ethers.getContractFactory("FaucetV1");
    const faucet = await upgrades.deployProxy(
        FaucetV1,
        [stablecoinAddress, CONFIG.faucetAmount, CONFIG.faucetCooldown, deployer.address],
        { initializer: "initialize", kind: "uups" }
    );
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();
    const faucetImpl = await upgrades.erc1967.getImplementationAddress(faucetAddress);

    deployedAddresses.contracts.faucet = {
        proxy: faucetAddress,
        implementation: faucetImpl
    };
    console.log("   Proxy:", faucetAddress);
    console.log("   Implementation:", faucetImpl);

    // ==================== 7. 配置权限 ====================

    console.log("\n7. Configuring permissions...");

    // 设置 Faucet 地址到 Stablecoin
    await stablecoin.setFaucet(faucetAddress);
    console.log("   Set Faucet address in Stablecoin");

    // ==================== 8. 保存部署信息 ====================

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deployedAddresses, null, 2));
    console.log("\n8. Deployment info saved to:", deploymentFile);

    // ==================== 打印汇总 ====================

    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log("\nContract Addresses (Proxy):");
    console.log("-".repeat(40));
    console.log("Chainlink:    ", chainlinkAddress);
    console.log("Stablecoin:   ", stablecoinAddress);
    console.log("NFTCollection:", nftAddress);
    console.log("Marketplace:  ", marketplaceAddress);
    console.log("Auction:      ", auctionAddress);
    console.log("Faucet:       ", faucetAddress);
    console.log("-".repeat(40));

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });