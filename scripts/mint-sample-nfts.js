const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 示例 NFT 元数据
const SAMPLE_NFTS = [
    {
        uri: "https://picsum.photos/seed/nft0/400/400",
        name: "Genesis NFT"
    },
    {
        uri: "https://picsum.photos/seed/nft1/400/400",
        name: "Rare Diamond"
    },
    {
        uri: "https://picsum.photos/seed/nft2/400/400",
        name: "Golden Crown"
    },
    {
        uri: "https://picsum.photos/seed/nft3/400/400",
        name: "Crystal Sword"
    },
    {
        uri: "https://picsum.photos/seed/nft4/400/400",
        name: "Magic Potion"
    }
];

async function main() {
    const networkName = network.name;
    const deploymentFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);

    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment file not found. Run deploy.js first.`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const [owner, user1, user2] = await ethers.getSigners();

    console.log("Minting sample NFTs...\n");

    const nft = await ethers.getContractAt("NFTCollectionV1", deployment.contracts.nft.proxy);

    // 给不同用户铸造 NFT
    const recipients = [user1.address, user1.address, user2.address, user2.address, owner.address];

    for (let i = 0; i < SAMPLE_NFTS.length; i++) {
        const recipient = recipients[i];
        const tx = await nft.safeMint(recipient, SAMPLE_NFTS[i].uri);
        await tx.wait();
        console.log(`Minted NFT #${i} "${SAMPLE_NFTS[i].name}" to ${recipient}`);
    }

    console.log("\nMinting complete!");
    console.log("Total minted:", await nft.totalMinted());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });