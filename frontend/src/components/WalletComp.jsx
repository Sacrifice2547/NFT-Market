import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

function WalletComp({ contracts, account, provider }) {
  // 余额状态
  const [ethBalance, setEthBalance] = useState("0");
  const [chkdBalance, setChkdBalance] = useState("0");

  // 水龙头状态
  const [cooldown, setCooldown] = useState(0);
  const [loadingClaim, setLoadingClaim] = useState(false);

  // 兑换状态
  const [swapAmount, setSwapAmount] = useState("");
  const [isEthToChkd, setIsEthToChkd] = useState(true); // true = ETH换CHKD, false = CHKD换ETH
  const [loadingSwap, setLoadingSwap] = useState(false);

  useEffect(() => {
    if (account && contracts) {
      refreshData();
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [account, contracts]);

  const refreshData = async () => {
    try {
      // 1. 获取 ETH 余额
      const ethBal = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(ethBal));

      // 2. 获取 CHKD 余额
      const chkdBal = await contracts.chkd.balanceOf(account);
      setChkdBalance(ethers.formatEther(chkdBal));

      // 3. 获取水龙头冷却
      const remain = await contracts.faucet.getRemainingCooldown(account);
      setCooldown(Number(remain));
    } catch (err) {
      console.error("刷新数据失败:", err);
    }
  };

  // --- 水龙头领取 ---
  const handleClaim = async () => {
    setLoadingClaim(true);
    try {
      const tx = await contracts.faucet.claim();
      await tx.wait();
      alert("🎉 领取成功! 获得免费 CHKD");
      refreshData();
    } catch (err) {
      console.error(err);
      let msg = err.reason || err.message;
      if (msg.includes("Cooldown")) msg = "冷却时间未到";
      alert("领取失败: " + msg);
    }
    setLoadingClaim(false);
  };

  // --- 兑换功能 (Swap) ---
  const handleSwap = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0)
      return alert("请输入有效金额");
    setLoadingSwap(true);

    try {
      if (isEthToChkd) {
        // === ETH -> CHKD ===
        // 调用: function buyWithETH() external payable
        const tx = await contracts.chkd.buyWithETH({
          value: ethers.parseEther(swapAmount),
        });
        await tx.wait();
        alert(`兑换成功! 使用 ${swapAmount} ETH 购买了 CHKD`);
      } else {
        // === CHKD -> ETH ===
        // 调用: function burnForETH(uint256 tokenAmount) external
        // 注意: 此函数直接 burn 发送者的代币，无需 approve，因为是在代币合约内部操作
        const amountWei = ethers.parseEther(swapAmount);

        // 检查合约是否有足够的 ETH 储备来支付
        const contractEthBal = await provider.getBalance(contracts.chkd.target);
        // 简单的估算检查 (防止 Gas 浪费)
        // 这里的估算需要在合约侧做，这里如果不方便估算，直接捕获错误即可
        if (contractEthBal === 0n) {
          alert(
            "警告: 稳定币合约当前没有 ETH 储备，无法赎回。请联系管理员充值或等待其他人购买 CHKD。"
          );
          setLoadingSwap(false);
          return;
        }

        const tx = await contracts.chkd.burnForETH(amountWei);
        await tx.wait();
        alert(`兑换成功! 销毁 ${swapAmount} CHKD 换回了 ETH`);
      }
      refreshData();
      setSwapAmount(""); // 清空输入
    } catch (err) {
      console.error(err);
      let msg = err.reason || err.message;
      if (msg.includes("Insufficient balance")) msg = "余额不足";
      if (msg.includes("Insufficient ETH reserve"))
        msg = "合约 ETH 储备不足，无法兑换";
      alert("交易失败: " + msg);
    }
    setLoadingSwap(false);
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分 ${s}秒`;
  };

  return (
    <div className="panel">
      <h2>👛 钱包 & 银行 (Wallet & Bank)</h2>

      {/* 1. 资产展示 */}
      <div className="balance-card" style={styles.balanceCard}>
        <div style={styles.balanceRow}>
          <span>ETH 余额:</span>
          <span style={styles.balanceNum}>
            {parseFloat(ethBalance).toFixed(4)} ETH
          </span>
        </div>
        <div style={styles.balanceRow}>
          <span>CHKD 余额:</span>
          <span style={styles.balanceNum}>
            {parseFloat(chkdBalance).toFixed(2)} CHKD
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        {/* 2. 水龙头模块 */}
        <div className="action-box" style={{ flex: 1, ...styles.box }}>
          <h3>🚰 免费水龙头</h3>
          <p style={{ fontSize: "13px", color: "#666" }}>
            每隔一段时间可领取测试币
          </p>
          <button
            onClick={handleClaim}
            disabled={loadingClaim || cooldown > 0}
            style={{
              ...styles.btn,
              backgroundColor: cooldown > 0 ? "#ccc" : "#28a745",
              cursor: cooldown > 0 ? "not-allowed" : "pointer",
            }}
          >
            {loadingClaim
              ? "领取中..."
              : cooldown > 0
              ? `冷却中 ${formatTime(cooldown)}`
              : "领取 CHKD"}
          </button>
        </div>

        {/* 3. 兑换模块 */}
        <div className="action-box" style={{ flex: 1, ...styles.box }}>
          <h3>💱 官方兑换 (Chainlink 喂价)</h3>

          <div
            style={{
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                fontWeight: isEthToChkd ? "bold" : "normal",
                color: isEthToChkd ? "#007bff" : "#333",
              }}
            >
              ETH
            </span>
            <button
              onClick={() => setIsEthToChkd(!isEthToChkd)}
              style={{
                padding: "5px 10px",
                borderRadius: "20px",
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              ↔️
            </button>
            <span
              style={{
                fontWeight: !isEthToChkd ? "bold" : "normal",
                color: !isEthToChkd ? "#007bff" : "#333",
              }}
            >
              CHKD
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="number"
              placeholder={isEthToChkd ? "输入 ETH 数量" : "输入 CHKD 数量"}
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              style={{ flex: 1, padding: "8px" }}
            />
            <button
              onClick={handleSwap}
              disabled={loadingSwap}
              style={{ ...styles.btn, backgroundColor: "#007bff" }}
            >
              {loadingSwap
                ? "交易中..."
                : isEthToChkd
                ? "买入 CHKD"
                : "换回 ETH"}
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>
            {isEthToChkd
              ? "提示: 将根据当前 Chainlink 价格将 ETH 兑换为 CHKD"
              : "注意: 仅当合约内有足够的 ETH 储备时才能成功换回"}
          </p>
        </div>
      </div>
    </div>
  );
}

// 简单的内联样式对象
const styles = {
  balanceCard: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "20px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  balanceRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "16px",
  },
  balanceNum: {
    fontWeight: "bold",
    fontSize: "18px",
  },
  box: {
    border: "1px solid #eee",
    padding: "15px",
    borderRadius: "8px",
    background: "#fafafa",
  },
  btn: {
    padding: "10px 15px",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    width: "100%",
    marginTop: "10px",
  },
};

export default WalletComp;
