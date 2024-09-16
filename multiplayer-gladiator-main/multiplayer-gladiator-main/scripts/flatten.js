async function main() {
    const fs = require("fs");
    const hre = require("hardhat");

    const flattened = await hre.run("flatten:get-flattened-sources", {
        files: ["contracts/GameSkinNFT.sol"],
    });

    fs.writeFileSync("./FlattenedGameSkinNFT.sol", flattened);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
