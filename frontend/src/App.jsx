import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONFIG } from "./config";

// 导入 ABI
import StablecoinABI from "./abis/Stablecoin.json";
import NFTCollectionABI from "./abis/NFTCollection.json";
import MarketplaceABI from "./abis/Marketplace.json";
import AuctionABI from "./abis/Auction.json";
import FaucetABI from "./abis/Faucet.json";

// 导入组件
import WalletComp from "./components/WalletComp";
import MyNFTComp from "./components/MyNFTComp";
import MarketComp from "./components/MarketComp";
import AuctionComp from "./components/AuctionComp";

import "./App.css";

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [activeTab, setActiveTab] = useState("wallet");

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const _signer = await _provider.getSigner();
        const _account = await _signer.getAddress();

        setProvider(_provider);
        setSigner(_signer);
        setAccount(_account);

        // 初始化合约实例
        const chkd = new ethers.Contract(
          CONFIG.addresses.stablecoin,
          StablecoinABI.abi,
          _signer
        );
        const nft = new ethers.Contract(
          CONFIG.addresses.nft,
          NFTCollectionABI.abi,
          _signer
        );
        const market = new ethers.Contract(
          CONFIG.addresses.marketplace,
          MarketplaceABI.abi,
          _signer
        );
        const auction = new ethers.Contract(
          CONFIG.addresses.auction,
          AuctionABI.abi,
          _signer
        );
        const faucet = new ethers.Contract(
          CONFIG.addresses.faucet,
          FaucetABI.abi,
          _signer
        );

        setContracts({ chkd, nft, market, auction, faucet });
      } catch (err) {
        console.error("User rejected", err);
      }
    } else {
      alert("请安装 MetaMask!");
    }
  };

  if (!account) {
    return (
      <div className="login-container">
        <h1>NFT 交易市场</h1>
        <button onClick={connectWallet} className="connect-btn">
          连接钱包
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <button
          onClick={() => setActiveTab("wallet")}
          className={activeTab === "wallet" ? "active" : ""}
        >
          钱包 & 水龙头
        </button>
        <button
          onClick={() => setActiveTab("mynft")}
          className={activeTab === "mynft" ? "active" : ""}
        >
          我的 NFT
        </button>
        <button
          onClick={() => setActiveTab("market")}
          className={activeTab === "market" ? "active" : ""}
        >
          交易市场
        </button>
        <button
          onClick={() => setActiveTab("auction")}
          className={activeTab === "auction" ? "active" : ""}
        >
          竞拍中心
        </button>
        <span className="address-display">
          当前: {account.slice(0, 6)}...{account.slice(-4)}
        </span>
      </nav>

      <div className="content-area">
        {contracts && (
          <>
            {activeTab === "wallet" && (
              <WalletComp
                contracts={contracts}
                account={account}
                provider={provider}
              />
            )}
            {activeTab === "mynft" && (
              <MyNFTComp contracts={contracts} account={account} />
            )}
            {activeTab === "market" && (
              <MarketComp contracts={contracts} account={account} />
            )}
            {activeTab === "auction" && (
              <AuctionComp contracts={contracts} account={account} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
