// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NoInterfaceGamble {
    address public owner;
    uint256 public constant BET_AMOUNT = 0.01 ether;
    uint256 public constant WIN_AMOUNT = 0.1 ether;
    uint256 public constant ODDS = 12;

    event BetResult(address indexed player, bool won, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() payable {
        require(msg.value >= WIN_AMOUNT, "Contract needs initial funds");
        owner = msg.sender;
    }

    receive() external payable {
        require(msg.value == BET_AMOUNT, "Incorrect bet amount");

        bool won = (random() % ODDS) == 0;
        if (won) {
            require(address(this).balance >= WIN_AMOUNT, "Contract doesn't have enough funds");
            payable(msg.sender).transfer(WIN_AMOUNT);
        }

        emit BetResult(msg.sender, won, msg.value);
    }

    function random() private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
    }

    function addFunds() external payable onlyOwner {}

    function withdrawFunds(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough funds");
        payable(owner).transfer(amount);
    }
}
