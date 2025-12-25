// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INFTCollection {
    
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    
    function mint(string calldata tokenURI) external returns (uint256 tokenId);
    
    function mintTo(address to, string calldata tokenURI) external returns (uint256 tokenId);
    
    function batchMint(string[] calldata tokenURIs) external returns (uint256 startTokenId);
    
    function tokensOfOwner(address owner) external view returns (uint256[] memory);
    function totalMinted() external view returns (uint256);
    function exists(uint256 tokenId) external view returns (bool);
    
    function setBaseURI(string calldata baseURI) external;
    function setMaxSupply(uint256 maxSupply) external;
}