// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IAuction.sol";

contract AuctionV1 is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC721Receiver,
    IAuction
{
    IERC20 public paymentToken;
    
    mapping(uint256 => AuctionInfo) public auctionOfId;
    AuctionInfo[] public auctions;
    mapping(uint256 => uint256) public idToIndex;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _paymentToken, address _owner) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        paymentToken = IERC20(_paymentToken);
    }
    
    function startAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint64 duration
    ) external override nonReentrant {
        require(startPrice > 0, "Start price must > 0");
        require(duration > 0, "Duration must > 0");
        require(!isActive(tokenId), "Already in auction");
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner");
        
        nft.safeTransferFrom(msg.sender, address(this), tokenId);
        
        uint64 endTime = uint64(block.timestamp) + duration;
        
        AuctionInfo memory info = AuctionInfo({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startPrice: startPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: endTime
        });
        
        auctionOfId[tokenId] = info;
        auctions.push(info);
        idToIndex[tokenId] = auctions.length - 1;
        
        emit AuctionStarted(msg.sender, nftContract, tokenId, startPrice, endTime);
    }
    
    function bid(uint256 tokenId, uint256 amount) external override nonReentrant {
        require(isActive(tokenId), "Not in auction");
        
        AuctionInfo storage a = auctionOfId[tokenId];
        require(block.timestamp < a.endTime, "Auction ended");
        require(amount >= a.startPrice, "Below start price");
        require(amount > a.highestBid, "Bid not high enough");
        
        paymentToken.transferFrom(msg.sender, address(this), amount);
        
        if (a.highestBidder != address(0) && a.highestBid > 0) {
            paymentToken.transfer(a.highestBidder, a.highestBid);
        }
        
        a.highestBid = amount;
        a.highestBidder = msg.sender;
        
        auctions[idToIndex[tokenId]].highestBid = amount;
        auctions[idToIndex[tokenId]].highestBidder = msg.sender;
        
        emit BidPlaced(msg.sender, tokenId, amount);
    }
    
    function cancelAuction(uint256 tokenId) external override nonReentrant {
        require(isActive(tokenId), "Not in auction");
        
        AuctionInfo storage a = auctionOfId[tokenId];
        require(a.seller == msg.sender, "Not seller");
        require(a.highestBidder == address(0), "Has bids");
        
        IERC721(a.nftContract).safeTransferFrom(address(this), msg.sender, tokenId);
        
        emit AuctionCancelled(msg.sender, tokenId);
        
        _removeAuction(tokenId);
    }
    
    function settle(uint256 tokenId) external override nonReentrant {
        require(isActive(tokenId), "Not in auction");
        
        AuctionInfo storage a = auctionOfId[tokenId];
        require(a.seller == msg.sender, "Not seller");
        
        address winner = a.highestBidder;
        uint256 amount = a.highestBid;
        
        if (winner != address(0) && amount > 0) {
            IERC721(a.nftContract).safeTransferFrom(address(this), winner, tokenId);
            paymentToken.transfer(a.seller, amount);
        } else {
            IERC721(a.nftContract).safeTransferFrom(address(this), a.seller, tokenId);
        }
        
        emit AuctionSettled(a.seller, winner, tokenId, amount);
        
        _removeAuction(tokenId);
    }
    
    function getAuction(uint256 tokenId) external view override returns (AuctionInfo memory) {
        return auctionOfId[tokenId];
    }
    
    function getAllAuctions() external view override returns (AuctionInfo[] memory) {
        return auctions;
    }
    
    function isActive(uint256 tokenId) public view override returns (bool) {
        return auctionOfId[tokenId].seller != address(0);
    }
    
    function _removeAuction(uint256 tokenId) internal {
        uint256 index = idToIndex[tokenId];
        uint256 lastIndex = auctions.length - 1;
        
        if (index != lastIndex) {
            AuctionInfo memory last = auctions[lastIndex];
            auctions[index] = last;
            idToIndex[last.tokenId] = index;
        }
        
        auctions.pop();
        delete idToIndex[tokenId];
        delete auctionOfId[tokenId];
    }
    
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
}