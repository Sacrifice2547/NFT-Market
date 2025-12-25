const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const networkName = network.name;
    const deploymentFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const proxyAddress = deployment.contracts.nft.proxy;

    // 获取升级前的 implementation
    const oldImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log("=".repeat(50));
    console.log("Upgrading NFTCollection...");
    console.log("Proxy:", proxyAddress);
    console.log("Old Implementation:", oldImpl);
    console.log("=".repeat(50));

    // 强制重新部署
    const NFTCollectionV1 = await ethers.getContractFactory("NFTCollectionV1");

    // 使用 forceImport 确保升级
    try {
        await upgrades.forceImport(proxyAddress, NFTCollectionV1);
    } catch (e) {
        // 忽略已导入的错误
    }

    // 升级
    const upgraded = await upgrades.upgradeProxy(proxyAddress, NFTCollectionV1, {
        redeployImplementation: 'always'  // 强制重新部署 implementation
    });
    await upgraded.waitForDeployment();

    // 获取新的 implementation
    const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log("\nNew Implementation:", newImpl);
    console.log("Changed:", oldImpl !== newImpl ? "✅ Yes" : "❌ No (same code?)");

    // 验证新功能存在
    const nft = await ethers.getContractAt("NFTCollectionV1", proxyAddress);

    try {
        // 测试新的 mint 函数是否存在
        const mintFunction = nft.interface.getFunction("mint");
        console.log("\n✅ New mint() function exists!");
    } catch (e) {
        console.log("\n❌ mint() function not found");
    }

    // 更新部署文件
    deployment.contracts.nft.implementation = newImpl;
    deployment.contracts.nft.upgradedAt = new Date().toISOString();
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

    console.log("\nDeployment file updated!");
}

main()
    .then(() => process.exit(0))
    .catch(console.error);