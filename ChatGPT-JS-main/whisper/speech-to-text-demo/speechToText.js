const fs = require('fs');
const request = require('request');
const apiKey = process.env.OPENAI_API_KEY;

async function text2SpeechGPT(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.path) {
            reject(new Error('Invalid file'));
            return;
        }

        const options = {
            method: "POST",
            url: "https://api.openai.com/v1/audio/translations",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "multipart/form-data"
            },
            formData: {
                "file": fs.createReadStream(file.path),
                "model": "whisper-1"
            }
        };
        
        request(options, function (err, res, body) {
            if (err) {
                console.error("API Error:", err);
                reject(err);
                return;
            }
            
            try {
                const response = JSON.parse(body);
                console.log("Whisper API response:", response);
                resolve(response);
            } catch (parseError) {
                console.error("Error parsing API response:", parseError);
                reject(parseError);
            }
        });
    });
}

module.exports = { text2SpeechGPT };