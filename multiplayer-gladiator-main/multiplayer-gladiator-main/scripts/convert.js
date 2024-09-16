// Import ethers.js (if not already imported)
const { ethers } = require("ethers");

// BNB value you want to convert to Wei
const bnbValue = "0.004245533304222979"; // BNB value as a string

// Convert BNB to Wei using ethers.js
const weiValue = ethers.utils.parseUnits(bnbValue, "ether"); // "ether" here implies 18 decimal places

console.log("BNB value in Wei:", weiValue.toString());
