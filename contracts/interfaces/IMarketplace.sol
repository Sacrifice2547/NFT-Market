// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMarketplace {
    
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
    }
    
    event NFTListed(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 price);
    event NFTSold(address indexed seller, address indexed buyer, address indexed nftContract, uint256 tokenId, uint256 price);
    event ListingCancelled(address indexed seller, address indexed nftContract, uint256 indexed tokenId);
    
    function listNFT(address nftContract, uint256 tokenId, uint256 price) external;
    function buyNFT(address nftContract, uint256 tokenId) external;
    function cancelListing(address nftContract, uint256 tokenId) external;
    
    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory);
    function getAllListings() external view returns (Listing[] memory);
    function isListed(address nftContract, uint256 tokenId) external view returns (bool);
}