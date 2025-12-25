// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IMarketplace.sol";

contract MarketplaceV1 is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IMarketplace
{
    IERC20 public paymentToken;
    
    mapping(address => mapping(uint256 => Listing)) private _listings;
    Listing[] private _allListings;
    mapping(address => mapping(uint256 => uint256)) private _listingIndex;
    
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
    
    function listNFT(address nftContract, uint256 tokenId, uint256 price) external override nonReentrant {
        require(price > 0, "Price must > 0");
        require(!isListed(nftContract, tokenId), "Already listed");
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner");
        
        nft.transferFrom(msg.sender, address(this), tokenId);
        
        Listing memory listing = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price
        });
        
        _listings[nftContract][tokenId] = listing;
        _allListings.push(listing);
        _listingIndex[nftContract][tokenId] = _allListings.length;
        
        emit NFTListed(msg.sender, nftContract, tokenId, price);
    }
    
    function buyNFT(address nftContract, uint256 tokenId) external override nonReentrant {
        require(isListed(nftContract, tokenId), "Not listed");
        
        Listing memory listing = _listings[nftContract][tokenId];
        require(listing.seller != msg.sender, "Cannot buy own");
        
        paymentToken.transferFrom(msg.sender, listing.seller, listing.price);
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);
        
        emit NFTSold(listing.seller, msg.sender, nftContract, tokenId, listing.price);
        
        _removeListing(nftContract, tokenId);
    }
    
    function cancelListing(address nftContract, uint256 tokenId) external override nonReentrant {
        require(isListed(nftContract, tokenId), "Not listed");
        
        Listing memory listing = _listings[nftContract][tokenId];
        require(listing.seller == msg.sender, "Not seller");
        
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);
        
        emit ListingCancelled(msg.sender, nftContract, tokenId);
        
        _removeListing(nftContract, tokenId);
    }
    
    function getListing(address nftContract, uint256 tokenId) external view override returns (Listing memory) {
        return _listings[nftContract][tokenId];
    }
    
    function getAllListings() external view override returns (Listing[] memory) {
        return _allListings;
    }
    
    function isListed(address nftContract, uint256 tokenId) public view override returns (bool) {
        return _listingIndex[nftContract][tokenId] != 0;
    }
    
    function _removeListing(address nftContract, uint256 tokenId) internal {
        uint256 idx = _listingIndex[nftContract][tokenId];
        if (idx == 0) return;
        
        uint256 lastIdx = _allListings.length - 1;
        if (idx - 1 != lastIdx) {
            Listing memory last = _allListings[lastIdx];
            _allListings[idx - 1] = last;
            _listingIndex[last.nftContract][last.tokenId] = idx;
        }
        
        _allListings.pop();
        delete _listingIndex[nftContract][tokenId];
        delete _listings[nftContract][tokenId];
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
}