const Web3 = require('web3');
const fs = require('fs');

const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545');
const gameSkinABI = JSON.parse(fs.readFileSync('artifacts/contracts/GameSkinNFT.sol/GameSkinNFT.json')).abi;
const gameSkinAddress = '0x8744348B69fd2c59334421FbF0310385cA2FEfDA';
const gameSkinNFT = new web3.eth.Contract(gameSkinABI, gameSkinAddress);

async function testContract(address) {
    try {
        console.log(`Fetching NFTs for address: ${address}`);
        const ownedNFTs = await gameSkinNFT.methods.walletOfOwner(address).call();
        console.log('Owned NFTs:', ownedNFTs);

        for (const tokenId of ownedNFTs) {
            const tokenURI = await gameSkinNFT.methods.tokenURI(tokenId).call();
            console.log(`Token ID: ${tokenId}, Token URI: ${tokenURI}`);
        }
    } catch (error) {
        console.error('Error interacting with the contract:', error);
    }
}

testContract('0x6ea3b66ef7eb83e8536036876d383aa5606eb730'); // Replace with the address you want to test
