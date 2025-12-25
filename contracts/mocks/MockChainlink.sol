// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IChainlink.sol";

// 模拟 Chainlink ETH/USD 价格预言机
contract MockChainlink is IChainlink {
    int256 public price;
    address public owner;
    
    // 初始价格: 2500 USD (8位精度 = 2500 * 10^8)
    constructor(int256 _initialPrice) {
        owner = msg.sender;
        price = _initialPrice;
    }
    
    function setPrice(int256 _price) external {
        require(msg.sender == owner, "Not owner");
        price = _price;
    }
    
    function latestRoundData() external view override returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (0, price, 0, block.timestamp, 0);
    }
    
    function decimals() external pure override returns (uint8) {
        return 8;
    }
}