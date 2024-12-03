const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        
        // Update these with your actual MongoDB Atlas credentials
        const username = "jerichomalik13";
        const password = encodeURIComponent("PASSWORDPLEASE"); // URL encode the password
        const cluster = "scribe.qzjxl.mongodb.net";
        const database = "Scribe";
        
        const uri = `mongodb+srv://${username}:${password}@${cluster}/${database}?retryWrites=true&w=majority`;
        
        console.log('Attempting connection with URI:', uri.replace(password, 'XXXXX'));
        
        await mongoose.connect(uri, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            },
            dbName: 'Scribe'
        });
        
        // Connection state check
        const state = mongoose.connection.readyState;
        console.log('MongoDB connection state:', {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        }[state]);
        
        // Send a ping to confirm connection
        await mongoose.connection.db.admin().command({ ping: 1 });
        console.log("MongoDB Connected Successfully to Scribe Database!");
        
        // Log available collections for debugging
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Available collections:", collections.map(c => c.name));
        
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        // Log more details about the error
        if (err.code === 8000) {
            console.error('Authentication failed. Please check your username and password.');
        }
        process.exit(1);
    }
};

// Add connection event listeners
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

// Handle application termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
});

module.exports = connectDB;