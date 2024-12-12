//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

let gumStream; 						//stream from getUserMedia()
let recorder; 						//WebAudioRecorder object
let input; 							//MediaStreamAudioSourceNode
let encodingType = 'mp3';           //holds selected encoding for resulting audio (file)
let encodeAfterRecord = true;       // when to encode

let AudioContext = window.AudioContext || window.webkitAudioContext;
let audioContext;

let encodingTypeSelect = document.getElementById("encodingTypeSelect");
let recordButton = document.getElementById("recordButton");
let stopButton = document.getElementById("stopButton");
const transcribeButton = document.getElementById('transcribeButton');

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

// Add these variables at the top
let timerInterval;
let recordingStartTime;
let isRecording = false;
let currentRecordingBlob = null;
const transcriptionText = document.getElementById('transcriptionText');
const saveButton = document.getElementById('saveRecording');
let currentStep = 0;
const progressContainer = document.getElementById('progressContainer');
const progressLineFill = document.getElementById('progressLineFill');
const progressStatus = document.getElementById('progressStatus');
const recordingIndicator = document.getElementById('recordingIndicator');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const statusText = document.getElementById('statusText');
let recordingChunks = [];
let currentChunkNumber = 0;
let transcriptionParts = [];
let isProcessingComplete = false;
const CHUNK_DURATION = 120; // 2 minutes in seconds

// Function to update progress steps
function updateProgress(step, status) {
    currentStep = step;
    
    // Update progress line
    progressLineFill.style.width = `${(step - 1) * 50}%`;
    
    // Update step indicators
    document.querySelectorAll('.progress-step').forEach(stepEl => {
        const stepNum = parseInt(stepEl.dataset.step);
        if (stepNum <= step) {
            stepEl.classList.add('active');
        } else {
            stepEl.classList.remove('active');
        }
    });
    
    // Update status text
    if (status) {
        progressStatus.textContent = status;
    }
    
    // Show/hide progress container
    if (step > 0) {
        progressContainer.classList.add('active');
    } else {
        progressContainer.classList.remove('active');
    }
}

// Function to show/hide loading
function setLoading(show, message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (show) {
        overlay.classList.add('active');
        loadingText.textContent = message;
    } else {
        overlay.classList.remove('active');
    }
}

// Function to update status text
function updateStatus(message) {
    statusText.textContent = message;
}

// Function to combine transcriptions
function combineTranscriptions() {
    return transcriptionParts.join(' ');
}

// Function to start timer
function startTimer() {
    const timerDisplay = document.getElementById('recordingTimer');
    recordingStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const seconds = Math.floor((elapsed / 1000) % 60);
        const minutes = Math.floor((elapsed / 1000 / 60) % 60);
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Function to stop timer
function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById('recordingTimer').textContent = '00:00';
}

// Update the startRecording function
function startRecording() {
    console.log("recordButton clicked");

    let constraints = { audio: true, video: false }

    recordButton.disabled = true;
    stopButton.disabled = false;
    recordButton.classList.add('recording');
    recordingIndicator.classList.add('active');
    
    // Clear previous transcription
    transcriptionText.value = '';
    transcriptionParts = [];
    recordingChunks = [];
    currentChunkNumber = 0;
    
    // Start timer
    startTimer();

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        console.log("getUserMedia() success, stream created, initializing WebAudioRecorder...");

        audioContext = new AudioContext();
        gumStream = stream;
        input = audioContext.createMediaStreamSource(stream);

        startNewChunk();

    }).catch(function(err) {
        recordButton.disabled = false;
        stopButton.disabled = true;
        recordButton.classList.remove('recording');
        recordingIndicator.classList.remove('active');
        stopTimer();
        console.error('Error getting user media:', err);
        alert('Error starting recording. Please check your microphone permissions.');
    });
}

// Function to start recording a new chunk
function startNewChunk() {
    currentChunkNumber++;
    isProcessingComplete = false;

    recorder = new WebAudioRecorder(input, {
        workerDir: "js/",
        encoding: 'mp3',
        numChannels: 2,
        onEncoderLoading: function(recorder, encoding) {
            console.log("Loading "+encoding+" encoder...");
        },
        onEncoderLoaded: function(recorder, encoding) {
            console.log(encoding+" encoder loaded");
        }
    });

    recorder.onComplete = function(recorder, blob) { 
        console.log("Chunk encoding complete");
        processChunk(blob);
    }

    recorder.setOptions({
        timeLimit: CHUNK_DURATION,
        encodeAfterRecord: encodeAfterRecord,
        mp3: {bitRate: 160}
    });

    recorder.startRecording();
    isRecording = true;

    // Set timeout to automatically process chunk after 2 minutes
    setTimeout(() => {
        if (isRecording) {
            recorder.finishRecording();
            startNewChunk();
        }
    }, CHUNK_DURATION * 1000);
}

// Function to process each chunk
async function processChunk(blob) {
    try {
        recordingChunks.push(blob);
        
        // Show loading only for final chunk
        if (!isRecording) {
            setLoading(true, 'Finalizing transcription...');
        }

        // Upload and transcribe the chunk
        const formData = new FormData();
        formData.append('data', blob);
        
        const response = await fetch('/upload?preview=true', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to process audio');
        }
        
        const data = await response.json();
        transcriptionParts.push(data.text);
        
        // Update the transcription text area with all parts
        const transcription = combineTranscriptions();
        transcriptionText.value = transcription;
        transcriptionText.disabled = false;

        // Scroll to bottom of textarea to show latest text
        transcriptionText.scrollTop = transcriptionText.scrollHeight;

        // If this was the final chunk, enable save button
        if (!isRecording) {
            isProcessingComplete = true;
            setLoading(false);
            saveButton.disabled = false;
        }
        
    } catch (error) {
        console.error('Error processing chunk:', error);
        if (!isRecording) {
            setLoading(false);
            alert('Error processing the recording. Please try again.');
        }
    }
}

// Update the stopRecording function
function stopRecording() {
    console.log("stopButton clicked");

    stopButton.disabled = true;
    recordButton.disabled = false;
    recordButton.classList.remove('recording');
    recordingIndicator.classList.remove('active');
    
    // Stop timer
    stopTimer();
    
    if (recorder && recorder.isRecording()) {
        setLoading(true, 'Processing final recording...');
        recorder.finishRecording();
    }
    isRecording = false;

    gumStream.getAudioTracks()[0].stop();
    
    // Save button will be enabled after final chunk is processed
    saveButton.disabled = true;
}

// Add this to handle page unload
window.onbeforeunload = function() {
    if (isRecording) {
        stopRecording();
    }
};

// Function to show success message
function showSuccessMessage() {
    const template = document.getElementById('successMessageTemplate');
    const message = template.content.cloneNode(true);
    document.body.appendChild(message.firstElementChild);

    // Remove the message after animation completes
    setTimeout(() => {
        const messageElement = document.querySelector('.success-message');
        if (messageElement) {
            messageElement.remove();
        }
    }, 2500); // Slightly longer than animation duration
}

// Update save button handler
saveButton.addEventListener('click', async () => {
    if (!isProcessingComplete) {
        alert('Please wait for processing to complete before saving.');
        return;
    }

    try {
        if (recordingChunks.length === 0) {
            throw new Error('No recording available');
        }

        const lectureTitle = document.getElementById('lectureTitle').value || 'Untitled Lecture';
        const combinedTranscription = combineTranscriptions();

        // Create a single blob from all chunks
        const combinedBlob = new Blob(recordingChunks, { type: 'audio/mp3' });

        let fd = new FormData();
        fd.append('data', combinedBlob);
        fd.append('title', lectureTitle);
        fd.append('transcription', combinedTranscription);

        saveButton.disabled = true;
        setLoading(true, 'Saving recording...');

        const response = await fetch('/upload', {
            method: 'POST',
            body: fd
        });

        if (!response.ok) {
            throw new Error('Failed to save recording');
        }

        const data = await response.json();
        
        if (data.success) {
            // Clear all recording data
            recordingChunks = [];
            transcriptionParts = [];
            currentChunkNumber = 0;
            isProcessingComplete = false;
            
            // Disable editing
            transcriptionText.disabled = true;
            
            setLoading(false);
            showSuccessMessage();
        } else {
            throw new Error(data.error || 'Failed to save recording');
        }
    } catch (error) {
        console.error('Save error:', error);
        setLoading(false);
        saveButton.disabled = false;
        alert('Failed to save recording: ' + error.message);
    }
});

function uploadBlob(soundBlob, encoding) {
    let fd = new FormData();
    fd.append('data', soundBlob);
    const lectureTitle = document.getElementById('lectureTitle').value || 'Untitled Lecture';
    fd.append('title', lectureTitle);

    return $.ajax({
        type: 'POST',
        url: '/upload',
        data: fd,
        processData: false,
        contentType: false
    }).done(function(data) {
        console.log("Upload success:", data);
        if (data.text) {
            updateTranscriptionDisplay(data.text);
        }
        return data;
    }).fail(function(error) {
        console.error("Upload error:", error);
        throw error;
    });
}

// Function to load recordings from MongoDB
async function loadRecordings() {
    try {
        const response = await fetch('/api/recordings');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Loaded recordings:', data);
        
        if (data.success && data.recordings) {
            // Update UI with recordings
            // ... rest of your code ...
        }
    } catch (error) {
        console.error('Error loading recordings:', error);
    }
}

// Function to update transcription display
function updateTranscriptionDisplay(text) {
    const transcriptionText = document.getElementById('transcriptionText');
    transcriptionText.textContent = text || 'No transcription available';

    // Setup copy button
    document.getElementById('copyTranscription').onclick = function() {
        navigator.clipboard.writeText(text).then(() => {
            alert('Transcription copied to clipboard!');
        });
    };

    // Setup download button
    document.getElementById('downloadTranscription').onclick = function() {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcription-${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };
}

// Load recordings when page loads
document.addEventListener('DOMContentLoaded', loadRecordings);

// Add this function to your existing app.js
async function updateRecentRecordingsList() {
    try {
        const response = await fetch('/api/recordings');
        const data = await response.json();
        
        const recordingsList = document.getElementById('recentRecordings');
        recordingsList.innerHTML = ''; // Clear existing list
        
        data.recordings.forEach(recording => {
            const card = createRecordingCard(recording);
            recordingsList.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading recordings:', error);
    }
}

function createRecordingCard(recording) {
    const card = document.createElement('div');
    card.className = 'recording-card';
    
    const title = document.createElement('h3');
    title.textContent = recording.title;
    
    const date = document.createElement('p');
    date.textContent = new Date(recording.createdAt).toLocaleDateString();
    
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = `/uploads/${recording.audioFile.filename}`;
    
    card.appendChild(title);
    card.appendChild(date);
    card.appendChild(audio);
    
    return card;
}

// Call this after successful recording upload
function onRecordingComplete(recordingData) {
    updateRecentRecordingsList();
    updateTranscriptionDisplay(recordingData.text);
}