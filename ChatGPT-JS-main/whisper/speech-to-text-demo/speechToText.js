const fs = require('fs');
const request = require('request');
const path = require('path');

// Load API key from environment variables
// No longer using config.json
require('dotenv').config();
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY not found in environment variables');
}

/**
 * Converts audio to text using OpenAI's Whisper API
 * @param {Object} options - Options object
 * @param {string} [options.path] - File path (legacy support)
 * @param {Buffer} [options.buffer] - Audio data as buffer
 * @param {string} options.filename - Original filename for content-type detection
 * @returns {Promise<Object>} - Translation response
 */
async function text2SpeechGPT(options) {
    return new Promise((resolve, reject) => {
        if (!options) {
            reject(new Error('Invalid options'));
            return;
        }

        // Check if we have a buffer or need to use a file path
        const hasBuffer = options.buffer && Buffer.isBuffer(options.buffer);
        const hasPath = options.path && fs.existsSync(options.path);
        
        if (!hasBuffer && !hasPath) {
            reject(new Error('No valid audio data provided'));
            return;
        }
        
        const requestOptions = {
            method: "POST",
            url: "https://api.openai.com/v1/audio/translations",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "multipart/form-data"
            },
            formData: {
                "model": "whisper-1"
            }
        };
        
        // Set file data either from buffer or file path
        if (hasBuffer) {
            // Use buffer directly with filename for content-type detection
            requestOptions.formData.file = {
                value: options.buffer,
                options: {
                    filename: options.filename,
                    contentType: 'audio/mpeg' // Adjust if needed based on your audio format
                }
            };
            console.log("Using buffer data for transcription");
        } else {
            // Fallback to file path for backward compatibility
            requestOptions.formData.file = fs.createReadStream(options.path);
            console.log("Using file path for transcription:", options.path);
        }
        
        request(requestOptions, function (err, res, body) {
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