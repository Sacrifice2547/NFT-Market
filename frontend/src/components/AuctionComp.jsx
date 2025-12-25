import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

function AuctionComp({ contracts, account }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);

  // 新增：用于驱动倒计时的当前时间状态
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // 1. 设置定时器，每秒更新 'now' 状态，从而触发界面重绘
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    // 组件卸载时清除定时器，防止内存泄漏
    return () => clearInterval(timer);
  }, []);

  // 2. 初始化加载数据
  useEffect(() => {
    if (contracts && account) {
      fetchAuctions();
    }
  }, [contracts, account]);

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const allAuctions = await contracts.auction.getAllAuctions();
      const validItems = [];

      // 注意：这里我们只保存结束时间的“原始时间戳”，不计算是否结束
      // 是否结束的判断逻辑移到渲染层 (Render)，依赖 'now' 状态

      for (let i = 0; i < allAuctions.length; i++) {
        const item = allAuctions[i];
        if (
          item.nftContract.toLowerCase() ===
            contracts.nft.target.toLowerCase() &&
          item.seller !== ethers.ZeroAddress
        ) {
          // 计算当前显示价格
          const currentPrice =
            item.highestBid > 0n ? item.highestBid : item.startPrice;

          validItems.push({
            seller: item.seller,
            tokenId: item.tokenId.toString(),
            startPrice: item.startPrice,
            highestBid: item.highestBid,
            highestBidder: item.highestBidder,
            endTime: Number(item.endTime), // 保存原始时间戳
            currentPrice: currentPrice,
            isMine: item.seller.toLowerCase() === account.toLowerCase(),
            isWinner:
              item.highestBidder.toLowerCase() === account.toLowerCase(),
            bidInput: "",
          });
        }
      }
      setAuctions(validItems);
    } catch (err) {
      console.error("获取竞拍数据失败:", err);
    }
    setLoading(false);
  };

  const handleBid = async (item) => {
    if (!item.bidInput) return alert("请输入出价金额");
    try {
      const bidWei = ethers.parseEther(item.bidInput);
      if (bidWei <= item.currentPrice && item.highestBid > 0n)
        return alert("出价必须高于当前最高价");
      if (bidWei < item.startPrice) return alert("出价不能低于起拍价");

      const approveTx = await contracts.chkd.approve(
        contracts.auction.target,
        bidWei
      );
      await approveTx.wait();

      const tx = await contracts.auction.bid(item.tokenId, bidWei);
      await tx.wait();

      alert("出价成功!");
      fetchAuctions();
    } catch (err) {
      console.error(err);
      alert("出价失败: " + (err.reason || err.message));
    }
  };

  const handleSettle = async (item) => {
    try {
      const tx = await contracts.auction.settle(item.tokenId);
      await tx.wait();
      alert("结算成功!");
      fetchAuctions();
    } catch (err) {
      console.error(err);
      alert("结算失败: " + (err.reason || err.message));
    }
  };

  // 3. 动态计算倒计时显示的辅助函数
  const getTimerDisplay = (endTime) => {
    const diff = endTime - now; // 使用 State 中的 now

    if (diff <= 0) return { text: "已结束", isEnded: true };

    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    // 补零美化 (例如 05秒)
    const hh = h > 0 ? `${h}时 ` : "";
    const mm = m > 0 || h > 0 ? `${m}分 ` : "";
    const ss = `${s}秒`;

    return { text: `剩余: ${hh}${mm}${ss}`, isEnded: false };
  };

  return (
    <div className="panel">
      <h2>🔨 竞拍中心 (Auction)</h2>
      <button onClick={fetchAuctions} disabled={loading}>
        {loading ? "加载中..." : "🔄 刷新竞拍列表"}
      </button>

      <div className="nft-grid">
        {auctions.length === 0 && !loading && (
          <p style={{ padding: "20px", color: "#888" }}>暂无活动中的竞拍</p>
        )}

        {auctions.map((item, idx) => {
          // 在渲染时实时计算状态
          const { text: timerText, isEnded } = getTimerDisplay(item.endTime);

          return (
            <div
              key={idx}
              className="nft-card"
              style={{
                border: isEnded ? "1px solid #999" : "1px solid #d35400",
              }}
            >
              <div className="card-header">NFT #{item.tokenId}</div>
              <div className="card-body">
                {item.isMine && (
                  <span style={{ color: "red", fontSize: "12px" }}>
                    (我的拍卖)
                  </span>
                )}

                <p>
                  当前价:{" "}
                  <strong>{ethers.formatEther(item.currentPrice)} CHKD</strong>
                </p>
                <p style={{ fontSize: "12px", color: "#666" }}>
                  最高出价者:{" "}
                  {item.highestBidder === ethers.ZeroAddress ? (
                    "暂无"
                  ) : item.isWinner ? (
                    <span style={{ color: "green" }}>我 (领先)</span>
                  ) : (
                    item.highestBidder.slice(0, 6) + "..."
                  )}
                </p>

                {/* 动态显示时间 */}
                <p
                  style={{
                    color: isEnded ? "red" : "green",
                    fontWeight: "bold",
                  }}
                >
                  {timerText}
                </p>

                {/* --- 出价区域 --- */}
                {!item.isMine && !isEnded && (
                  <div style={{ marginTop: "10px" }}>
                    <input
                      placeholder="金额"
                      style={{ width: "80px" }}
                      value={item.bidInput}
                      onChange={(e) => {
                        const newList = [...auctions];
                        newList[idx].bidInput = e.target.value;
                        setAuctions(newList);
                      }}
                    />
                    <button
                      onClick={() => handleBid(item)}
                      style={{ backgroundColor: "#d35400" }}
                    >
                      出价
                    </button>
                  </div>
                )}

                {/* --- 结算区域 --- */}
                {item.isMine && (
                  <div
                    style={{
                      marginTop: "10px",
                      borderTop: "1px dashed #ccc",
                      paddingTop: "5px",
                    }}
                  >
                    {isEnded ? (
                      <button
                        onClick={() => handleSettle(item)}
                        style={{ width: "100%", backgroundColor: "#28a745" }}
                      >
                        💰 结束并结算
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{ width: "100%", backgroundColor: "#ccc" }}
                      >
                        等待结束...
                      </button>
                    )}
                  </div>
                )}

                {/* --- 获胜提示 --- */}
                {!item.isMine && item.isWinner && isEnded && (
                  <div
                    style={{
                      marginTop: "10px",
                      color: "#28a745",
                      fontWeight: "bold",
                    }}
                  >
                    🎉 你赢了！请等待卖家结算。
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AuctionComp;
