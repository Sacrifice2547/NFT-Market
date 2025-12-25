const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 选择要升级的合约
const CONTRACT_TO_UPGRADE = process.env.CONTRACT || "StablecoinV1";
const NEW_VERSION = process.env.VERSION || "V2";

async function main() {
    const networkName = network.name;
    const deploymentFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);

    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment file not found. Run deploy.js first.`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(60));
    console.log("UPGRADING CONTRACT");
    console.log("=".repeat(60));
    console.log("Network:", networkName);
    console.log("Deployer:", deployer.address);
    console.log("Contract:", CONTRACT_TO_UPGRADE);
    console.log("New Version:", NEW_VERSION);
    console.log("=".repeat(60));

    // 获取代理地址
    let proxyAddress;
    switch (CONTRACT_TO_UPGRADE) {
        case "StablecoinV1":
            proxyAddress = deployment.contracts.stablecoin.proxy;
            break;
        case "NFTCollectionV1":
            proxyAddress = deployment.contracts.nft.proxy;
            break;
        case "MarketplaceV1":
            proxyAddress = deployment.contracts.marketplace.proxy;
            break;
        case "AuctionV1":
            proxyAddress = deployment.contracts.auction.proxy;
            break;
        case "FaucetV1":
            proxyAddress = deployment.contracts.faucet.proxy;
            break;
        default:
            throw new Error(`Unknown contract: ${CONTRACT_TO_UPGRADE}`);
    }

    console.log("\nProxy address:", proxyAddress);

    // 获取新版本合约
    const newContractName = CONTRACT_TO_UPGRADE.replace("V1", NEW_VERSION);
    console.log("New contract name:", newContractName);

    // 升级
    const NewContract = await ethers.getContractFactory(newContractName);
    console.log("\nUpgrading...");

    const upgraded = await upgrades.upgradeProxy(proxyAddress, NewContract);
    await upgraded.waitForDeployment();

    const newImplementation = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log("\nUpgrade complete!");
    console.log("New implementation:", newImplementation);

    // 更新部署文件
    const contractKey = CONTRACT_TO_UPGRADE.replace("V1", "").toLowerCase();
    if (deployment.contracts[contractKey]) {
        deployment.contracts[contractKey].implementation = newImplementation;
        deployment.contracts[contractKey].upgradedAt = new Date().toISOString();
    }

    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    console.log("Deployment file updated");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });