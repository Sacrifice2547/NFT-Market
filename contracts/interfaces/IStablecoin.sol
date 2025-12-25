// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStablecoin {
    
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event TokensBurned(address indexed seller, uint256 tokenAmount, uint256 ethAmount);
    
    function buyWithETH() external payable returns (uint256 tokenAmount);
    function burnForETH(uint256 tokenAmount) external returns (uint256 ethAmount);
    function mint(address to, uint256 amount) external;
    
    function getETHPrice() external view returns (uint256);
    function estimateTokensFromETH(uint256 ethAmount) external view returns (uint256);
    function estimateETHFromTokens(uint256 tokenAmount) external view returns (uint256);
    
    function setChainlink(address chainlink) external;
    function setFaucet(address faucet) external;
    function withdrawETH(address to, uint256 amount) external;
}