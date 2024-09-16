async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Using the deployer address:", deployer.address);
  
  const GameSkinNFT = await ethers.getContractFactory("GameSkinNFT");
  const gameSkinNFT = await GameSkinNFT.attach("0xAD1Fa648792f139826589a5B8c183451A27a5356"); // Use your contract's address
  
  const tokenURI = "https://ipfs.io/ipfs/QmdR4Auv39cmoaFqrdGdiMCuJuKWXHkNCwFt4uH1WRxV6a"; // New JSON CID
  const quantity = 5;
  const price = ethers.utils.parseUnits("0.000000000005", "ether");
  
  const mintTx = await gameSkinNFT.mintToContract(tokenURI, quantity, price);
  await mintTx.wait();
  
  console.log(`Minted ${quantity} new skins with tokenURI: ${tokenURI} at a price of ${price.toString()} Wei each.`);
}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error("Error minting new skins:", error);
  process.exit(1);
});
