import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast"; // 建议安装: npm install react-hot-toast

// 如果没安装 react-hot-toast，可以用 alert 代替，代码里保留了 alert 兼容
const notify = (msg) => {
  if (typeof toast !== "undefined" && toast.success) toast.success(msg);
  else alert(msg);
};
const notifyError = (msg) => {
  if (typeof toast !== "undefined" && toast.error) toast.error(msg);
  else alert(msg);
};

function MyNFTComp({ contracts, account }) {
  // --- 数据状态 ---
  const [myWalletNFTs, setMyWalletNFTs] = useState([]); // 1. 钱包中
  const [myListedNFTs, setMyListedNFTs] = useState([]); // 2. 一口价市场中
  const [myAuctionNFTs, setMyAuctionNFTs] = useState([]); // 3. 竞拍中 (新增)

  const [loading, setLoading] = useState(false);

  // 铸造输入
  const [tokenURI, setTokenURI] = useState("");

  // 初始化
  useEffect(() => {
    if (contracts && account) {
      refreshAll();
    }
  }, [contracts, account]);

  const refreshAll = () => {
    setLoading(true);
    Promise.all([
      fetchMyWalletNFTs(),
      fetchMyListedNFTs(),
      fetchMyAuctionNFTs(), // 新增获取竞拍数据
    ]).finally(() => setLoading(false));
  };

  // ============================================================
  // 1. 获取钱包 NFT (tokensOfOwner)
  // ============================================================
  const fetchMyWalletNFTs = async () => {
    try {
      const ids = await contracts.nft.tokensOfOwner(account);
      const data = await Promise.all(
        ids.map(async (id) => {
          let uri = "Unknown";
          try {
            uri = await contracts.nft.tokenURI(id);
          } catch (e) {}
          return {
            tokenId: id.toString(),
            uri: uri,
            inputPrice: "",
            inputAuctionPrice: "",
            inputDuration: "",
          };
        })
      );
      setMyWalletNFTs(data);
    } catch (err) {
      console.error("Wallet Fetch Error", err);
    }
  };

  // ============================================================
  // 2. 获取一口价挂单 (getAllListings)
  // ============================================================
  const fetchMyListedNFTs = async () => {
    try {
      const allListings = await contracts.market.getAllListings();
      const myItems = [];
      for (let item of allListings) {
        if (
          item.seller.toLowerCase() === account.toLowerCase() &&
          item.nftContract.toLowerCase() === contracts.nft.target.toLowerCase()
        ) {
          myItems.push({
            tokenId: item.tokenId.toString(),
            price: item.price,
            newPriceInput: "",
          });
        }
      }
      setMyListedNFTs(myItems);
    } catch (err) {
      console.error("Listings Fetch Error", err);
    }
  };

  // ============================================================
  // 3. 获取我的竞拍 (getAllAuctions) - [新增逻辑]
  // ============================================================
  const fetchMyAuctionNFTs = async () => {
    try {
      const allAuctions = await contracts.auction.getAllAuctions();
      const myItems = [];
      const now = Math.floor(Date.now() / 1000);

      for (let item of allAuctions) {
        // 筛选：卖家是我，且是本平台的NFT
        if (
          item.seller.toLowerCase() === account.toLowerCase() &&
          item.nftContract.toLowerCase() === contracts.nft.target.toLowerCase()
        ) {
          myItems.push({
            tokenId: item.tokenId.toString(),
            startPrice: item.startPrice,
            highestBid: item.highestBid,
            highestBidder: item.highestBidder,
            endTime: Number(item.endTime),
            isEnded: Number(item.endTime) < now,
            hasBid: item.highestBidder !== ethers.ZeroAddress, // 是否有人出价
          });
        }
      }
      setMyAuctionNFTs(myItems);
    } catch (err) {
      console.error("Auctions Fetch Error", err);
    }
  };

  // ============================================================
  // 交互操作
  // ============================================================

  // --- 铸造 ---
  const handleMint = async () => {
    if (!tokenURI) return notifyError("请输入 URI");
    try {
      const tx = await contracts.nft.mint(tokenURI);
      notify("交易已发送，等待上链...");
      await tx.wait();
      notify("铸造成功!");
      refreshAll();
    } catch (e) {
      notifyError(e.reason || e.message);
    }
  };

  // --- 上架一口价 ---
  const handleList = async (nftItem) => {
    if (!nftItem.inputPrice) return notifyError("请输入价格");
    try {
      const approveTx = await contracts.nft.approve(
        contracts.market.target,
        nftItem.tokenId
      );
      await approveTx.wait();

      const tx = await contracts.market.listNFT(
        contracts.nft.target,
        nftItem.tokenId,
        ethers.parseEther(nftItem.inputPrice)
      );
      notify("上架交易已发送...");
      await tx.wait();
      notify("上架成功!");
      refreshAll();
    } catch (e) {
      notifyError(e.reason || e.message);
    }
  };

  // --- 开启竞拍 ---
  const handleStartAuction = async (nftItem) => {
    if (!nftItem.inputAuctionPrice || !nftItem.inputDuration)
      return notifyError("请输入起拍价和时长");
    try {
      const approveTx = await contracts.nft.approve(
        contracts.auction.target,
        nftItem.tokenId
      );
      await approveTx.wait();

      const tx = await contracts.auction.startAuction(
        contracts.nft.target,
        nftItem.tokenId,
        ethers.parseEther(nftItem.inputAuctionPrice),
        parseInt(nftItem.inputDuration) * 60
      );
      notify("竞拍开启交易已发送...");
      await tx.wait();
      notify("竞拍开启成功!");
      refreshAll();
    } catch (e) {
      notifyError(e.reason || e.message);
    }
  };

  // --- 取消一口价 ---
  const handleCancelListing = async (tokenId) => {
    try {
      const tx = await contracts.market.cancelListing(
        contracts.nft.target,
        tokenId
      );
      await tx.wait();
      notify("已取消上架");
      refreshAll();
    } catch (e) {
      notifyError(e.reason || e.message);
    }
  };

  // --- [新增] 取消竞拍 (仅限无人出价时) ---
  const handleCancelAuction = async (tokenId) => {
    try {
      // 合约接口: cancelAuction(uint256 tokenId)
      const tx = await contracts.auction.cancelAuction(tokenId);
      await tx.wait();
      notify("竞拍已取消，NFT已退回");
      refreshAll();
    } catch (e) {
      notifyError("取消失败: " + (e.reason || e.message));
    }
  };

  // --- [新增] 结算/提前终止竞拍 ---
  const handleSettleAuction = async (tokenId) => {
    try {
      // 合约接口: settle(uint256 tokenId)
      const tx = await contracts.auction.settle(tokenId);
      notify("结算交易已发送...");
      await tx.wait();
      notify("结算成功!");
      refreshAll();
    } catch (e) {
      notifyError("结算失败: " + (e.reason || e.message));
    }
  };

  return (
    <div className="panel">
      {/* 顶部：铸造 */}
      <div
        className="create-section"
        style={{
          marginBottom: "30px",
          padding: "15px",
          background: "#f0f8ff",
          borderRadius: "8px",
        }}
      >
        <h3>🎨 铸造新 NFT</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            style={{ flex: 1 }}
            placeholder="Token URI"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
          />
          <button
            onClick={handleMint}
            style={{ background: "#28a745", color: "white" }}
          >
            立即铸造
          </button>
        </div>
      </div>

      <button
        onClick={refreshAll}
        disabled={loading}
        style={{ marginBottom: "20px" }}
      >
        {loading ? "数据刷新中..." : "🔄 刷新所有数据"}
      </button>

      {/* 1. 钱包区域 */}
      <h3 className="section-title">
        👜 我的钱包 (未上架: {myWalletNFTs.length})
      </h3>
      <div className="nft-grid">
        {myWalletNFTs.map((nft, idx) => (
          <div key={idx} className="nft-card">
            <div style={{ fontWeight: "bold" }}>NFT #{nft.tokenId}</div>
            <div className="uri-text">URI: {nft.uri}</div>

            {/* 操作区 */}
            <div style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", gap: "5px", marginBottom: "5px" }}>
                <input
                  placeholder="价格"
                  style={{ width: "60px" }}
                  value={nft.inputPrice}
                  onChange={(e) => {
                    const n = [...myWalletNFTs];
                    n[idx].inputPrice = e.target.value;
                    setMyWalletNFTs(n);
                  }}
                />
                <button onClick={() => handleList(nft)} className="sm-btn">
                  一口价
                </button>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <input
                  placeholder="起拍"
                  style={{ width: "40px" }}
                  value={nft.inputAuctionPrice}
                  onChange={(e) => {
                    const n = [...myWalletNFTs];
                    n[idx].inputAuctionPrice = e.target.value;
                    setMyWalletNFTs(n);
                  }}
                />
                <input
                  placeholder="分"
                  style={{ width: "30px" }}
                  value={nft.inputDuration}
                  onChange={(e) => {
                    const n = [...myWalletNFTs];
                    n[idx].inputDuration = e.target.value;
                    setMyWalletNFTs(n);
                  }}
                />
                <button
                  onClick={() => handleStartAuction(nft)}
                  className="sm-btn"
                >
                  拍卖
                </button>
              </div>
            </div>
          </div>
        ))}
        {myWalletNFTs.length === 0 && !loading && (
          <p className="empty-tip">暂无可用 NFT</p>
        )}
      </div>

      {/* 2. 竞拍区域 (新增) */}
      <h3 className="section-title" style={{ marginTop: "40px" }}>
        🔨 我正在拍卖 (Auction: {myAuctionNFTs.length})
      </h3>
      <div className="nft-grid">
        {myAuctionNFTs.map((item, idx) => (
          <div
            key={idx}
            className="nft-card"
            style={{ borderColor: "#d35400" }}
          >
            <div className="badge orange">拍卖中</div>
            <div style={{ fontWeight: "bold" }}>NFT #{item.tokenId}</div>
            <div style={{ fontSize: "12px", margin: "5px 0" }}>
              当前最高:{" "}
              {item.hasBid ? ethers.formatEther(item.highestBid) : "无"} <br />
              起拍价: {ethers.formatEther(item.startPrice)}
            </div>

            {/* 操作按钮逻辑 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                marginTop: "10px",
              }}
            >
              {/* 场景A: 无人出价 -> 可以取消 */}
              {!item.hasBid && (
                <button
                  onClick={() => handleCancelAuction(item.tokenId)}
                  style={{ background: "#dc3545", color: "white" }}
                >
                  ❌ 取消拍卖
                </button>
              )}

              {/* 场景B: 有人出价 或 想要提前结束 -> 结算 */}
              {/* 你的合约允许随时结算，所以这个按钮常亮 */}
              <button
                onClick={() => handleSettleAuction(item.tokenId)}
                style={{ background: "#28a745", color: "white" }}
              >
                {item.hasBid ? "💰 立即成交/结算" : "🏁 提前结束(退回)"}
              </button>

              {item.hasBid && (
                <span style={{ fontSize: "10px", color: "red" }}>
                  *已有人出价，不可取消，只能结算
                </span>
              )}
            </div>
          </div>
        ))}
        {myAuctionNFTs.length === 0 && !loading && (
          <p className="empty-tip">没有正在进行的拍卖</p>
        )}
      </div>

      {/* 3. 一口价区域 */}
      <h3 className="section-title" style={{ marginTop: "40px" }}>
        🏷️ 我正在出售 (Fixed: {myListedNFTs.length})
      </h3>
      <div className="nft-grid">
        {myListedNFTs.map((item, idx) => (
          <div
            key={idx}
            className="nft-card"
            style={{ borderColor: "#007bff" }}
          >
            <div className="badge blue">出售中</div>
            <div style={{ fontWeight: "bold" }}>NFT #{item.tokenId}</div>
            <div style={{ margin: "10px 0" }}>
              价格: {ethers.formatEther(item.price)} CHKD
            </div>
            <button
              onClick={() => handleCancelListing(item.tokenId)}
              style={{ background: "#dc3545", color: "white", width: "100%" }}
            >
              下架 / 取回
            </button>
          </div>
        ))}
        {myListedNFTs.length === 0 && !loading && (
          <p className="empty-tip">没有正在出售的商品</p>
        )}
      </div>

      {/* 简单样式补充 */}
      <style>{`
        .section-title { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .empty-tip { color: #999; font-style: italic; }
        .uri-text { font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
        .sm-btn { font-size: 12px; padding: 4px 8px; }
        .badge { display: inline-block; padding: 2px 6px; font-size: 10px; color: white; border-radius: 4px; margin-bottom: 5px;}
        .badge.orange { background: #d35400; }
        .badge.blue { background: #007bff; }
      `}</style>
    </div>
  );
}

export default MyNFTComp;
