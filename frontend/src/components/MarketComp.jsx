import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

function MarketComp({ contracts, account }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contracts && account) {
      fetchListings();
    }
  }, [contracts, account]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      console.log("正在从合约获取所有挂单...");

      // 1. 获取所有挂单
      // 根据你的合约，这将返回 Listing[] 结构体数组
      const allListings = await contracts.market.getAllListings();

      console.log("合约返回原始数据:", allListings);

      const validItems = [];

      // 2. 遍历数据
      // 注意：Ethers v6 返回的是 Proxy 对象，我们将其转化为普通对象处理
      for (let i = 0; i < allListings.length; i++) {
        const item = allListings[i];

        // 提取数据 (根据 IMarketplace 结构体: seller, nftContract, tokenId, price)
        const seller = item.seller;
        const nftContract = item.nftContract;
        const tokenId = item.tokenId;
        const price = item.price;

        // 调试日志：查看每一条数据
        console.log(
          `检查第 ${i} 条: Seller=${seller}, TokenId=${tokenId}, Price=${price}`
        );

        // 3. 筛选逻辑修正
        // 我们不再隐藏自己的商品，而是全部显示，方便调试
        // 只过滤掉 NFT 合约地址不对的 (防止显示了其他系列的 NFT)

        const isTargetNFT =
          nftContract.toLowerCase() === contracts.nft.target.toLowerCase();

        if (isTargetNFT) {
          validItems.push({
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId.toString(),
            price: price, // BigInt
            isMine: seller.toLowerCase() === account.toLowerCase(), // 标记是否是自己的
          });
        } else {
          console.warn("忽略了一条数据，因为 NFT 合约地址不匹配", nftContract);
        }
      }

      setListings(validItems);
      console.log("最终渲染列表:", validItems);
    } catch (err) {
      console.error("获取市场数据严重错误:", err);
      alert("无法加载市场数据，请打开控制台(F12)查看详情");
    }
    setLoading(false);
  };

  const handleBuy = async (item) => {
    try {
      // 1. 检查 Stablecoin 授权
      // 注意：这里简单直接调用 approve，实际生产环境应先 check allowance
      const approveTx = await contracts.chkd.approve(
        contracts.market.target,
        item.price
      );
      await approveTx.wait();

      // 2. 购买 NFT
      // 合约接口: function buyNFT(address nftContract, uint256 tokenId)
      const tx = await contracts.market.buyNFT(item.nftContract, item.tokenId);
      await tx.wait();

      alert("购买成功!");
      fetchListings(); // 刷新
    } catch (err) {
      console.error("购买失败:", err);
      // 尝试解析错误原因
      let msg = err.reason || err.message;
      if (msg.includes("Cannot buy own")) msg = "不能购买自己的 NFT";
      if (msg.includes("ERC20: transfer amount exceeds balance"))
        msg = "余额不足";
      alert("购买失败: " + msg);
    }
  };

  return (
    <div className="panel">
      <h2>🔥 交易市场 (Market)</h2>
      <button onClick={fetchListings} disabled={loading}>
        {loading ? "加载中..." : "🔄 刷新列表"}
      </button>

      <div className="nft-grid">
        {listings.length === 0 && !loading && (
          <p style={{ color: "#888", padding: "20px" }}>
            目前市场上没有商品。
            <br />
            <small>（请确保你已经在"我的NFT"页面成功上架了商品）</small>
          </p>
        )}

        {listings.map((item, idx) => (
          <div key={idx} className="nft-card">
            <div className="card-header">NFT #{item.tokenId}</div>
            <div className="card-body">
              <p
                style={{
                  fontSize: "13px",
                  color: "#555",
                  wordBreak: "break-all",
                }}
              >
                卖家: {item.seller.slice(0, 6)}...{item.seller.slice(-4)}
                {item.isMine && (
                  <span
                    style={{
                      color: "red",
                      fontWeight: "bold",
                      marginLeft: "5px",
                    }}
                  >
                    (我)
                  </span>
                )}
              </p>

              <p
                className="price"
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#28a745",
                }}
              >
                {ethers.formatEther(item.price)} CHKD
              </p>

              {item.isMine ? (
                <button
                  disabled
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    backgroundColor: "#ccc",
                    cursor: "not-allowed",
                  }}
                >
                  这是你的商品
                </button>
              ) : (
                <button
                  onClick={() => handleBuy(item)}
                  className="buy-btn"
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    backgroundColor: "#007bff",
                    color: "white",
                  }}
                >
                  购买
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarketComp;
