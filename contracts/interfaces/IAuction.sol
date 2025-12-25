// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAuction {
    
    struct AuctionInfo {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 startPrice;
        uint256 highestBid;
        address highestBidder;
        uint64 endTime;
    }
    
    event AuctionStarted(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 startPrice, uint64 endTime);
    event BidPlaced(address indexed bidder, uint256 indexed tokenId, uint256 amount);
    event AuctionCancelled(address indexed seller, uint256 indexed tokenId);
    event AuctionSettled(address indexed seller, address indexed winner, uint256 indexed tokenId, uint256 amount);
    
    function startAuction(address nftContract, uint256 tokenId, uint256 startPrice, uint64 duration) external;
    function bid(uint256 tokenId, uint256 amount) external;
    function cancelAuction(uint256 tokenId) external;
    function settle(uint256 tokenId) external;
    
    function getAuction(uint256 tokenId) external view returns (AuctionInfo memory);
    function getAllAuctions() external view returns (AuctionInfo[] memory);
    function isActive(uint256 tokenId) external view returns (bool);
}