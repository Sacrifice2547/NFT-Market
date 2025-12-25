require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  networks: {
    // 本地开发网络
    hardhat: {
      chainId: 31337
    },

    // 本地节点 (npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },

    // Sepolia 测试网
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      timeout: 60000
    }
  },

  // Etherscan 验证配置
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || ""
    }
  },

  // Gas Reporter (可选)
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD"
  },

  // 路径配置
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};