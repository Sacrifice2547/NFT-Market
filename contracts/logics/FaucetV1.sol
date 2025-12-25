// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../interfaces/IStablecoin.sol";

contract FaucetV1 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    
    IStablecoin public stablecoin;
    uint256 public amountPerClaim;
    uint256 public cooldownTime;
    
    mapping(address => uint256) public lastClaimTime;
    
    event TokensClaimed(address indexed user, uint256 amount);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address _stablecoin,
        uint256 _amountPerClaim,
        uint256 _cooldownTime,
        address _owner
    ) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        
        stablecoin = IStablecoin(_stablecoin);
        amountPerClaim = _amountPerClaim;
        cooldownTime = _cooldownTime;
    }
    
    function claim() external {
        require(block.timestamp >= lastClaimTime[msg.sender] + cooldownTime, "Cooldown");
        lastClaimTime[msg.sender] = block.timestamp;
        stablecoin.mint(msg.sender, amountPerClaim);
        emit TokensClaimed(msg.sender, amountPerClaim);
    }
    
    function getRemainingCooldown(address user) external view returns (uint256) {
        uint256 next = lastClaimTime[user] + cooldownTime;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }
    
    function setAmountPerClaim(uint256 _amount) external onlyOwner {
        amountPerClaim = _amount;
    }
    
    function setCooldownTime(uint256 _cooldown) external onlyOwner {
        cooldownTime = _cooldown;
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
}