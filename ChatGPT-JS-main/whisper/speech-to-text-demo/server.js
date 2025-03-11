const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const Recording = require('./models/Recordings');
const { text2SpeechGPT } = require('./speechToText.js');
const Groq = require('groq-sdk');
require('dotenv').config();
const User = require('./models/User');
const Course = require('./models/Course');

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

        // Get courseId from request body
        const courseId = req.body.courseId;

        // Transcribe audio
        const apiResponse = await text2SpeechGPT({
            filename: req.file.filename,
            path: req.file.path
        });

        // If preview mode, just return the transcription
        if (req.query.preview === 'true') {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting preview file:', err);
            });
            
            return res.json({
                success: true,
                text: apiResponse.text
            });
        }

        // Verify course exists if courseId is provided
        if (courseId) {
            const course = await Course.findById(courseId);
            if (!course) {
                throw new Error('Invalid course selected');
            }
        }

        // Save to MongoDB
        const recording = new Recording({
            title: req.body.title || 'Untitled Recording',
            audioFile: {
                filename: req.file.filename,
                path: req.file.path
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
                audioUrl: `/uploads/${req.file.filename}`,
                text: savedRecording.transcription.text,
                courseId: courseId
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

        // Construct the audio URL
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
            instructor: course.instructor || null,
            status: course.status || 'active'
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
            course: await Course.findById(course._id).populate('instructor', 'name email')
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

        res.json({ success: true, course });
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
            instructor: course.instructor ? course.instructor.name : 'TBA',
            schedule: course.schedule || 'Schedule TBA'
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

        const groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        // Update the cleanup prompt to be more specific
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

        const cleanupCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a transcript editor that returns ONLY the cleaned transcript without any additional text or explanations." },
                { role: "user", content: cleanupPrompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.1,
            max_tokens: 2048,
        });

        const cleanedTranscript = cleanupCompletion.choices[0]?.message?.content;

        // Extract key terms that appear in the transcript
        const termsPrompt = `From this lecture transcript, identify exactly 3 key terms that:
1. Appear word-for-word in the text
2. Are concrete objects or specific concepts
3. Can be illustrated with images
4. Are important to the lecture content

Transcript:
${cleanedTranscript}

IMPORTANT: Return ONLY a valid JSON array with exactly 3 terms, like this: ["term1", "term2", "term3"]
Do not include any explanation or additional text.`;

        const termsCompletion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a JSON generator that returns ONLY a valid JSON array of 3 terms. No other text." 
                },
                { role: "user", content: termsPrompt }
            ],
            model: "mixtral-8x7b-32768",
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
            });

            if (validTerms.length !== 3) {
                throw new Error('Terms not found in transcript');
            }

            res.json({
                success: true,
                keyTerms: validTerms,
                cleanedTranscript
            });
        } catch (error) {
            console.error('Failed to parse response:', cleanedResponse);
            throw new Error('Invalid response format from AI');
        }

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process transcript',
            details: error.message
        });
    }
});

// Add this new endpoint for kinesthetic learning
app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { transcription, lectureTitle } = req.body;

        if (!transcription) {
            return res.status(400).json({
                success: false,
                error: 'No transcription provided'
            });
        }

        const groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        // First, determine the best quiz type
        const quizTypePrompt = `Analyze this lecture and determine the most appropriate quiz type from these options:
1. Matching: Match key terms to their definitions
2. Sorting: Arrange events in chronological order
3. Categorization: Group items into categories

Consider:
- The lecture content and structure
- The type of information presented
- The learning objectives

Lecture Title: ${lectureTitle}
Transcript: ${transcription}

Return ONLY ONE of these three words: "matching", "sorting", or "categorization"`;

        const quizTypeCompletion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a quiz type analyzer. Return only one word: matching, sorting, or categorization." 
                },
                { role: "user", content: quizTypePrompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.1,
            max_tokens: 50,
        });

        const quizType = quizTypeCompletion.choices[0]?.message?.content.trim().toLowerCase();

        // Now generate the quiz content based on the type
        let quizPrompt;
        switch (quizType) {
            case 'matching':
                quizPrompt = `Create a matching quiz based on this lecture. Generate exactly 6 pairs of terms and definitions that are important to the lecture content.

Return the quiz in this JSON format:
{
    "type": "matching",
    "pairs": [
        {"term": "term1", "definition": "definition1"},
        {"term": "term2", "definition": "definition2"},
        // etc...
    ]
}

Lecture: ${transcription}`;
                break;

            case 'sorting':
                quizPrompt = `Create a chronological sorting quiz based on this lecture. Generate exactly 6 events that should be arranged in order.

Return the quiz in this JSON format:
{
    "type": "sorting",
    "events": [
        {"text": "event1", "order": 1},
        {"text": "event2", "order": 2},
        // etc...
    ]
}

Lecture: ${transcription}`;
                break;

            case 'categorization':
                quizPrompt = `Create a categorization quiz based on this lecture. Generate 3 categories and 6 items that should be sorted into these categories.

Return the quiz in this JSON format:
{
    "type": "categorization",
    "categories": ["category1", "category2", "category3"],
    "items": [
        {"text": "item1", "category": "category1"},
        {"text": "item2", "category": "category2"},
        // etc...
    ]
}

Lecture: ${transcription}`;
                break;

            default:
                throw new Error('Invalid quiz type determined');
        }

        const quizCompletion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a quiz generator. Return only valid JSON in the specified format." 
                },
                { role: "user", content: quizPrompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.3,
            max_tokens: 1024,
        });

        // Parse and validate the quiz content
        const quizContent = JSON.parse(quizCompletion.choices[0]?.message?.content);

        res.json({
            success: true,
            quizType: quizType,
            quiz: quizContent
        });

    } catch (error) {
        console.error('Quiz generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate quiz',
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

        const groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY 
        });

        // Generate flashcards content
        const flashcardsPrompt = `Create educational flashcards based on this lecture. Generate 8 flashcards that cover the most important concepts, definitions, and key points.

Each flashcard should have:
1. A clear, concise question or term on the front
2. A comprehensive but concise answer or explanation on the back
3. A category label (e.g., "Definition", "Concept", "Process", "Example")

Return the flashcards in this JSON format:
{
    "flashcards": [
        {
            "front": "question or term",
            "back": "answer or explanation",
            "category": "category label"
        },
        // ... more flashcards
    ]
}

Make sure the flashcards:
- Cover the most important information
- Are clear and easy to understand
- Progress from basic to more complex concepts
- Include a mix of different types of questions

Lecture Title: ${lectureTitle}
Lecture Content: ${transcription}`;

        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a flashcard generator. Return only valid JSON in the specified format." 
                },
                { role: "user", content: flashcardsPrompt }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.3,
            max_tokens: 1024,
        });

        // Parse and validate the flashcards content
        const flashcardsContent = JSON.parse(completion.choices[0]?.message?.content);

        res.json({
            success: true,
            flashcards: flashcardsContent.flashcards
        });

    } catch (error) {
        console.error('Flashcard generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate flashcards',
            details: error.message
        });
    }
});

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