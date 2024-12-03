//https://platform.openai.com/docs/guides/speech-to-text
const fs = require('fs');
const request = require('request');
let express = require('express');
let app = express();
const multer = require('multer');
const OPENAI_API_KEY = require('./config.json')['OpenAIApiKey'];
// const OPENAI_API_KEY = 'Your Key Here';
const path = require('path');

// Add this near the top of your file, after your requires
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}

// Put the dashboard route BEFORE the static middleware
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
});

//serve static files
app.use(express.static(__dirname + '/public'));

//save uploaded files to disk
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname + '.wav')
    }
});
const upload = multer({ storage: storage });

//Local server endpoints
app.post('/upload', upload.any(), async function (req, res) {
    try {
        console.log('Uploaded files to local server: ', req.files);
        const apiResponse = await text2SpeechGPT(req.files[0]);
        res.json(apiResponse);
    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Error processing audio file' });
    }
});

app.listen(3000, function () {
    console.log("Working on port 3000");
});

//Invoke OpenAI API
async function text2SpeechGPT(file) {
    return new Promise((resolve, reject) => {
        const options = {
            method: "POST",
            url: "https://api.openai.com/v1/audio/translations",
            port: 443,
            headers: {
                "Authorization": "Bearer " + OPENAI_API_KEY,
                "Content-Type": "multipart/form-data"
            },
            formData: {
                "file": fs.createReadStream("./uploads/" + file.filename),
                "model": "whisper-1"
            }
        };
        
        request(options, function (err, res, body) {
            if (err) {
                console.error("API Error:", err);
                reject(err);
                return;
            }
            console.log("Received API response:", body);
            resolve(JSON.parse(body));
        });
    });
}