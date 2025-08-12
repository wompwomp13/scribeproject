const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const Recording = require('./models/Recordings');
const { text2SpeechGPT } = require('./speechToText.js');
const Groq = require('groq-sdk');
// Load environment variables
const dotenv = require('dotenv');
// 1) Try local .env inside speech-to-text-demo
dotenv.config();
// 2) Fallback: try parent whisper/.env if GROQ_API_KEY is still missing
if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === '') {
    const parentEnvPath = path.join(__dirname, '../.env');
    dotenv.config({ path: parentEnvPath });
}
const User = require('./models/User');
const Course = require('./models/Course');
const { uploadFile } = require('./utils/dropbox'); // Add Dropbox utility

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

// Configure multer with two storage options
// 1. Disk storage for local development
const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '.mp3');
    }
});

// 2. Memory storage for Dropbox integration
const memoryStorage = multer.memoryStorage();

// Use memory storage if DROPBOX_ENABLED is true, otherwise use disk storage
const isDropboxEnabled = process.env.DROPBOX_ENABLED === 'true' && process.env.DROPBOX_ACCESS_TOKEN && process.env.DROPBOX_ACCESS_TOKEN.length > 10;
console.log(`Dropbox integration is ${isDropboxEnabled ? 'ENABLED' : 'DISABLED'}`);
console.log(`DROPBOX_ENABLED=${process.env.DROPBOX_ENABLED}`);
console.log(`DROPBOX_ACCESS_TOKEN exists: ${Boolean(process.env.DROPBOX_ACCESS_TOKEN)}`);

const storage = isDropboxEnabled ? memoryStorage : diskStorage;

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 250 * 1024 * 1024, // 250MB limit for long lectures
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

        // Get courseId and title from request body
        const courseId = req.body.courseId;
        const lectureTitle = req.body.title || 'Untitled Lecture';
        
        let audioFileUrl;
        let audioFilePath;
        let audioFileName;
        let apiResponse;

        // Preview mode is for chunked transcription during recording
        const isPreviewMode = req.query.preview === 'true';
        console.log(`Upload request: preview mode = ${isPreviewMode ? 'ON' : 'OFF'}`);

        // PREVIEW MODE: Just transcribe and return without saving to database
        if (isPreviewMode) {
            console.log('Processing preview chunk for transcription only');
            
            // Use buffer directly for transcription if available
            if (req.file.buffer) {
                console.log('Using memory buffer directly for transcription');
                // Pass the buffer directly to the transcription function
                apiResponse = await text2SpeechGPT({
                    buffer: req.file.buffer,
                    filename: 'preview.mp3'
                });
            } else {
                // For disk storage, use the existing file path
                console.log('Using file path for transcription:', req.file.path);
                apiResponse = await text2SpeechGPT({
                    path: req.file.path,
                    filename: req.file.filename
                });
                
                // Clean up the temp file if we're using disk storage
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting preview file:', err);
            });
            }
            
            // Return just the transcription
            return res.json({
                success: true,
                text: apiResponse.text
            });
        }
        
        // FINAL UPLOAD: Store the complete lecture recording
        console.log('Processing final upload for complete lecture');
        
        // Format the lecture title to be used as a filename
        const formattedTitle = lectureTitle
            .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace non-alphanumeric chars with underscore
            .replace(/_+/g, '_')            // Collapse multiple underscores
            .replace(/^_|_$/g, '')          // Remove leading/trailing underscores
            .toLowerCase();
            
        // Add timestamp to ensure uniqueness
        const timestamp = Date.now();
        
        // Check if we're using Dropbox or local storage
        if (isDropboxEnabled && req.file.buffer) {
            console.log('Using Dropbox storage for complete lecture audio file');
            
            // Determine the folder path
            const folderPath = courseId ? `courses/${courseId}` : 'general';
            
            // Create filename with title only for Dropbox (no timestamp)
            audioFileName = `${formattedTitle}.mp3`;
            console.log(`Using filename: ${audioFileName}`);
            
            // Upload the complete audio file to Dropbox
            audioFileUrl = await uploadFile(req.file.buffer, audioFileName, folderPath);
            audioFilePath = audioFileUrl; // Store the URL as the path
            
            console.log('File uploaded to Dropbox:', audioFileUrl);
            
            // Check if a transcription was provided in the request
            if (req.body.transcription) {
                console.log('Using provided transcription instead of generating a new one');
                apiResponse = { text: req.body.transcription };
            } else {
                // Transcribe audio without saving temporary file
                console.log('Generating transcription for the complete audio using buffer');
                apiResponse = await text2SpeechGPT({
                    buffer: req.file.buffer,
                    filename: audioFileName
                });
            }
            
        } else {
            console.log('Using local storage for complete lecture audio file');
            
            // Rename the file to include the lecture title for local storage
            const originalPath = req.file.path;
            audioFileName = `${formattedTitle}-${timestamp}.mp3`;
            const newPath = path.join(path.dirname(originalPath), audioFileName);
            
            // Rename the file
            fs.renameSync(originalPath, newPath);
            audioFilePath = newPath;
            audioFileUrl = `/uploads/${audioFileName}`;
            
            console.log(`Renamed file from ${req.file.filename} to ${audioFileName}`);
            
            // Check if a transcription was provided in the request
            if (req.body.transcription) {
                console.log('Using provided transcription instead of generating a new one');
                apiResponse = { text: req.body.transcription };
            } else {
                // Transcribe audio using file path since we already saved it
                console.log('Generating transcription for the complete audio from path');
                apiResponse = await text2SpeechGPT({
                    path: audioFilePath,
                    filename: audioFileName
                });
            }
        }

        // Verify course exists if courseId is provided
        if (courseId) {
            const course = await Course.findById(courseId);
            if (!course) {
                throw new Error('Invalid course selected');
            }
        }

        // Save to MongoDB - notice we store the same structure regardless of storage method
        const recording = new Recording({
            title: lectureTitle,
            audioFile: {
                filename: audioFileName,
                path: audioFilePath,
                isDropbox: isDropboxEnabled  // Flag to indicate if this is a Dropbox URL
            },
            transcription: {
                text: req.body.transcription || apiResponse.text,
                createdAt: new Date()
            },
            class: courseId // This will be undefined if no courseId provided
        });

        const savedRecording = await recording.save();

        // If courseId exists, add recording to course's recordings array
        if (courseId) {
            await Course.findByIdAndUpdate(
                courseId,
                { $push: { recordings: savedRecording._id } }
            );
        }

        res.json({
            success: true,
            recording: {
                id: savedRecording._id,
                title: savedRecording.title,
                date: savedRecording.createdAt,
                audioUrl: audioFileUrl,
                text: savedRecording.transcription.text,
                courseId: courseId
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up local file if needed
        if (!isDropboxEnabled && req.file && req.file.path) {
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
        console.log('Audio file details:', JSON.stringify(recording.audioFile, null, 2));
        
        // Explicitly check for valid dropbox path
        let isDropbox = false;
        if (recording.audioFile.isDropbox === true || 
            (recording.audioFile.path && recording.audioFile.path.includes('dropbox'))) {
            isDropbox = true;
            console.log('This is a Dropbox recording');
        }

        // Construct the audio URL based on storage type
        let audioUrl;
        if (isDropbox) {
            // If stored in Dropbox, use the path directly as the URL
            audioUrl = recording.audioFile.path;
            console.log('Using Dropbox URL:', audioUrl);
        } else {
            // If stored locally, use the /uploads/ path
            audioUrl = `/uploads/${recording.audioFile.filename}`;
            console.log('Using local URL:', audioUrl);
        }
        
        const responseData = {
            success: true,
            recording: {
                _id: recording._id,
                title: recording.title,
                createdAt: recording.createdAt,
                audioFile: {
                    filename: recording.audioFile.filename,
                    path: recording.audioFile.path,
                    url: audioUrl,
                    isDropbox: isDropbox
                },
                transcription: {
                    text: recording.transcription.text,
                    createdAt: recording.transcription.createdAt
                }
            }
        };

        console.log('Sending response with audioFile:', JSON.stringify(responseData.recording.audioFile, null, 2));
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
            model: "llama-3.1-8b-instant",
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

        // Create Groq client without redeclaring the variable
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        console.log('Sending request to Groq API for lecture summarization...');

        const systemPrompt = 
            `You are an expert academic lecturer and note-taking specialist. Create detailed, well-structured summaries that serve as comprehensive study materials.

IMPORTANT: YOUR RESPONSE MUST BE VALID JSON WITHOUT ANY MARKDOWN CODE BLOCKS OR BACKTICKS. DO NOT WRAP THE JSON IN \`\`\`json or \`\`\` TAGS.

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
                        }
                    }

                    Guidelines:
1. Break down long lectures into logical sections
                    2. Include both theoretical concepts and practical applications
                    3. Highlight key terms and their relationships
                    4. Preserve important contextual information
5. Do NOT use any markdown formatting or code blocks
6. Return ONLY valid JSON without backticks or tags`;

        const userPrompt = `Create a comprehensive academic summary of this lecture: "${transcription}"`;

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            max_tokens: 2000,
        });

        // Parse and validate the response
        let summary;
        try {
            const responseText = completion.choices[0]?.message?.content;
            console.log('Raw response from Groq:', responseText);
            
            if (!responseText) {
                throw new Error('Empty response from Groq API');
            }

            // First, check if the response contains a code block and extract it
            if (responseText.includes('```')) {
                // Handle markdown code blocks first
                const codeBlockMatch = responseText.match(/```(?:json)?([\s\S]*?)```/);
                if (codeBlockMatch && codeBlockMatch[1]) {
                    try {
                        summary = JSON.parse(codeBlockMatch[1].trim());
                        console.log('Successfully parsed JSON from code block');
                    } catch (codeBlockError) {
                        console.error('Code block parse failed:', codeBlockError);
                        // Continue to other parsing attempts
                    }
                }
            }

            // If code block parsing didn't work, try parsing directly
            if (!summary) {
            try {
                summary = JSON.parse(responseText);
                    console.log('Successfully parsed JSON directly');
            } catch (directParseError) {
                console.error('Direct parse failed, attempting cleanup:', directParseError);
                    
                    // Try to find JSON object in the response
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            summary = JSON.parse(jsonMatch[0]);
                            console.log('Successfully parsed JSON using regex match');
                        } catch (matchParseError) {
                            console.error('Match parse failed:', matchParseError);
                
                // Clean up the JSON string before parsing
                let cleanedText = responseText
                                .replace(/```(?:json)?/g, '') // Remove all code block markers
                                .replace(/^\s*\{/, '{')       // Ensure clean opening brace
                                .replace(/\}\s*$/, '}')       // Ensure clean closing brace
                    .trim();

                            try {
                                summary = JSON.parse(cleanedText);
                                console.log('Successfully parsed JSON after removing code blocks');
                            } catch (cleanParseError) {
                                console.error('Clean parse failed, attempting more aggressive cleanup:', cleanParseError);
                                
                                // More aggressive cleaning
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

                try {
                    summary = JSON.parse(cleanedText);
                                    console.log('Successfully parsed JSON after aggressive cleanup');
                                } catch (aggressiveCleanParseError) {
                                    console.error('Aggressive clean parse failed:', aggressiveCleanParseError);
                                    console.error('Raw cleaned text:', cleanedText);
                                    throw new Error('Failed to parse summary data from model response');
                                }
                            }
                        }
                    } else {
                        throw new Error('No JSON object found in response');
                    }
                }
            }
            
            // Validate the summary structure
            const requiredFields = [
                'title',
                'overview',
                'keyTopics',
                'practicalApplications',
                'studyGuide'
            ];
            
            const missingFields = [];
            for (const field of requiredFields) {
                if (!summary[field]) {
                    missingFields.push(field);
                    console.error(`Missing required field in summary: ${field}`);
                }
            }
            
            if (missingFields.length > 0) {
                throw new Error(`Summary is missing required fields: ${missingFields.join(', ')}`);
            }

            // Ensure arrays are properly initialized
            summary.keyTopics = Array.isArray(summary.keyTopics) ? summary.keyTopics : [];
            
            if (summary.conceptualFramework) {
                summary.conceptualFramework.keyTerms = Array.isArray(summary.conceptualFramework.keyTerms) 
                    ? summary.conceptualFramework.keyTerms 
                    : [];
            } else {
                summary.conceptualFramework = { keyTerms: [] };
            }
            
            summary.practicalApplications = Array.isArray(summary.practicalApplications) ? summary.practicalApplications : [];
            
            // Ensure studyGuide and its properties are initialized
            if (!summary.studyGuide) {
                summary.studyGuide = {};
            }
            
            summary.studyGuide.keyHighlights = Array.isArray(summary.studyGuide.keyHighlights) 
                ? summary.studyGuide.keyHighlights 
                : [];
                
            summary.studyGuide.commonMisconceptions = Array.isArray(summary.studyGuide.commonMisconceptions) 
                ? summary.studyGuide.commonMisconceptions 
                : [];
                
            summary.studyGuide.reviewQuestions = Array.isArray(summary.studyGuide.reviewQuestions) 
                ? summary.studyGuide.reviewQuestions 
                : [];

            // Create connections if missing
            if (!summary.connections) {
                summary.connections = {
                    interdisciplinary: [],
                    prerequisites: [],
                    futureTopics: []
                };
            }

            // Create supplementalInsights if missing
            if (!summary.supplementalInsights) {
                summary.supplementalInsights = {
                    historicalContext: "",
                    currentDevelopments: "",
                    additionalResources: []
                };
            }

            // Generate a title if none exists
            if (!summary.title || summary.title.trim() === "") {
                summary.title = "Lecture Summary";
            }

            // Ensure overview fields exist
            if (!summary.overview) {
                summary.overview = {};
            }
            
            if (!summary.overview.mainThesis || summary.overview.mainThesis.trim() === "") {
                summary.overview.mainThesis = "Main points from the lecture";
            }
            
            if (!summary.overview.context || summary.overview.context.trim() === "") {
                summary.overview.context = "Context of the discussion";
            }
            
            if (!summary.overview.significance || summary.overview.significance.trim() === "") {
                summary.overview.significance = "Importance of the topic";
            }

            console.log('Validated summary structure successfully');

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
                    boldTerms: ["Important terms"],
                    highlightedConcepts: ["Key concepts"],
                    colorCoding: [
                        {
                            color: "primary",
                            items: ["Main concepts"]
                        }
                    ]
                }
            };
            
            // Add error information for debugging
            summary.error = {
                message: error.message,
                type: "parsing_error"
            };
        }

        res.json({
            success: true,
            summary: summary
        });
        
    } catch (error) {
        console.error('API error in /api/summarize-lecture:', error);
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

// Serve files from uploads directory
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

// Add these routes before your existing routes

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const query = {};
        if (req.query.role) {
            query.role = req.query.role;
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });
            
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new user
app.post('/api/users', async (req, res) => {
    try {
        const user = await User.create(req.body);
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({ success: true, user: userResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { name, email, role, courses, status } = req.body;
        
        // Find the user
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update basic info
        user.name = name;
        user.email = email;
        user.role = role;
        if (status) user.status = status;

        // Handle course assignments
        if (courses) {
            // Get current courses
            const currentCourses = new Set(user.courses.map(c => c.toString()));
            const newCourses = new Set(courses);

            // Find courses to remove and add
            const coursesToRemove = [...currentCourses].filter(c => !newCourses.has(c));
            const coursesToAdd = [...newCourses].filter(c => !currentCourses.has(c));

            // Update user's courses
            user.courses = courses;

            // If user is a teacher, update the courses' instructor field
            if (role === 'teacher') {
                // Remove instructor from courses they're no longer assigned to
                for (const courseId of coursesToRemove) {
                    await Course.findByIdAndUpdate(courseId, {
                        $unset: { instructor: "" }
                    });
                }

                // Add instructor to new courses
                for (const courseId of coursesToAdd) {
                    await Course.findByIdAndUpdate(courseId, {
                        instructor: user._id
                    });
                }
            }
        }

        await user.save();

        res.json({
            success: true,
            user: await User.findById(user._id).populate('courses')
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update the courses endpoint
app.get('/api/courses', async (req, res) => {
    try {
        console.log('Fetching courses from database...');
        const courses = await Course.find({})
            .populate('instructor', 'name email') // Populate instructor data
            .lean();
        
        console.log('Raw courses data:', courses); // Debug log
        
        if (!courses || courses.length === 0) {
            console.log('No courses found in database');
            return res.json({
                success: true,
                courses: []
            });
        }

        const formattedCourses = courses.map(course => ({
            _id: course._id.toString(),
            name: course.name || 'Unnamed Course',
            code: course.code || 'NO_CODE',
            description: course.description || '',
            instructor: course.instructor ? course.instructor.name : 'TBA'
            // Schedule information intentionally omitted
        }));

        console.log('Formatted courses:', formattedCourses); // Debug log
        
        res.json({ 
            success: true, 
            courses: formattedCourses
        });
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch courses',
            details: error.message 
        });
    }
});

// Create new course
app.post('/api/courses', async (req, res) => {
    try {
        const course = await Course.create(req.body);
        res.json({ success: true, course });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update course
app.put('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // If updating instructor
        if (req.body.instructor) {
            const instructor = await User.findById(req.body.instructor);
            if (!instructor) {
                return res.status(404).json({ success: false, message: 'Instructor not found' });
            }

            if (instructor.role !== 'teacher') {
                return res.status(400).json({
                    success: false,
                    message: 'Only teachers can be assigned as instructors'
                });
            }

            // Add this course to instructor's courses if not already present
            if (!instructor.courses.includes(course._id)) {
                instructor.courses.push(course._id);
                await instructor.save();
            }
        }

        // Update course
        Object.assign(course, req.body);
        await course.save();

        res.json({
            success: true,
            course: {
                _id: course._id,
                code: course.code,
                name: course.name,
                instructor: course.instructor ? course.instructor.name : 'TBA'
            }
        });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete course
app.delete('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Don't delete Physics 101
        if (course.code === 'PHY101') {
            return res.status(403).json({ error: 'Cannot delete template course' });
        }

        // Delete all recordings associated with this course
        await Recording.deleteMany({ class: course._id });

        // Delete the course using findByIdAndDelete instead of remove()
        await Course.findByIdAndDelete(course._id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add these routes before your static file middleware

// Handle dynamic course pages
app.get('/course/:id', (req, res) => {
    // Check if it's Physics 101 (keep existing functionality)
    if (req.params.id === 'physics101') {
        res.sendFile(path.join(__dirname, 'public', 'course1.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'course-template.html'));
    }
});

// Handle teacher course pages
app.get('/tcourse/:id', (req, res) => {
    // Check if it's Physics 101 (keep existing functionality)
    if (req.params.id === 'physics101') {
        res.sendFile(path.join(__dirname, 'public', 'tclass1.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'course-template.html'));
    }
});

// Add API endpoint to get course details
app.get('/api/course/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('instructor', 'name');
        
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        res.json({ 
            success: true, 
            course: {
                _id: course._id,
                code: course.code,
                name: course.name,
                description: course.description || '',
                instructor: course.instructor ? course.instructor.name : 'TBA'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this route before your static file middleware
app.get('/tcourse/:courseId', (req, res) => {
    // For Physics 101, use the original file
    if (req.params.courseId === 'physics101') {
        res.sendFile(path.join(__dirname, 'public', 'tclass1.html'));
    } else {
        // For other courses, use the template
        res.sendFile(path.join(__dirname, 'public', 'course-template.html'));
    }
});

// Add this route to get recordings for a specific course
app.get('/api/courses/:courseId/recordings', async (req, res) => {
    try {
        const recordings = await Recording.find({ 
            class: req.params.courseId 
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            recordings: recordings
        });
    } catch (error) {
        console.error('Error fetching course recordings:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recordings' 
        });
    }
});

// Add this route to get active courses for the current user
app.get('/api/user/courses', async (req, res) => {
    try {
        // In a real app, you would get the current user's ID from the session
        // For now, we'll return all active courses
        const courses = await Course.find({ status: 'active' })
            .select('name code')
            .sort({ code: 1 });
        
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test route to verify database connection and course retrieval
app.get('/api/test/courses', async (req, res) => {
    try {
        const courses = await Course.find().lean();
        res.json({
            success: true,
            count: courses.length,
            courses: courses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Add this route for testing
app.get('/api/courses/debug', async (req, res) => {
    try {
        console.log('Debug: Fetching courses...');
        const courses = await Course.find({}).lean();
        
        console.log('Debug: Raw courses found:', courses);
        
        const formattedCourses = courses.map(course => ({
            _id: course._id.toString(),
            name: course.name || 'Unnamed Course',
            code: course.code || 'NO_CODE',
            description: course.description || ''
        }));
        
        console.log('Debug: Formatted courses:', formattedCourses);
        
        res.json({
            success: true,
            count: formattedCourses.length,
            courses: formattedCourses
        });
    } catch (error) {
        console.error('Debug: Error fetching courses:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Add this new route for preview transcriptions
app.post('/upload/preview', upload.single('data'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        console.log('Processing preview file:', req.file.path);

        // Transcribe audio for preview
        const apiResponse = await text2SpeechGPT({
            filename: req.file.filename,
            path: req.file.path
        });

        // Clean up the preview file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting preview file:', err);
        });
        
        res.json({
            success: true,
            text: apiResponse.text
        });
    } catch (error) {
        console.error('Preview error:', error);
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        res.status(500).json({ 
            error: 'Preview failed', 
            details: error.message 
        });
    }
});

// Get single course details
app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('instructor', 'name email')
            .lean();
        
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                error: 'Course not found' 
            });
        }

        // Format the response
        const formattedCourse = {
            _id: course._id.toString(),
            name: course.name || 'Unnamed Course',
            code: course.code || 'NO_CODE',
            description: course.description || '',
            instructor: course.instructor ? course.instructor.name : 'TBA'
        };

        res.json(formattedCourse);
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch course details',
            details: error.message 
        });
    }
});

// Get recordings for a specific course
app.get('/api/courses/:courseId/recordings', async (req, res) => {
    try {
        const recordings = await Recording.find({ class: req.params.courseId })
            .sort({ createdAt: -1 })
            .lean();
        
        // Format the recordings
        const formattedRecordings = recordings.map(recording => ({
            _id: recording._id.toString(),
            title: recording.title || 'Untitled Recording',
            date: recording.createdAt,
            audioUrl: `/uploads/${recording.audioFile.filename}`,
            transcript: recording.transcription.text
        }));

        res.json(formattedRecordings);
    } catch (error) {
        console.error('Error fetching course recordings:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recordings',
            details: error.message 
        });
    }
});

// Handle student course pages
app.get('/scourse/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scourse.html'));
});

// Initialize admin user (add this near other initialization code)
async function initializeAdminUser() {
    try {
        const adminEmail = 'admin@scribe.edu'; // Must match the email in admin-access.js
        
        // Check if admin user already exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log('Admin user already exists');
            
            // Ensure the user has admin role
            if (existingAdmin.role !== 'admin') {
                existingAdmin.role = 'admin';
                existingAdmin.isVerified = true;
                existingAdmin.status = 'active';
                await existingAdmin.save();
                console.log('Updated existing user to admin role');
            }
            return;
        }
        
        // Create admin user if it doesn't exist
        const adminUser = new User({
            name: 'Admin User',
            email: adminEmail,
            password: 'admin123', // You should change this to a strong password
            schoolId: 'ADMIN001',
            role: 'admin',
            isVerified: true,
            status: 'active'
        });
        
        await adminUser.save();
        console.log('Created admin user:', adminEmail);
    } catch (error) {
        console.error('Error initializing admin user:', error);
    }
}

// Start server only after DB connection
async function startServer() {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log('Available routes:');
            console.log('- GET  /api/recordings');
            console.log('- POST /upload');
            
            // Initialize admin user after server starts
            initializeAdminUser();
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

// Add this new endpoint after your summarize-lecture endpoint
app.post('/api/extract-key-terms', async (req, res) => {
    try {
        const { transcription, lectureTitle } = req.body;

        if (!transcription) {
            return res.status(400).json({
                success: false,
                error: 'No transcription provided'
            });
        }

        const groqClient = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        // First, clean up the transcript
        const cleanupPrompt = `Clean this lecture transcript by:
1. Fixing grammar and spelling errors
2. Removing filler words (um, uh, like, you know)
3. Fixing any transcription errors or incomplete sentences
4. Maintaining ALL original content and meaning
5. Keeping the same level of detail and information
6. Preserving technical terms and specific examples

DO NOT:
- Summarize or shorten the content
- Remove any key information
- Change technical terminology
- Alter the lecture's structure
- Add any introductory phrases or explanations
- Include phrases like "here's the transcript" or "here's the cleaned version"

IMPORTANT: Return ONLY the cleaned transcript text. Do not add any introductory text, explanations, or conclusions.

Transcript: ${transcription}`;

        const cleanupCompletion = await groqClient.chat.completions.create({
            messages: [
                { role: "system", content: "You are a transcript editor that returns ONLY the cleaned transcript without any additional text or explanations." },
                { role: "user", content: cleanupPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.1,
            max_tokens: 2048,
        });

        const cleanedTranscript = cleanupCompletion.choices[0]?.message?.content;

        // Now, structure the transcript into sections and identify key terms
        const sectioningPrompt = `Divide this lecture transcript into 5 logical sections. For each section:
1. Identify a key educational term or concept that:
   - Is important for understanding the section
   - Is likely to be new or unfamiliar to students
   - Can be visually represented (can find relevant images for it)
   - Is specific enough to be educational (not too common or generic)
   - Appears explicitly in the text

2. Extract a concise explanation of that term from the section (1-2 paragraphs maximum)

IMPORTANT: 
- Each key term should be visually representable (consider whether images would be available for this term)
- Avoid very common or generic terms (like "science" or "research")
- Avoid overly complex or obscure terms that would be difficult to find images for
- Prioritize terms that have educational value
- Do not include terms that don't appear directly in the text

Format your response as valid JSON with this structure:
{
  "sections": [
    {
      "term": "The key educational term",
      "explanation": "Concise explanation of the term from the section",
      "context": "The surrounding text where the term appears (1-2 paragraphs)"
    },
    ...
  ]
}

Cleaned Transcript:
${cleanedTranscript}`;

        const sectioningCompletion = await groqClient.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are an educational content parser that structures lecture content into sections with key visual learning terms. Return ONLY valid JSON with the structure specified in the prompt." 
                },
                { role: "user", content: sectioningPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            max_tokens: 2048,
        });

        // Parse the structured sections with error handling
        let sectionsData;
        try {
            const responseContent = sectioningCompletion.choices[0]?.message?.content || '';
            
            // Try to extract JSON from the response (in case it's wrapped in code blocks)
            let jsonContent = responseContent;
            
            // Check if response is wrapped in markdown code blocks
            if (responseContent.includes('```')) {
                const match = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match && match[1]) {
                    jsonContent = match[1];
                }
            }
            
            // Parse the JSON
            sectionsData = JSON.parse(jsonContent);
            
            // Validate sections
            if (!sectionsData.sections || !Array.isArray(sectionsData.sections) || sectionsData.sections.length === 0) {
                throw new Error('Invalid sections data: missing or empty sections array');
            }
            
            // Extract terms
            const keyTerms = sectionsData.sections
                .map(section => section.term)
                .filter(Boolean)
                .slice(0, 5);
                
            // Validate we have terms
            if (keyTerms.length === 0) {
                throw new Error('No valid key terms found in the sections');
            }
            
            // Ensure each term appears in the transcript
            const validTerms = keyTerms.filter(term => {
                const regex = new RegExp(term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
                return regex.test(cleanedTranscript);
            });
            
            if (validTerms.length === 0) {
                throw new Error('No valid terms found in the transcript');
            }
            
            res.json({
                success: true,
                keyTerms: validTerms,
                cleanedTranscript,
                sections: sectionsData.sections
            });
            
        } catch (error) {
            console.error('Error processing sections:', error);
            console.error('Raw response:', sectioningCompletion.choices[0]?.message?.content);
            
            // Fall back to the original method if sectioning fails
            const termsPrompt = `From this lecture transcript, identify exactly 5 key terms that:
1. Appear word-for-word in the text
2. Are concrete objects or specific educational concepts
3. Can be easily illustrated with images
4. Are important to understanding the lecture content
5. Are sophisticated enough to have educational value (not too basic)

Avoid terms that are:
- Too generic (like "science" or "research")
- Too complex or obscure to find relevant images for
- Not visually representable
- Not directly mentioned in the text

Output ONLY a JSON array of 5 terms, like this: ["term1", "term2", "term3", "term4", "term5"]
Do not include any explanation or additional text.

Transcript:
${cleanedTranscript}`;

            const termsCompletion = await groqClient.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                        content: "You are a JSON generator that returns ONLY a valid JSON array of 5 terms. No other text." 
                },
                    { role: "user", content: termsPrompt }
            ],
                model: "llama-3.1-8b-instant",
                temperature: 0.1,
            max_tokens: 1024,
        });

            // Clean up the response to ensure valid JSON
            const response = termsCompletion.choices[0]?.message?.content;
            const cleanedResponse = response.trim()
                .replace(/^```json\s*/, '')
                .replace(/\s*```$/, '')
                .replace(/^[\s\n]*\[/, '[')
                .replace(/\][\s\n]*$/, ']');

            try {
                const keyTerms = JSON.parse(cleanedResponse);
                // Verify terms appear in transcript
                const validTerms = keyTerms.filter(term => {
                    const regex = new RegExp(term, 'i');
                    return regex.test(cleanedTranscript);
                }).slice(0, 5);

                if (validTerms.length === 0) {
                    throw new Error('No valid terms found in the transcript');
                }

        res.json({
            success: true,
                    keyTerms: validTerms,
                    cleanedTranscript,
                    // Create basic sections as fallback
                    sections: validTerms.map(term => ({
                        term: term,
                        explanation: `This is an important concept related to ${term}.`,
                        context: cleanedTranscript.substring(
                            Math.max(0, cleanedTranscript.toLowerCase().indexOf(term.toLowerCase()) - 100),
                            cleanedTranscript.toLowerCase().indexOf(term.toLowerCase()) + term.length + 200
                        )
                    }))
                });
    } catch (error) {
                console.error('Failed to parse terms response:', error);
                throw new Error('Failed to extract key terms from the transcript');
            }
        }
    } catch (error) {
        console.error('Error in extract-key-terms endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process transcript',
            details: error.message
        });
    }
});

// Add this new endpoint for flashcard generation
app.post('/api/generate-flashcards', async (req, res) => {
    try {
        const { transcription, lectureTitle } = req.body;

        if (!transcription) {
            return res.status(400).json({
                success: false,
                error: 'No transcription provided'
            });
        }

        const groqClient = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        // Generate flashcards content
        const flashcardsPrompt = `Create a set of educational flashcards based on this lecture transcription.

        Generate 10-15 flashcards that cover the most important concepts, definitions, and key points from the lecture.

        Return the flashcards in this JSON format WITHOUT ANY ADDITIONAL TEXT:
{
    "flashcards": [
        {
                    "front": "Term or concept (question)",
                    "back": "Definition or explanation (answer)",
                    "category": "Assign a logical category like 'Definition', 'Concept', 'Process', etc."
                },
                // More flashcards following the same structure...
            ]
        }
        
        IMPORTANT GUIDELINES:
        1. Ensure the front side is concise (question/term)
        2. The back side should be comprehensive but concise (answer/explanation)
        3. Assign a meaningful category to each flashcard
        4. Cover a variety of important topics from the lecture
        5. Return ONLY valid JSON, nothing else
        6. DO NOT include any explanatory text before or after the JSON
        
        Lecture Title: ${lectureTitle || "Lecture"}
Lecture Content: ${transcription}`;

        const completion = await groqClient.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are an educational content specialist who creates study materials. Return ONLY valid JSON in the specified format with no additional text." 
                },
                { role: "user", content: flashcardsPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            max_tokens: 2048,
        });

        let flashcardsData;
        const responseContent = completion.choices[0]?.message?.content || '';
        
        try {
            // First attempt: direct parsing
            flashcardsData = JSON.parse(responseContent);
        } catch (parseError) {
            console.error('Initial JSON parse error:', parseError);
            
            try {
                // Second attempt: Try to extract JSON if wrapped in backticks
                const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    flashcardsData = JSON.parse(jsonMatch[1]);
                } else {
                    // Third attempt: Try to use regex to extract flashcards
                    const extractedFlashcards = extractFlashcardsFromText(responseContent);
                    if (extractedFlashcards.length > 0) {
                        flashcardsData = { flashcards: extractedFlashcards };
                    } else {
                        throw new Error('Could not extract valid flashcards from response');
                    }
                }
            } catch (extractError) {
                console.error('Failed to extract flashcards:', extractError);
                throw new Error('Failed to generate valid flashcard data');
            }
        }

        // Validate flashcards structure
        if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards) || flashcardsData.flashcards.length === 0) {
            throw new Error('Invalid flashcards data structure or empty flashcards array');
        }

        res.json({
            success: true,
            flashcards: flashcardsData.flashcards
        });

    } catch (error) {
        console.error('API error in /api/generate-flashcards:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate flashcards'
        });
    }
});

function extractFlashcardsFromText(text) {
    // ... existing function ...
}

// Add these routes before your existing routes

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, schoolId, role, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { schoolId }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'User with this email or school ID already exists' 
            });
        }

        // Create new user
        const user = await User.create({
            name,
            email,
            schoolId,
            role,
            password,
            status: 'pending',
            isVerified: false
        });

        res.json({
            success: true,
            message: 'Registration successful',
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Check password
        if (user.password !== password) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        res.json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Add user verification endpoint
app.post('/api/users/:userId/verify', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user verification status
        user.isVerified = true;
        user.status = 'active';
        await user.save();

        res.json({
            success: true,
            message: 'User verified successfully',
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get current user endpoint
app.get('/api/auth/current-user', async (req, res) => {
    try {
        // In a real app, you would get this from the session
        // For now, we'll get it from a cookie or query param
        const userEmail = req.cookies?.userEmail || req.query.userEmail;
        
        if (!userEmail) {
            return res.status(401).json({
                success: false,
                message: 'No user logged in'
            });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update the get user's courses endpoint to include more details
app.get('/api/users/:id/courses', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate({
                path: 'courses',
                populate: {
                    path: 'instructor',
                    select: 'name email'
                }
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // For each course, get the count of students and recordings
        const coursesWithCounts = await Promise.all(user.courses.map(async course => {
            const studentsCount = await User.countDocuments({
                role: 'student',
                courses: course._id
            });

            const recordingsCount = await Recording.countDocuments({
                class: course._id
            });

            return {
                ...course.toObject(),
                studentCount: studentsCount,
                recordingsCount: recordingsCount
            };
        }));

        res.json({
            success: true,
            courses: coursesWithCounts
        });
    } catch (error) {
        console.error('Error fetching user courses:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}); 

// Add this new endpoint to format transcripts with markdown
app.post('/api/format-transcript', async (req, res) => {
    try {
        const { transcription } = req.body;
        if (!transcription) {
            return res.status(400).json({
                success: false,
                error: 'No transcription provided'
            });
        }

        // Create Groq client without redeclaring the variable
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const formatPrompt = `Format this lecture transcript to improve readability. 
        
Guidelines:
1. Add clear headers for main topics (use # for main headers and ## for subheaders)
2. Break walls of text into logical paragraphs (short paragraphs preferred)
3. Keep bullet points if they exist
4. Do not add or remove any actual content
5. Do not add key points, summaries, or any additional content
6. Keep spacing minimal - use only one blank line between paragraphs
7. Use markdown sparingly - don't make everything bold or italic

Original Transcript:
${transcription}

IMPORTANT: Return ONLY the formatted transcript text with minimal markdown. Do not add any introductory text, explanations, summaries, or conclusions.`;

        const formatCompletion = await groqClient.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a transcript formatter that returns ONLY the formatted version of the transcript using minimal markdown for better readability. Keep the exact content, just improve the formatting by adding headers and organizing into paragraphs. No summaries or key points should be added." 
                },
                { role: "user", content: formatPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            max_tokens: 2048,
        });

        // Extract the formatted transcript, handling any possible markdown code blocks
        let formattedTranscript = formatCompletion.choices[0]?.message?.content;
        
        // Check if the response is wrapped in a code block and extract it if so
        if (formattedTranscript && formattedTranscript.includes('```')) {
            const codeBlockMatch = formattedTranscript.match(/```(?:markdown)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
                formattedTranscript = codeBlockMatch[1];
            }
        }

        res.json({
            success: true,
            formattedTranscript
        });

    } catch (error) {
        console.error('Transcript formatting error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to format transcript',
            details: error.message
        });
    }
});

// Add this new endpoint to get raw transcript from MongoDB
app.get('/api/recordings/:id/raw-transcript', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id);
        
        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        // Return the raw transcript without any processing
        res.json({
            success: true,
            rawTranscript: recording.transcription.text
        });
    } catch (error) {
        console.error('Error fetching raw transcript:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch raw transcript',
            details: error.message
        });
    }
});

// Add this new endpoint for image search (to replace direct Serper API calls in the client)
app.post('/api/search-image', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'No search query provided'
            });
        }
        
        // Set up Serper API headers
        const headers = new Headers();
        headers.append("X-API-KEY", process.env.SERPER_API_KEY || "8ef3d1c3d162936e1361df119ae1fa56c75db388");
        headers.append("Content-Type", "application/json");
        
        const requestOptions = {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                "q": query,
                "gl": "us",
                "hl": "en"
            })
        };
        
        // Make request to Serper API
        const response = await fetch("https://google.serper.dev/images", requestOptions);
        
        if (!response.ok) {
            throw new Error(`Serper API error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        
        // Check if the response contains images
        if (responseData?.images?.length > 0) {
            const image = responseData.images[0];
            const imageUrl = image.imageUrl || image.image || image.link || image.thumbnail;
            
            res.json({
                success: true,
                imageUrl: imageUrl
            });
        } else {
            res.json({
                success: false,
                error: 'No images found for the query'
            });
        }
    } catch (error) {
        console.error('Image search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search for images',
            details: error.message
        });
    }
});

// Add quiz generation endpoint
app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { transcription, lectureTitle } = req.body;

        if (!transcription) {
            return res.status(400).json({
                success: false,
                error: 'No transcription provided'
            });
        }

        const groqClient = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        // Generate quiz content
        const quizPrompt = `Create an educational quiz based on this lecture transcription. Generate TWO different quiz types:

1. A Drag-and-Drop Categorization Quiz:
   - Provide 3-4 categories
   - Create 8-10 items that need to be sorted into the correct categories
   - Each item should clearly belong to one specific category

2. A Multiple-Choice Quiz:
   - Create 5-8 multiple-choice questions
   - Each question should have four answer choices (A, B, C, D)
   - Clearly indicate which answer is correct

Return the quiz in this JSON format WITHOUT ANY ADDITIONAL TEXT:
{
    "categorization": {
        "categories": ["category1", "category2", "category3"],
        "items": [
            { "text": "item1", "category": "category1" },
            { "text": "item2", "category": "category2" },
            // 8-10 items total
        ]
    },
    "multipleChoice": {
        "questions": [
            {
                "question": "Question text?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correctAnswer": 0,  // Index of correct answer (0-3)
                "explanation": "Explanation of why this answer is correct and the educational context."
            },
            // 5-8 questions total
        ]
    }
}

IMPORTANT:
- Both quiz types should test understanding of the most important concepts from the lecture
- Return ONLY valid JSON, nothing else
- DO NOT include any explanatory text before or after the JSON
- DO NOT wrap the JSON in markdown code blocks or backticks
- The response must be parseable directly with JSON.parse()

Lecture Title: ${lectureTitle || "Lecture"}
Lecture Content: ${transcription}`;

        const completion = await groqClient.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are an educational content specialist who creates interactive quizzes based on lecture materials. Return ONLY valid JSON in the specified format with no additional text." 
                },
                { role: "user", content: quizPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            max_tokens: 2048,
        });

        let quizData;
        const responseContent = completion.choices[0]?.message?.content || '';
        
        try {
            // First attempt: direct parsing
            quizData = JSON.parse(responseContent);
        } catch (parseError) {
            console.error('Initial JSON parse error:', parseError);
            
            try {
                // Second attempt: Try to extract JSON if wrapped in backticks
                const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    quizData = JSON.parse(jsonMatch[1]);
                } else {
                    throw new Error('Could not extract valid JSON from response');
                }
            } catch (extractError) {
                console.error('Failed to extract JSON:', extractError);
                throw new Error('Failed to generate valid quiz data');
            }
        }

        // Validate quiz structure
        if (!quizData.categorization || !quizData.multipleChoice) {
            throw new Error('Invalid quiz data structure');
        }

        res.json({
            success: true,
            quiz: quizData
        });
        
    } catch (error) {
        console.error('API error in /api/generate-quiz:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to generate quiz'
        });
    }
});

// Add a new endpoint for fixing Dropbox recordings
app.get('/admin/fix-dropbox-recordings', async (req, res) => {
    try {
        console.log('Running migration to fix Dropbox recordings...');
        
        // Find all recordings with paths that include "dropbox"
        const recordings = await Recording.find({
            'audioFile.path': { $regex: 'dropbox', $options: 'i' }
        });
        
        console.log(`Found ${recordings.length} recordings with Dropbox paths`);
        
        let updatedCount = 0;
        
        // Update each recording
        for (const recording of recordings) {
            console.log(`Fixing recording "${recording.title}" (${recording._id})`);
            console.log('Current audioFile:', JSON.stringify(recording.audioFile, null, 2));
            
            // Make sure the dropbox flag is set
            if (!recording.audioFile.isDropbox) {
                recording.audioFile.isDropbox = true;
                updatedCount++;
                
                console.log('Updated isDropbox flag');
            }
            
            // Convert www.dropbox to dl.dropboxusercontent.com if needed
            if (recording.audioFile.path && recording.audioFile.path.includes('www.dropbox.com')) {
                const updatedPath = recording.audioFile.path
                    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                    .replace('?dl=0', '');
                
                console.log(`Converting path from ${recording.audioFile.path} to ${updatedPath}`);
                recording.audioFile.path = updatedPath;
                updatedCount++;
            }
            
            // Save the changes
            await recording.save();
        }
        
        res.json({
            success: true,
            message: `Fixed ${updatedCount} issues across ${recordings.length} recordings`
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            error: 'Migration failed',
            details: error.message
        });
    }
});

// Add an endpoint to fix a specific recording by title
app.get('/admin/fix-recording-by-title/:title', async (req, res) => {
    try {
        const title = req.params.title;
        console.log(`Attempting to fix recording with title containing: "${title}"`);
        
        // Find recordings with matching title (case insensitive)
        const titleRegex = new RegExp(title, 'i');
        const recordings = await Recording.find({
            title: titleRegex
        });
        
        if (recordings.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No recordings found with title containing "${title}"`
            });
        }
        
        console.log(`Found ${recordings.length} matching recordings`);
        const fixedRecordings = [];
        
        // Process each matching recording
        for (const recording of recordings) {
            console.log(`Processing recording: "${recording.title}" (${recording._id})`);
            console.log('Current audioFile:', JSON.stringify(recording.audioFile, null, 2));
            
            // Check if this is a Dropbox file based on path
            const isDropboxPath = recording.audioFile.path && 
                                  recording.audioFile.path.includes('dropbox');
            
            if (isDropboxPath && !recording.audioFile.isDropbox) {
                // Fix Dropbox flag
                recording.audioFile.isDropbox = true;
                console.log('Set isDropbox flag to true');
            }
            
            // Convert www.dropbox to dl.dropboxusercontent.com if needed
            if (recording.audioFile.path && recording.audioFile.path.includes('www.dropbox.com')) {
                const updatedPath = recording.audioFile.path
                    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                    .replace('?dl=0', '');
                
                console.log(`Converted path from ${recording.audioFile.path} to ${updatedPath}`);
                recording.audioFile.path = updatedPath;
            }
            
            // If the filename is a Dropbox URL but saved incorrectly, fix it
            if (recording.audioFile.filename && recording.audioFile.filename.includes('dropbox')) {
                console.log('Filename contains Dropbox URL, fixing...');
                // Extract the actual filename from the path
                const pathParts = recording.audioFile.path.split('/');
                const actualFilename = pathParts[pathParts.length - 1].split('?')[0];
                recording.audioFile.filename = actualFilename;
                console.log(`Set filename to ${actualFilename}`);
            }
            
            // Save changes
            await recording.save();
            fixedRecordings.push({
                id: recording._id,
                title: recording.title,
                audioFile: recording.audioFile
            });
        }
        
        res.json({
            success: true,
            message: `Fixed ${fixedRecordings.length} recordings`,
            recordings: fixedRecordings
        });
    } catch (error) {
        console.error('Fix recording error:', error);
        res.status(500).json({
            success: false,
            error: 'Fix operation failed',
            details: error.message
        });
    }
});

// Email verification for password reset
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if user exists with this email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        // Return success if user exists
        return res.json({
            success: true,
            message: 'Email verified'
        });
    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during email verification'
        });
    }
});

// Reset password route
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate inputs
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user's password (no need for bcrypt as requested)
        user.password = password;
        await user.save();

        return res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during password reset'
        });
    }
});