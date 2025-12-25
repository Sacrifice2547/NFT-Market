// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../interfaces/INFTCollection.sol";

contract NFTCollectionV1 is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    INFTCollection
{
    uint256 private _tokenIdCounter;
    uint256 public maxSupply;
    string public baseURI;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        address _owner
    ) external initializer {
        __ERC721_init(_name, _symbol);
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        maxSupply = _maxSupply;
    }
    
    // 任何人都可以给自己铸造
    function mint(string calldata uri) external override returns (uint256 tokenId) {
        require(maxSupply == 0 || _tokenIdCounter < maxSupply, "Max supply reached");
        
        tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(msg.sender, tokenId, uri);
    }
    
    // Owner 可以给任何人铸造
    function mintTo(address to, string calldata uri) external override onlyOwner returns (uint256 tokenId) {
        require(maxSupply == 0 || _tokenIdCounter < maxSupply, "Max supply reached");
        
        tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
    }
    
    // 批量铸造给自己
    function batchMint(string[] calldata uris) external override returns (uint256 startTokenId) {
        require(uris.length > 0, "Empty URIs");
        require(maxSupply == 0 || _tokenIdCounter + uris.length <= maxSupply, "Exceeds max supply");
        
        startTokenId = _tokenIdCounter;
        for (uint256 i = 0; i < uris.length; i++) {
            uint256 tokenId = _tokenIdCounter++;
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, uris[i]);
            emit NFTMinted(msg.sender, tokenId, uris[i]);
        }
    }
    
    // 兼容旧接口 (Owner only)
    function safeMint(address to, string calldata uri) external onlyOwner returns (uint256 tokenId) {
        return this.mintTo(to, uri);
    }
    
    function tokensOfOwner(address owner) external view override returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokens = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokens;
    }
    
    function totalMinted() external view override returns (uint256) {
        return _tokenIdCounter;
    }
    
    function exists(uint256 tokenId) external view override returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    function setBaseURI(string calldata newBaseURI) external override onlyOwner {
        baseURI = newBaseURI;
    }
    
    function setMaxSupply(uint256 _maxSupply) external override onlyOwner {
        require(_maxSupply == 0 || _maxSupply >= _tokenIdCounter, "Below minted");
        maxSupply = _maxSupply;
    }
    
    function getBaseURI() external view returns (string memory) {
        return baseURI;
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value)
        internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }
    
    function tokenURI(uint256 tokenId)
        public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}