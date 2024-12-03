const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const Recording = require('./models/Recordings');
const { text2SpeechGPT } = require('./speechToText.js');

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: './uploads',
    filename: function (req, file, cb) {
        // Sanitize filename and ensure it's unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '.mp3');
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1 // Only allow 1 file per request
    },
    fileFilter: (req, file, cb) => {
        // Accept only audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'));
        }
    }
});

// API Routes
app.get('/api/recordings', async (req, res) => {
    try {
        console.log('Fetching recordings...');
        const recordings = await Recording.find()
            .select('title audioFile transcription createdAt')
            .sort({ createdAt: -1 })
            .limit(10);
        
        console.log('Found recordings:', recordings);
        
        res.json({
            success: true,
            recordings: recordings.map(rec => ({
                id: rec._id,
                title: rec.title,
                date: rec.createdAt,
                audioUrl: `/uploads/${rec.audioFile?.filename || ''}`,
                text: rec.transcription?.text || ''
            }))
        });
    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recordings',
            details: error.message 
        });
    }
});

app.post('/upload', upload.single('data'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        console.log('Uploaded file:', req.file);
        console.log('Form data:', req.body);

        // Transcribe audio
        const apiResponse = await text2SpeechGPT({
            filename: req.file.filename,
            path: req.file.path
        });
        console.log('Transcription response:', apiResponse);

        // Save to MongoDB
        const recording = new Recording({
            title: req.body.title || 'Untitled Recording',
            audioFile: {
                filename: req.file.filename,
                path: req.file.path
            },
            transcription: {
                text: apiResponse.text,
                createdAt: new Date()
            }
        });

        const savedRecording = await recording.save();
        console.log('Recording saved:', savedRecording);

        res.json({
            success: true,
            text: apiResponse.text,
            recording: {
                id: savedRecording._id,
                title: savedRecording.title,
                date: savedRecording.createdAt,
                audioUrl: `/uploads/${req.file.filename}`,
                text: apiResponse.text
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        // Clean up uploaded file if there's an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(500).json({ 
            error: 'Upload failed', 
            details: error.message 
        });
    }
});

// Serve static files
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Something broke!',
        details: err.message 
    });
});

// Start server only after DB connection
async function startServer() {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log('Available routes:');
            console.log('- GET  /api/recordings');
            console.log('- POST /upload');
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    app.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 