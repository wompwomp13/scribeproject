const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const Recording = require('./models/Recordings');
const { text2SpeechGPT } = require('./speechToText.js');
const Groq = require('groq-sdk');
require('dotenv').config();

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
        const recordings = await Recording.find()
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json({
            success: true,
            recordings: recordings
        });
    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recordings' 
        });
    }
});

app.post('/upload', upload.single('data'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // Transcribe audio
        const apiResponse = await text2SpeechGPT({
            filename: req.file.filename,
            path: req.file.path
        });

        // If preview mode, just return the transcription
        if (req.query.preview === 'true') {
            // Clean up the uploaded file since we're not saving it yet
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting preview file:', err);
            });
            
            return res.json({
                success: true,
                text: apiResponse.text
            });
        }

        // Save to MongoDB with edited transcription if provided
        const recording = new Recording({
            title: req.body.title || 'Untitled Recording',
            audioFile: {
                filename: req.file.filename,
                path: req.file.path
            },
            transcription: {
                text: req.body.transcription || apiResponse.text,
                createdAt: new Date()
            }
        });

        const savedRecording = await recording.save();

        res.json({
            success: true,
            recording: {
                id: savedRecording._id,
                title: savedRecording.title,
                date: savedRecording.createdAt,
                audioUrl: `/uploads/${req.file.filename}`,
                text: savedRecording.transcription.text
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
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

// Get single recording with notes
app.get('/api/recordings/:id', async (req, res) => {
    try {
        console.log('Fetching recording with ID:', req.params.id);
        const recording = await Recording.findById(req.params.id);
        
        if (!recording) {
            console.log('Recording not found');
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        console.log('Found recording:', recording);
        console.log('Audio file:', recording.audioFile);
        console.log('Transcription:', recording.transcription);

        // Add full URLs for audio file
        const audioUrl = `/uploads/${recording.audioFile.filename}`;
        
        const responseData = {
            success: true,
            recording: {
                _id: recording._id,
                title: recording.title,
                createdAt: recording.createdAt,
                audioFile: {
                    filename: recording.audioFile.filename,
                    path: recording.audioFile.path,
                    url: audioUrl
                },
                transcription: {
                    text: recording.transcription.text,
                    createdAt: recording.transcription.createdAt
                }
            }
        };

        console.log('Sending response:', responseData);
        res.json(responseData);
    } catch (error) {
        console.error('Error fetching recording:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recording',
            details: error.message
        });
    }
});

// Get notes for a recording
app.get('/api/recordings/:id/notes', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        res.json({
            success: true,
            notes: recording.notes[0] || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notes'
        });
    }
});

// Save notes for a recording
app.post('/api/recordings/:id/notes', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        recording.notes = [{
            content: req.body.content,
            timestamp: new Date()
        }];

        await recording.save();

        res.json({
            success: true,
            notes: recording.notes[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to save notes'
        });
    }
});

// Add this new endpoint after your existing routes
app.post('/api/get-definition', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'No text provided'
            });
        }

        const groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a concise academic assistant. Provide brief, clear definitions that are 2-3 sentences maximum. Focus on the most important aspects only. Format your response in a way that's easy to read and understand quickly.

If the term is a concept, start with "A concept in [field] that..." or similar.
If it's a process, start with "The process of..." or similar.
If it's an object or thing, start with "A [type] that..." or similar.

Keep your response under 50 words when possible.`
                },
                {
                    role: "user",
                    content: `Define this term or concept in 2-3 sentences: "${text}"`
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.3,
            max_tokens: 100,
        });

        const definition = completion.choices[0]?.message?.content || "No definition available";
        
        res.json({ success: true, definition });
    } catch (error) {
        console.error('Definition error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to get definition'
        });
    }
});

// Add this with your other routes
app.delete('/api/recordings/:id', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        
        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        // Delete the audio file from uploads directory
        if (recording.audioFile && recording.audioFile.filename) {
            const filePath = path.join(__dirname, 'uploads', recording.audioFile.filename);
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting audio file:', err);
            });
        }

        // Delete the recording from database
        await Recording.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Recording deleted successfully'
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete recording'
        });
    }
});

// Add this new endpoint after your existing routes
app.post('/api/summarize-lecture', async (req, res) => {
    try {
        const { transcription } = req.body;
        if (!transcription) {
            return res.status(400).json({
                success: false,
                error: 'No transcription provided'
            });
        }

        const groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        console.log('Sending request to Groq API...');

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert at summarizing academic lectures. Create clear, well-structured summaries that are easy to understand.
                    Your response MUST be in valid JSON format with the following structure (no additional text, just the JSON object):
                    {
                        "title": "Main topic of the lecture",
                        "overview": "Brief 2-3 sentence overview",
                        "keyPoints": [
                            {
                                "heading": "Key point heading",
                                "details": ["Detail 1", "Detail 2"]
                            }
                        ],
                        "importantConcepts": ["Concept 1", "Concept 2"],
                        "conclusion": "Brief conclusion"
                    }
                    IMPORTANT: Return ONLY the JSON object above, with no markdown formatting or additional text.`
                },
                {
                    role: "user",
                    content: `Create a JSON summary of this lecture: "${transcription}"`
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.3,
            max_tokens: 1000,
        });

        let summary;
        try {
            const content = completion.choices[0]?.message?.content || '';
            console.log('Raw API response:', content);

            // Clean and format the JSON string before parsing
            let jsonStr = content;
            
            // Ensure proper JSON structure
            const fixJsonStructure = (str) => {
                let result = str;
                
                // Find the last closing bracket of each section
                const lastImportantConceptsBracket = str.lastIndexOf(']", "conclusion"');
                const lastKeyPointsBracket = str.lastIndexOf(']}, {');
                
                if (lastImportantConceptsBracket !== -1) {
                    // Fix the importantConcepts array closure
                    result = str.substring(0, lastImportantConceptsBracket + 1) + 
                            ', "conclusion": ' + 
                            str.substring(str.lastIndexOf('"conclusion": ') + 13).replace(/}+$/, '}');
                }

                // Ensure proper object closure
                if (!result.endsWith('}')) {
                    result = result + '}';
                }

                // Remove any trailing commas before closing brackets
                result = result
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/\]\s*\]/g, ']]')
                    .replace(/}\s*}/g, '}}');

                return result;
            };

            // Clean the JSON string
            jsonStr = jsonStr
                // Remove newlines and extra spaces
                .replace(/\s+/g, ' ')
                // Fix any trailing commas
                .replace(/,(\s*[}\]])/g, '$1')
                // Ensure proper string value closure
                .replace(/([:\[,]\s*)"([^"]*?)$/g, '$1"$2"')
                // Fix double conclusions
                .replace(/\],"conclusion":""}/g, '}');

            // Apply final structure fixes
            jsonStr = fixJsonStructure(jsonStr);

            console.log('Cleaned JSON string:', jsonStr);

            try {
                summary = JSON.parse(jsonStr);
                console.log('Successfully parsed JSON:', summary);
            } catch (parseError) {
                console.log('JSON parse error:', parseError);
                console.log('Creating fallback structure...');
                
                // Extract information using regex with improved patterns
                const extractValue = (key) => {
                    const match = content.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
                    return match ? match[1] : null;
                };

                const extractArray = (key) => {
                    const match = content.match(new RegExp(`"${key}"\\s*:\\s*\\[(.*?)\\]`));
                    if (!match) return [];
                    return match[1].split(',')
                        .map(item => item.trim().replace(/^"|"$/g, ''))
                        .filter(Boolean);
                };

                const extractKeyPoints = () => {
                    const keyPointsMatch = content.match(/"keyPoints"\s*:\s*\[(.*?)\](?=\s*,\s*")/);
                    if (!keyPointsMatch) return [{
                        heading: "Main Points",
                        details: []
                    }];

                    try {
                        const keyPointsStr = `[${keyPointsMatch[1]}]`;
                        return JSON.parse(keyPointsStr);
                    } catch {
                        return [{
                            heading: "Main Points",
                            details: []
                        }];
                    }
                };

                summary = {
                    title: extractValue('title') || "Lecture Summary",
                    overview: extractValue('overview') || content.substring(0, 200) + "...",
                    keyPoints: extractKeyPoints(),
                    importantConcepts: extractArray('importantConcepts'),
                    conclusion: extractValue('conclusion') || "Please see the full transcription for more details."
                };
            }
        } catch (error) {
            console.error('Response parsing error:', error);
            throw new Error('Failed to format summary properly');
        }

        // Validate and clean the summary structure
        if (!summary.title || !summary.overview || !Array.isArray(summary.keyPoints)) {
            throw new Error('Invalid summary structure');
        }

        res.json({ 
            success: true, 
            summary 
        });
    } catch (error) {
        console.error('Summarization error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to generate summary'
        });
    }
});

// Add this near your other routes, before the static file middleware
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Keep your existing static file middleware
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Update the lectures route to use lecture-notes.html instead
app.get('/lectures/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lecture-notes.html'));
}); 