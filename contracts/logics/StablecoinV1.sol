// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../interfaces/IChainlink.sol";
import "../interfaces/IStablecoin.sol";

contract StablecoinV1 is 
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IStablecoin
{
    IChainlink public chainlink;
    address public faucet;
    
    // USD 转 HKD 汇率 (乘以 1e18, 例如 7.8 = 7.8 * 1e18)
    uint256 public usdToHkdRate;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _chainlink, address _owner) external initializer {
        __ERC20_init("cHKD Stablecoin", "CHKD");
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        chainlink = IChainlink(_chainlink);
        usdToHkdRate = 78 * 1e17; // 7.8 HKD per USD
    }
    
    function buyWithETH() external payable override returns (uint256 tokenAmount) {
        require(msg.value > 0, "Must send ETH");
        tokenAmount = estimateTokensFromETH(msg.value);
        _mint(msg.sender, tokenAmount);
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }
    
    function burnForETH(uint256 tokenAmount) external override returns (uint256 ethAmount) {
        require(tokenAmount > 0, "Amount must > 0");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        ethAmount = estimateETHFromTokens(tokenAmount);
        require(address(this).balance >= ethAmount, "Insufficient ETH reserve");
        
        _burn(msg.sender, tokenAmount);
        
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        
        emit TokensBurned(msg.sender, tokenAmount, ethAmount);
    }
    
    function mint(address to, uint256 amount) external override {
        require(msg.sender == owner() || msg.sender == faucet, "Not authorized");
        _mint(to, amount);
    }
    
    // 获取 ETH/HKD 价格
    // 步骤: ETH/USD * USD/HKD = ETH/HKD
    function getETHPrice() public view override returns (uint256) {
        (, int256 answer, , , ) = chainlink.latestRoundData();
        require(answer > 0, "Invalid price");
        
        uint8 dec = chainlink.decimals();
        // 转换 ETH/USD 为 18 位精度
        uint256 ethUsdPrice = uint256(answer) * (10 ** (18 - dec));
        
        // ETH/HKD = ETH/USD * USD/HKD
        uint256 ethHkdPrice = (ethUsdPrice * usdToHkdRate) / 1e18;
        
        return ethHkdPrice;
    }
    
    function estimateTokensFromETH(uint256 ethAmount) public view override returns (uint256) {
        return (ethAmount * getETHPrice()) / 1e18;
    }
    
    function estimateETHFromTokens(uint256 tokenAmount) public view override returns (uint256) {
        return (tokenAmount * 1e18) / getETHPrice();
    }
    
    function setChainlink(address _chainlink) external override onlyOwner {
        chainlink = IChainlink(_chainlink);
    }
    
    function setFaucet(address _faucet) external override onlyOwner {
        faucet = _faucet;
    }
    
    // 设置 USD/HKD 汇率
    function setUsdToHkdRate(uint256 _rate) external onlyOwner {
        usdToHkdRate = _rate;
    }
    
    function withdrawETH(address to, uint256 amount) external override onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    receive() external payable {}
}