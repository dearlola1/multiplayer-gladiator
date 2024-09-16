// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract GameSkinNFT is ERC721, ERC2981, Ownable, ReentrancyGuard {
    uint256 public nextTokenId;
    uint256 public constant MAX_SUPPLY = 10000; 
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) public availableQuantities; 
    mapping(uint256 => uint256) public tokenPrices; 
    mapping(uint256 => bool) public isForSale; 
    uint256 private _totalSupply;

    event NFTMinted(uint256 indexed tokenId, string tokenURI, uint256 price, uint256 quantity);
    event NFTPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event NFTListedForSale(uint256 indexed tokenId, uint256 price);
    event NFTWithdrawnFromSale(uint256 indexed tokenId);
    event NFTBurned(uint256 indexed tokenId);
    event FundsWithdrawn(uint256 amount);

    constructor() ERC721("GameSkin", "GSN") Ownable() {
        _setDefaultRoyalty(owner(), 222); // 2.22% royalty
    }

    // Minting NFTs directly to the contract and marking them for sale
    function mintToContract(string memory _tokenURI, uint256 quantity, uint256 price) external onlyOwner {
        require(nextTokenId + quantity <= MAX_SUPPLY, "Exceeds max supply");
        require(bytes(_tokenURI).length > 0, "Invalid token URI");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = nextTokenId;
            _mint(address(this), tokenId);
            _setTokenURI(tokenId, _tokenURI);
            availableQuantities[tokenId] = quantity;
            tokenPrices[tokenId] = price;
            isForSale[tokenId] = true;
            nextTokenId++;
            _totalSupply++; // Increment total supply

            emit NFTMinted(tokenId, _tokenURI, price, quantity);
        }
    }

    // Function to get the total supply of minted tokens
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    // Retrieve all token IDs owned by a specific address
    function walletOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < nextTokenId; i++) {
            if (ownerOf(i) == owner) {
                tokenIds[currentIndex] = i;
                currentIndex++;
            }
        }

        return tokenIds;
    }

    // Purchase NFT directly from the contract
    function purchaseNFT(uint256 tokenId) external payable nonReentrant {
        require(isForSale[tokenId], "NFT not available for purchase");
        require(msg.value >= tokenPrices[tokenId], "Insufficient payment");
        require(ownerOf(tokenId) == address(this), "NFT not owned by contract");

        // Transfer the NFT to the buyer
        _transfer(address(this), msg.sender, tokenId);

        // Transfer the funds to the contract owner (or distribute accordingly)
        payable(owner()).transfer(msg.value);

        // Mark as sold
        availableQuantities[tokenId]--;
        if (availableQuantities[tokenId] == 0) {
            isForSale[tokenId] = false;
        }

        emit NFTPurchased(tokenId, msg.sender, msg.value);
    }

    // Player lists their NFT for sale
    function listNFTForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Only the owner can list this NFT for sale");
        require(price > 0, "Price must be greater than 0");

        _transfer(msg.sender, address(this), tokenId); // Transfer to contract for sale
        tokenPrices[tokenId] = price;
        isForSale[tokenId] = true;

        emit NFTListedForSale(tokenId, price);
    }

    // Withdraw an NFT from sale
    function withdrawNFTFromSale(uint256 tokenId) external {
        require(ownerOf(tokenId) == address(this), "NFT not listed for sale");
        require(msg.sender == owner(), "Only the contract owner can withdraw this NFT from sale");

        isForSale[tokenId] = false;
        _transfer(address(this), msg.sender, tokenId);

        emit NFTWithdrawnFromSale(tokenId);
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal {
        require(_exists(tokenId), "Token does not exist");
        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenURIs[tokenId];
    }

    // Overrides to support royalties
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Withdraw funds from the contract
    function withdrawFunds() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds available for withdrawal");
        payable(owner()).transfer(balance);

        emit FundsWithdrawn(balance);
    }

    // Function to burn a token
    function burn(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        _burn(tokenId);
        _totalSupply--; // Decrement total supply

        emit NFTBurned(tokenId);
    }
}
