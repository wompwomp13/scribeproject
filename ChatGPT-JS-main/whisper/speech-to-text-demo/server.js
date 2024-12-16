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
                    content: `You are an expert academic lecturer and note-taking specialist. Create detailed, well-structured summaries that serve as comprehensive study materials. Your summaries should be thorough yet concise, highlighting both main concepts and subtle but important details.

                    Your response MUST be in valid JSON format with the following structure:
                    {
                        "title": "Main topic of the lecture",
                        "overview": {
                            "mainThesis": "Core argument or main point of the lecture",
                            "context": "Brief background or context",
                            "significance": "Why this topic matters"
                        },
                        "keyTopics": [
                            {
                                "heading": "Topic heading",
                                "mainPoints": ["Key point 1", "Key point 2"],
                                "details": ["Supporting detail or example"],
                                "relatedConcepts": ["Related terms or ideas"]
                            }
                        ],
                        "conceptualFramework": {
                            "coreTheories": ["List of main theories discussed"],
                            "keyTerms": [
                                {
                                    "term": "Technical term",
                                    "definition": "Brief definition",
                                    "context": "How it's used in this lecture"
                                }
                            ]
                        },
                        "practicalApplications": [
                            {
                                "scenario": "Real-world application",
                                "explanation": "How the concept applies"
                            }
                        ],
                        "connections": {
                            "interdisciplinary": ["Links to other fields"],
                            "prerequisites": ["Important background knowledge"],
                            "futureTopics": ["What this leads to"]
                        },
                        "supplementalInsights": {
                            "historicalContext": "Relevant historical background",
                            "currentDevelopments": "Recent developments or debates",
                            "additionalResources": ["Recommended readings or materials"]
                        },
                        "studyGuide": {
                            "keyHighlights": ["Most important takeaways"],
                            "commonMisconceptions": ["Points that students often misunderstand"],
                            "reviewQuestions": ["Questions for self-review"]
                        },
                        "formatting": {
                            "boldTerms": ["Terms to be displayed in bold"],
                            "highlightedConcepts": ["Concepts to be highlighted"],
                            "colorCoding": [
                                {
                                    "color": "primary",
                                    "items": ["Main concepts"]
                                },
                                {
                                    "color": "secondary",
                                    "items": ["Supporting ideas"]
                                },
                                {
                                    "color": "accent",
                                    "items": ["Examples or applications"]
                                }
                            ]
                        }
                    }

                    Guidelines:
                    1. Break down long lectures into logical sections while maintaining narrative flow
                    2. Include both theoretical concepts and practical applications
                    3. Highlight key terms and their relationships
                    4. Preserve important contextual information
                    5. Include real-world examples and applications
                    6. Note connections to other topics or fields
                    7. Identify potential areas of confusion
                    8. Suggest review questions for self-study
                    
                    For long lectures:
                    1. Identify major theme changes or topic transitions
                    2. Maintain chronological flow while grouping related concepts
                    3. Preserve important examples and case studies
                    4. Note time markers for key points
                    5. Track concept evolution throughout the lecture
                    
                    IMPORTANT: Return ONLY the JSON object above, with no additional text or formatting. Ensure all JSON is properly escaped and valid.`
                },
                {
                    role: "user",
                    content: `Create a comprehensive academic summary of this lecture: "${transcription}"`
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.3,
            max_tokens: 2000,
        });

        // Parse and validate the response
        let summary;
        try {
            const responseText = completion.choices[0]?.message?.content;
            if (!responseText) {
                throw new Error('Empty response from Groq API');
            }

            // First try to parse the response directly
            try {
                summary = JSON.parse(responseText);
            } catch (directParseError) {
                console.error('Direct parse failed, attempting cleanup:', directParseError);
                
                // Clean up the JSON string before parsing
                let cleanedText = responseText
                    .replace(/^\s*```json\s*/, '') // Remove JSON code block markers
                    .replace(/\s*```\s*$/, '')     // Remove ending code block markers
                    .trim();

                // Only apply more aggressive cleaning if needed
                if (!cleanedText.startsWith('{') || !cleanedText.endsWith('}')) {
                    cleanedText = cleanedText
                        .replace(/\n/g, ' ')                 // Remove newlines
                        .replace(/\r/g, '')                  // Remove carriage returns
                        .replace(/\t/g, ' ')                 // Remove tabs
                        .replace(/\s+/g, ' ')                // Normalize spaces
                        .replace(/,\s*([}\]])/g, '$1')       // Remove trailing commas
                        .replace(/([{[,])\s*,/g, '$1')       // Remove empty array elements
                        .replace(/"\s*,\s*([}\]])/g, '"$1')  // Fix trailing commas in objects
                        .trim();

                    // Ensure the string starts and ends with curly braces
                    if (!cleanedText.startsWith('{')) cleanedText = '{' + cleanedText;
                    if (!cleanedText.endsWith('}')) cleanedText = cleanedText + '}';
                }

                try {
                    summary = JSON.parse(cleanedText);
                } catch (cleanParseError) {
                    console.error('Clean parse failed:', cleanParseError);
                    throw cleanParseError; // Let it be caught by the outer catch
                }
            }
            
            // Validate the summary structure
            const requiredFields = [
                'title',
                'overview',
                'keyTopics',
                'conceptualFramework',
                'practicalApplications',
                'connections',
                'supplementalInsights',
                'studyGuide',
                'formatting'
            ];
            
            for (const field of requiredFields) {
                if (!summary[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Ensure arrays are properly initialized
            summary.keyTopics = Array.isArray(summary.keyTopics) ? summary.keyTopics : [];
            summary.conceptualFramework.keyTerms = Array.isArray(summary.conceptualFramework.keyTerms) ? summary.conceptualFramework.keyTerms : [];
            summary.practicalApplications = Array.isArray(summary.practicalApplications) ? summary.practicalApplications : [];
            summary.studyGuide.keyHighlights = Array.isArray(summary.studyGuide.keyHighlights) ? summary.studyGuide.keyHighlights : [];
            summary.studyGuide.commonMisconceptions = Array.isArray(summary.studyGuide.commonMisconceptions) ? summary.studyGuide.commonMisconceptions : [];
            summary.studyGuide.reviewQuestions = Array.isArray(summary.studyGuide.reviewQuestions) ? summary.studyGuide.reviewQuestions : [];

        } catch (error) {
            console.error('Error parsing summary:', error);
            console.error('Raw response:', completion.choices[0]?.message?.content);
            
            // Create a fallback summary structure
            summary = {
                title: "Lecture Summary",
                overview: {
                    mainThesis: "Main points from the lecture",
                    context: "Context of the discussion",
                    significance: "Importance of the topic"
                },
                keyTopics: [{
                    heading: "Key Topics",
                    mainPoints: ["Main points extracted from the lecture"],
                    details: ["Details from the lecture"],
                    relatedConcepts: ["Related concepts discussed"]
                }],
                conceptualFramework: {
                    coreTheories: ["Core theories discussed"],
                    keyTerms: [{
                        term: "Important terms",
                        definition: "Their definitions",
                        context: "How they were used"
                    }]
                },
                practicalApplications: [{
                    scenario: "Practical applications",
                    explanation: "How concepts apply in practice"
                }],
                connections: {
                    interdisciplinary: ["Related fields"],
                    prerequisites: ["Required background"],
                    futureTopics: ["Future learning paths"]
                },
                supplementalInsights: {
                    historicalContext: "Historical background",
                    currentDevelopments: "Current state",
                    additionalResources: ["Additional materials"]
                },
                studyGuide: {
                    keyHighlights: ["Main takeaways"],
                    commonMisconceptions: ["Common misunderstandings"],
                    reviewQuestions: ["Review questions"]
                },
                formatting: {
                    boldTerms: [],
                    highlightedConcepts: [],
                    colorCoding: [
                        {
                            color: "primary",
                            items: ["Main concepts"]
                        }
                    ]
                }
            };
        }

        res.json({
            success: true,
            summary: summary
        });
    } catch (error) {
        console.error('Summarization error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to generate summary'
        });
    }
});

// Add this route to handle transcription updates
app.put('/api/recordings/:id/transcription', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        
        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        recording.transcription.text = req.body.transcription;
        await recording.save();

        res.json({
            success: true,
            message: 'Transcription updated successfully'
        });
    } catch (error) {
        console.error('Error updating transcription:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update transcription'
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