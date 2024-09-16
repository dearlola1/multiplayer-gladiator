async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

  // Deploy the GameSkinNFT contract
  const GameSkinNFT = await ethers.getContractFactory("GameSkinNFT");
  const gameSkinNFT = await GameSkinNFT.deploy();

  console.log("GameSkinNFT deployed to:", gameSkinNFT.address);
  
  // Optionally, you might want to wait for the contract to be mined
  await gameSkinNFT.deployed();
  console.log("GameSkinNFT deployment is confirmed at:", gameSkinNFT.address);

  // Optional: You could also log the gas used for deployment
  const txReceipt = await gameSkinNFT.deployTransaction.wait();
  console.log("Gas used for deployment:", txReceipt.gasUsed.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
      console.error("Error deploying contract:", error);
      process.exit(1);
  });
