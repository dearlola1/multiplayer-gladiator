require('dotenv').config();

const express = require('express');
const cors = require('cors'); // Import cors
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const Web3 = require('web3');
const fs = require('fs'); // Import fs to read the ABI file

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors()); // Enable CORS for all routes

// Serve static files with proper MIME type for .js files
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.use(bodyParser.json());

let gladiators = [];
let players = [];
let countdownStarted = false;
let combatPhase = false;
let totalPlayersAtStart = 0; // Variable to store total players at the start of combat
let gameEnded = false; // Flag to track if the game has ended

let gameState = {
    gladiators: gladiators,
    running: false,
    timer: 0,
};

const mongoUri = 'mongodb+srv://dearlola1live:Freshstart222%24@htmlrng.dfoa2e5.mongodb.net/?retryWrites=true&w=majority&appName=htmlrng';
const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

let userProfilesCollection;

async function connectToMongo() {
    await client.connect();
    const db = client.db('gladiatorGame');
    userProfilesCollection = db.collection('userProfiles');
    console.log('Connected to MongoDB');
}

connectToMongo().catch(console.error);

const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545');

// Load the correct ABI from the GameSkinNFT.json file
const gameSkinABI = JSON.parse(fs.readFileSync('artifacts/contracts/GameSkinNFT.sol/GameSkinNFT.json')).abi;
const gameSkinAddress = '0xAD1Fa648792f139826589a5B8c183451A27a5356';
const gameSkinNFT = new web3.eth.Contract(gameSkinABI, gameSkinAddress);

function resetGame() {
    gladiators.forEach(g => broadcast({ type: 'remove', id: g.id }));
    gladiators = [];
    players = [];
    countdownStarted = false;
    combatPhase = false;
    gameEnded = false; // Reset gameEnded flag when the game is reset
    totalPlayersAtStart = 0; // Reset totalPlayersAtStart when the game is reset
    gameState = { gladiators: gladiators, running: false, timer: 0 };
    broadcast({ type: 'init', gladiators: gameState.gladiators });
}

function broadcast(data) {
    data.timestamp = Date.now();
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                const broadcastData = JSON.stringify(data, (key, value) => {
                    if (key === 'target') return undefined;
                    return value;
                });
                client.send(broadcastData);
            } catch (err) { console.error('Error broadcasting:', err); }
        }
    });
}

function broadcastGameState() {
    const gladiatorsCopy = JSON.parse(JSON.stringify(gameState.gladiators, (key, value) => {
        if (key === 'target') return undefined;
        return value;
    }));
    broadcast({ type: 'update', gladiators: gladiatorsCopy });
}

setInterval(broadcastGameState, 5000);

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', async (message) => {
        console.log('Message received:', message);
        try {
            const data = JSON.parse(message);
            if (data.type === 'chat') {
                if (!data.username) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Please log in first.' }));
                    return;
                }
                broadcast({ type: 'chat', username: data.username, message: data.message });
                if (data.message === '!join') {
                    handleJoin(ws, data.username);
                }
            } else if (data.type === 'login') {
                await handleLogin(ws, data.address);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    // Send the current game state to the new client
    ws.send(JSON.stringify({ type: 'init', gladiators: JSON.parse(JSON.stringify(gameState.gladiators, (key, value) => {
        if (key === 'target') return undefined;
        return value;
    })) }));
});

async function handleLogin(ws, address) {
    try {
        console.log(`Handling login for address: ${address}`);
        let userProfile = await userProfilesCollection.findOne({ address: address });
        if (!userProfile) {
            const username = `User_${new Date().getTime()}`;
            userProfile = { address: address, username: username, skin: 'frogman.fbx', points: 0 };
            await userProfilesCollection.insertOne(userProfile);
        }

        // Calculate the user's rank and total number of users in the database
        const totalUsers = await userProfilesCollection.countDocuments(); // totalRegisteredPlayers calculated here
        const rank = await userProfilesCollection.countDocuments({ points: { $gt: userProfile.points } }) + 1;

        ws.send(JSON.stringify({
            type: 'profile',
            profile: { ...userProfile, rank: rank, totalRegisteredPlayers: totalUsers } // Ensure consistent naming
        }));
    } catch (error) {
        console.error(`Error in handleLogin for address ${address}:`, error.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle login' }));
    }
}


async function handleJoin(ws, username) {
    try {
        if (gameState.running) {
            ws.send(JSON.stringify({ type: 'chat', username: 'Server', message: 'Game is currently in progress. Please wait for the next round.' }));
            return;
        }
        if (players.includes(username)) {
            ws.send(JSON.stringify({ type: 'chat', username: 'Server', message: 'You have already joined the game.' }));
            return;
        }
        const userProfile = await userProfilesCollection.findOne({ username: username });
        const id = gladiators.length + 1;
        const skin = userProfile.skin || 'frogman.fbx';

        console.log(`Creating gladiator for username: ${username} with skin: ${skin}`);  // Log the gladiator's skin

        const position = { x: Math.random() * 40 - 20, y: 1.5, z: Math.random() * 40 - 20 };
        const gladiator = { 
            id, 
            name: username, 
            health: 50, 
            position, 
            skin, 
            rotation: 0, 
            state: 'frogmanidle', 
            target: null, 
            attackCooldown: 0, 
            kills: 0,  // Track kills during the game 
            points: 0  // Accumulate points here
        };

        if (!gladiators.some(g => g.name === username)) {
            gladiators.push(gladiator);
            players.push(username);
            broadcast({ type: 'init', gladiators: JSON.parse(JSON.stringify(gameState.gladiators, (key, value) => {
                if (key === 'target') return undefined;
                return value;
            })) });
        }

        if (players.length >= 1 && !countdownStarted) {
            gameState.timer = 15;
            countdownStarted = true;
            broadcast({ type: 'countdown', timer: gameState.timer });
            addTestBots(2);
            startCombatCountdown();
        }
    } catch (error) {
        console.error('Error in handleJoin:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'An error occurred while joining the game. Please try again.' }));
    }
}

function addTestBots(count) {
    for (let i = 0; i < count; i++) {
        const id = gladiators.length + 1;
        const skin = 'frogman.fbx';
        const position = { x: Math.random() * 40 - 20, y: 1.5, z: Math.random() * 40 - 20 };
        const testBot = { id, name: `TEST BOT ${id}`, health: 50, position, skin, rotation: 0, state: 'frogmanidle', target: null, attackCooldown: 0 };

        if (!gladiators.some(g => g.name === `TEST BOT ${id}`)) {
            gladiators.push(testBot);
            players.push(`TEST BOT ${id}`);
            broadcast({ type: 'init', gladiators: JSON.parse(JSON.stringify(gameState.gladiators, (key, value) => {
                if (key === 'target') return undefined;
                return value;
            })) });
        }
    }
}

function startCombatCountdown() {
    const interval = setInterval(() => {
        gameState.timer -= 1;
        broadcast({ type: 'countdown', timer: gameState.timer });
        if (gameState.timer <= 0) {
            clearInterval(interval);
            if (players.length >= 1) {
                totalPlayersAtStart = gladiators.length; // Store the number of players at the start of combat
                console.log(`Combat starting with ${totalPlayersAtStart} players.`); // Log the total number of players at the start
                gameState.running = true;
                broadcast({ type: 'start' });
                startCombat();
            } else {
                gameState.running = false;
                broadcast({ type: 'chat', username: 'Server', message: 'Not enough players to start combat.' });
                resetGame();
            }
        }
    }, 1000);
}

function startCombat() {
    combatPhase = true;
    runGameLoop();
}

function runGameLoop() {
    const interval = setInterval(() => {
        if (!gameState.running) {
            clearInterval(interval);
            return;
        }
        gladiators.forEach(gladiator => {
            if (gladiator.health > 0 && combatPhase) {
                if (gladiator.attackCooldown > 0) {
                    gladiator.attackCooldown -= 1.0 / 30.0;
                }

                if (gladiator.target && gladiator.target.health > 0) {
                    const distance = calculateDistance(gladiator.position, gladiator.target.position);
                    if (distance <= 3) {
                        if (gladiator.attackCooldown <= 0) {
                            gladiator.state = 'frogmanpunch';
                            gladiator.attackCooldown = 1.8;
                            handleAttack(gladiator, gladiator.target);
                        }
                    } else {
                        gladiator.state = 'frogmanrunning';
                        moveTowards(gladiator, gladiator.target.position);
                    }
                } else {
                    gladiator.target = findClosestTarget(gladiator);
                    if (gladiator.target) {
                        gladiator.state = 'frogmanrunning';
                    } else {
                        gladiator.state = 'frogmanidle';
                    }
                }
            }
        });
        try {
            broadcastGameState();
        } catch (error) {
            console.error('Error broadcasting game state:', error);
        }
        checkEndGame();
    }, 1000 / 30);
}

function calculateDistance(pos1, pos2) {
    return Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) +
        Math.pow(pos1.y - pos2.y, 2) +
        Math.pow(pos1.z - pos2.z, 2)
    );
}

function findClosestTarget(gladiator) {
    let closestTarget = null;
    let closestDistance = Infinity;
    gladiators.forEach(otherGladiator => {
        if (gladiator.id !== otherGladiator.id && otherGladiator.health > 0) {
            const distance = calculateDistance(gladiator.position, otherGladiator.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTarget = otherGladiator;
            }
        }
    });
    return closestTarget;
}

function handleAttack(attacker, target) {
    const attackRange = 3;
    const distance = calculateDistance(attacker.position, target.position);

    if (distance <= attackRange) {
        let damage = Math.floor(Math.random() * 5) + 3;
        target.health -= damage;
        if (target.health <= 0) {
            target.health = 0;
            handleRemove(target.id);

            // Ensure kills is a valid number before incrementing
            if (typeof attacker.kills !== 'number') {
                attacker.kills = 0;
            }
            attacker.kills += 1;
            console.log(`Kill registered. Attacker: ${attacker.name}, Total Kills: ${attacker.kills}`);

            // Regenerate HP for the attacker
            const regenPercentage = Math.random() * 0.2 + 0.3; // Random value between 0.3 and 0.5
            const regenAmount = Math.floor(50 * regenPercentage); // 50 is the max HP
            attacker.health = Math.min(attacker.health + regenAmount, 50); // Ensure HP doesn't exceed max HP
            broadcast({ type: 'heal', gladiatorId: attacker.id, amount: regenAmount }); // Broadcast the healing event

            // Accumulate points for the kill
            attacker.points += 1;
        }
        broadcast({ type: 'attack', attackerId: attacker.id, targetId: target.id, damage: damage });
    } else {
        moveTowards(attacker, target.position);
        attacker.state = 'frogmanrunning';
    }
}

function moveTowards(gladiator, targetPosition) {
    const direction = { x: targetPosition.x - gladiator.position.x, z: targetPosition.z - gladiator.position.z };
    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    direction.x /= length;
    direction.z /= length;
    gladiator.position.x += direction.x * 0.1;
    gladiator.position.z += direction.z * 0.1;
    gladiator.rotation = Math.atan2(direction.x, direction.z);
}

function handleRemove(id) {
    const gladiatorIndex = gladiators.findIndex(g => g.id === id);
    if (gladiatorIndex !== -1) {
        const gladiator = gladiators[gladiatorIndex];
        broadcast({ type: 'remove', id: id });

        // Remove the gladiator from the array
        gladiators.splice(gladiatorIndex, 1);

        // Reassign targets only to the gladiators who had this one as a target
        gladiators.forEach(g => {
            if (g.target && g.target.id === id) {
                g.target = findClosestTarget(g);
                g.state = g.target ? 'frogmanrunning' : 'frogmanidle';
            }
        });

        checkEndGame();
    }
}


function reassignTargets() {
    gladiators.forEach(gladiator => {
        if (gladiator.health > 0) {
            gladiator.target = findClosestTarget(gladiator);
            if (gladiator.target) {
                gladiator.state = 'frogmanrunning';
            } else {
                gladiator.state = 'frogmanidle';
            }
        }
    });
}

async function checkEndGame() {
    const aliveGladiators = gladiators.filter(g => g.health > 0);
    if (aliveGladiators.length <= 1 && !gameEnded) {  // Check if there's only one or none left
        gameEnded = true; // Set the gameEnded flag to true
        gameState.running = false;
        combatPhase = false;
        const winner = aliveGladiators[0];

        if (winner) {
            console.log(`Calculating bonus points with totalPlayersAtStart: ${totalPlayersAtStart}`);
            const bonusPoints = totalPlayersAtStart * 10;  // Calculate bonus points based on the number of players at the start
            console.log(`Winner is ${winner.name}. Awarding ${bonusPoints} bonus points.`);

            winner.points += bonusPoints;  // Add bonus points to winner

            try {
                await updatePoints(winner.name, winner.points);
                console.log(`Final total points for ${winner.name}: ${winner.points}`);

                // Recalculate the rank and total registered players after updating the points
                const totalRegisteredPlayers = await userProfilesCollection.countDocuments();
                const rank = await userProfilesCollection.countDocuments({ points: { $gt: winner.points } }) + 1;

                // Send the updated profile, rank, and totalRegisteredPlayers to the winner
                const userProfile = await userProfilesCollection.findOne({ username: winner.name });
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN && client.profile && client.profile.username === winner.name) {
                        client.send(JSON.stringify({
                            type: 'profile',
                            profile: userProfile,
                            rank: rank,
                            totalRegisteredPlayers: totalRegisteredPlayers
                        }));
                    }
                });
            } catch (error) {
                console.error(`Error updating points for ${winner.name}:`, error.message);
            }
        } else {
            console.log('No winner could be determined.');
        }

        broadcast({ type: 'chat', username: 'Server', message: `Game ended. Winner: ${winner ? winner.name : 'No one'}` });
        broadcast({ type: 'end', winner: winner ? winner.name : 'No one' });

        clearInterval(broadcastGameStateInterval);

        setTimeout(() => {
            resetGame();
            broadcastGameStateInterval = setInterval(broadcastGameState, 5000);
        }, 5000);
    }
}


async function updatePoints(username, points) {
    try {
        const profile = await userProfilesCollection.findOne({ username: username });
        if (!profile) {
            console.log(`No profile found for gladiator: ${username}`);
            return;
        }
        const updatedPoints = (profile.points || 0) + points;
        const updateResult = await userProfilesCollection.updateOne(
            { username: username },
            { $set: { points: updatedPoints } }
        );
        if (updateResult.modifiedCount > 0) {
            console.log(`Updated points for ${username}. Total Points: ${updatedPoints}`);
            const totalRegisteredPlayers = await userProfilesCollection.countDocuments();
            const rank = await userProfilesCollection.countDocuments({ points: { $gt: updatedPoints } }) + 1;
            broadcast({ type: 'pointsUpdate', address: profile.address, points: updatedPoints, rank, totalRegisteredPlayers });
        } else {
            console.log(`No points update was made for ${username}.`);
        }
    } catch (error) {
        console.error(`Error updating points for ${username}:`, error.message);
    }
}


app.get('/getHighScores', async (req, res) => {
    try {
        // Fetch all users from the database, no limit
        const highScores = await userProfilesCollection.find({})
            .sort({ points: -1 }) // Sort by points in descending order
            .toArray();
        res.json(highScores);
    } catch (error) {
        console.error('Error fetching high scores:', error.message);
        res.status(500).json({ error: 'Failed to fetch high scores' });
    }
});


let broadcastGameStateInterval = setInterval(broadcastGameState, 5000);

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/getProfile', async (req, res) => {
    const { address } = req.query;
    try {
        const profile = await userProfilesCollection.findOne({ address: address });
        if (!profile) {
            console.log(`Profile not found for address: ${address}`);
            res.status(404).json({ error: 'Profile not found' });
        } else {
            res.json(profile);
        }
    } catch (error) {
        console.error('Error fetching profile:', error.message);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.post('/updateProfile', async (req, res) => {
    const { address, username, skin } = req.body;
    
    console.log(`Updating profile for address: ${address} with username: ${username} and skin: ${skin}`);  // Log the profile data

    try {
        const result = await userProfilesCollection.updateOne(
            { address: address },
            { $set: { username: username, skin: skin } }
        );
        if (result.modifiedCount > 0) {
            console.log(`Profile updated for address: ${address}, username: ${username}, skin: ${skin}`);
            broadcast({ type: 'profileUpdate', address: address, username: username, skin: skin });
            res.json({ success: true });
        } else {
            console.log(`No changes made to profile for address: ${address}`);
            res.json({ success: false });
        }
    } catch (error) {
        console.error('Error updating profile:', error.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// New Routes to handle NFT functionality

app.get('/getOwnedNFTs', async (req, res) => {
    const { address } = req.query;
  
    try {
        console.log(`Fetching NFTs for address: ${address}`);
  
        // Fetch NFTs owned by the user
        const ownedNFTs = await gameSkinNFT.methods.walletOfOwner(address).call();
        console.log('Owned NFTs:', ownedNFTs);
  
        // Check if the response is an array and log an error if not
        if (!Array.isArray(ownedNFTs)) {
            console.error("Unexpected response: walletOfOwner did not return an array.");
            return res.status(500).json({ success: false, error: 'Failed to fetch owned NFTs' });
        }
  
        // If the array is empty, log and return a clear message
        if (ownedNFTs.length === 0) {
            console.log(`No NFTs found for address: ${address}`);
            return res.status(200).json({ success: true, nfts: [] });
        }
  
        // Fetch details for each NFT
        const nftDetails = await Promise.all(
            ownedNFTs.map(async (tokenId) => {
                try {
                    const tokenURI = await gameSkinNFT.methods.tokenURI(tokenId).call();
                    console.log(`Token ID: ${tokenId}, Token URI: ${tokenURI}`);
                    return { tokenId, tokenURI };
                } catch (err) {
                    console.error(`Failed to fetch tokenURI for tokenId ${tokenId}:`, err);
                    return null;
                }
            })
        );
  
        const filteredNftDetails = nftDetails.filter(nft => nft !== null);
  
        res.json(filteredNftDetails);
    } catch (error) {
        console.error('Error fetching owned NFTs:', error.message, error.stack);
        res.status(500).json({ success: false, error: 'Failed to fetch owned NFTs' });
    }
});

app.get('/getAvailableNFTs', async (req, res) => {
    try {
        const availableNFTs = [];
        const maxTokenId = await gameSkinNFT.methods.nextTokenId().call(); // Use nextTokenId to get the upper limit for token IDs

        console.log(`Total NFTs in contract: ${maxTokenId}`);

        for (let tokenId = 0; tokenId < maxTokenId; tokenId++) { // Iterate from 0 to nextTokenId - 1
            try {
                const owner = await gameSkinNFT.methods.ownerOf(tokenId).call();
                console.log(`Owner of Token ID ${tokenId}: ${owner}`);
                if (owner === gameSkinAddress) { // Assuming the NFTs are owned by the contract when listed for sale
                    const tokenURI = await gameSkinNFT.methods.tokenURI(tokenId).call();
                    const price = await gameSkinNFT.methods.tokenPrices(tokenId).call();
                    console.log(`NFT for sale - Token ID: ${tokenId}, Price: ${price}`);
                    availableNFTs.push({ tokenId, tokenURI, price, contractAddress: gameSkinAddress });
                }
            } catch (err) {
                console.error(`Failed to fetch details for tokenId ${tokenId}. It may have been burned or is invalid. Skipping...`);
            }
        }

        if (availableNFTs.length === 0) {
            console.log('No available NFTs found');
            return res.status(404).json({ success: false, error: 'No available NFTs found' });
        }

        res.json(availableNFTs);
    } catch (error) {
        console.error('Error fetching available NFTs:', error.message, error.stack);
        res.status(500).json({ success: false, error: 'Failed to fetch available NFTs' });
    }
});

// Route to purchase an NFT
app.post('/purchaseNFT', async (req, res) => {
    const { address, tokenId } = req.body;

    try {
        const price = await gameSkinNFT.methods.tokenPrices(tokenId).call();
        console.log(`Attempting to purchase NFT with tokenId ${tokenId} for price ${price} by address ${address}`);
        await gameSkinNFT.methods.purchaseNFT(tokenId).send({ from: address, value: price });
        console.log(`NFT with tokenId ${tokenId} successfully purchased by address ${address}`);
        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Error purchasing NFT:', error.message, error.stack);
        res.status(500).send({ success: false, error: 'Failed to purchase NFT' });
    }
});

// Route to list an NFT for sale
app.post('/listNFTForSale', async (req, res) => {
    const { address, tokenId, price } = req.body;

    try {
        console.log(`Listing NFT with tokenId ${tokenId} for sale by address ${address} with price ${price}`);
        await gameSkinNFT.methods.listNFTForSale(tokenId, price).send({ from: address });
        console.log(`NFT with tokenId ${tokenId} successfully listed for sale by address ${address}`);
        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Error listing NFT for sale:', error.message, error.stack);
        res.status(500).send({ success: false, error: 'Failed to list NFT for sale' });
    }
});

// Route to mint a new NFT (only available for admin)
app.post('/mintNFT', async (req, res) => {
    const { address, tokenURI } = req.body;

    try {
        console.log(`Minting new NFT for address ${address} with tokenURI ${tokenURI}`);
        await gameSkinNFT.methods.mint(address, tokenURI).send({ from: address });
        console.log(`Successfully minted new NFT for address ${address} with tokenURI ${tokenURI}`);
        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Error minting NFT:', error.message, error.stack);
        res.status(500).send({ success: false, error: 'Failed to mint NFT' });
    }
});

// Start the server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${server.address().port}`);
});
