const { MongoClient } = require('mongodb');

async function addPointsField() {
    const mongoUri = 'mongodb+srv://dearlola1live:Freshstart222%24@htmlrng.dfoa2e5.mongodb.net/?retryWrites=true&w=majority&appName=htmlrng';
    const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db('gladiatorGame');
        const userProfilesCollection = db.collection('userProfiles');

        // Update all documents to include a 'points' field if it doesn't already exist
        await userProfilesCollection.updateMany(
            { points: { $exists: false } }, // Filter: documents without a 'points' field
            { $set: { points: 0 } }         // Update: add 'points' field with initial value 0
        );

        console.log('Points field added to all user profiles.');
    } catch (error) {
        console.error('Error adding points field:', error);
    } finally {
        await client.close();
    }
}

addPointsField();
