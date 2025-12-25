# NFT: Decentralized Marketplace & Auction Platform

![Deployment Status](https://img.shields.io/badge/Deployment-Live-brightgreen)
![Network](https://img.shields.io/badge/Network-Sepolia_Testnet-blue)
![Course](https://img.shields.io/badge/PolyU-COMP5521-red)

A decentralized NFT trading platform built on the **UUPS (Universal Upgradeable Proxy Standard)** pattern. This project integrates a customized stablecoin exchange, NFT minting, fixed-price marketplace trading, and an English auction system.

🚀 **Live Demo**: [[Your Vercel Link Here](https://nft-market-delta-one.vercel.app/)]  

---

## 📜 Ethereum Standards Compliance

This project strictly adheres to Ethereum Improvement Proposals (EIPs) implemented via OpenZeppelin to ensure security, modularity, and ecosystem interoperability:

### 1. ERC-20 (Fungible Token Standard)
- **Contract**: `StablecoinV1 (CHKD)`
- **Implementation**: Provides standard transfer and allowance (Approve/TransferFrom) logic.
- **Extension**: Integrated with **Chainlink Price Feeds** to enable `buyWithETH` (Minting) and `burnForETH` (Redeeming) based on real-time ETH/USD exchange rates.

### 2. ERC-721 (Non-Fungible Token Standard)
- **Contract**: `NFTCollectionV1`
- **Modules**:
    - **ERC721URIStorage**: Managed metadata and asset URIs (via IPFS/External links).
    - **ERC721Enumerable**: Enhanced on-chain enumerability, allowing the frontend to efficiently query all tokens owned by a specific address via `tokensOfOwner`.
    - **IERC721Receiver**: Implemented in the `AuctionV1` contract to safely handle and escrow NFT assets during active bids.

### 3. ERC-1967 & UUPS (Upgradeable Proxy Standard)
- **Architecture**: Universal Upgradeable Proxy Standard.
- **Key Benefits**: Unlike traditional Transparent Proxies, UUPS places upgrade logic within the implementation contract. This significantly reduces gas costs for routine interactions and allows the owner to potentially "lock" the contract (remove upgradeability) for full decentralization.

---

## 🛠 Technical Stack

- **Smart Contracts**: Solidity ^0.8.28, Hardhat, OpenZeppelin Upgradeable
- **Frontend**: React (Vite), ethers.js (v6)
- **Oracles**: Chainlink Price Feeds (ETH/USD)
- **Security**: ReentrancyGuard (Protection against reentrancy attacks), Ownable (Access Control)

---

## 📦 Deployment Information (Sepolia Testnet)

| Contract Name | Proxy Address | Implementation Address |
| :--- | :--- | :--- |
| **Stablecoin (CHKD)** | `0xFb960bA1B31E593c43A120328cEb12E7EF8F2F6d` | `0x9A2febB2AB187799CC14b00204bE00be2eF90E53` |
| **NFT Collection** | `0xA578a048f10D199564b8fEDe142D9C8204B228C2` | `0x154c01828310c8aDae6F38628372F3789Cf1Cca2` |
| **Marketplace** | `0xB71081DEf94bA547dB3571e5CD05Fe0027Ff08A1` | `0x8D28DA3f7B5018CB17522aC318590C0FAb936a6b` |
| **Auction** | `0xf955c9c16110609e9b093F494e51FB84BF56548F` | `0x4bC458D0e53CE0eB43Ffe20c0C53C3EfDc253258` |
| **Faucet** | `0x29736432FD3BdB8A69Ea139F8E328D1Ef91f4C76` | `0xf6199dC976D82ECC74692080Ad39C4b2b4a9e806` |

---

---
