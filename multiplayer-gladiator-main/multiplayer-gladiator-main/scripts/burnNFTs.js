const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractAddress = "0xAD1Fa648792f139826589a5B8c183451A27a5356"; // Replace with your new contract address

  // Initialize the contract
  const GameSkinNFT = await ethers.getContractFactory("GameSkinNFT");
  const gameSkinNFT = await GameSkinNFT.attach(contractAddress);

  // Specify the token IDs to burn
  const tokenIdsToBurn = [0, 1, 2, 3, 4]; // Replace with the actual token IDs

  // Burn each specified token
  for (let tokenId of tokenIdsToBurn) {
    console.log(`Burning token ID: ${tokenId}`);
    const tx = await gameSkinNFT.burn(tokenId);
    await tx.wait(); // Wait for the transaction to be mined
    console.log(`Burned token ID: ${tokenId}`);
  }

  console.log("Specified NFTs have been burned.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error burning NFTs:", error);
    process.exit(1);
  });
