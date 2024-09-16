const ethers = require('ethers');

try {
    const address = "0xECb3e7aB93a11fb9f093E5cD9A3AC6B4Dd4b9a7";
    const checksummedAddress = ethers.utils.getAddress(address);
    console.log("Checksummed Address:", checksummedAddress);
} catch (error) {
    console.error("Error:", error.message);
}
