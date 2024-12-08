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

// Update the startRecording function
function startRecording() {
    console.log("recordButton clicked");

    let constraints = { audio: true, video: false }

    recordButton.disabled = true;
    stopButton.disabled = false;
    
    // Update UI to show recording state
    recordButton.classList.add('recording');
    document.getElementById('recordingStatus').innerHTML = '<div class="recording-dot"></div>Recording...';
    
    // Start timer
    recordingStartTime = Date.now();
    startTimer();

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        console.log("getUserMedia() success, stream created, initializing WebAudioRecorder...");

        audioContext = new AudioContext();
        gumStream = stream;
        input = audioContext.createMediaStreamSource(stream);

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
            console.log("Encoding complete");
            createDownloadLink(blob,recorder.encoding);
        }

        recorder.setOptions({
            timeLimit: 120,
            encodeAfterRecord: encodeAfterRecord,
            mp3: {bitRate: 160}
        });

        recorder.startRecording();
        isRecording = true;
        console.log("Recording started");

    }).catch(function(err) {
        recordButton.disabled = false;
        stopButton.disabled = true;
        console.error('Error getting user media:', err);
    });
}

// Update the stopRecording function
function stopRecording() {
    console.log("stopButton clicked");

    stopButton.disabled = true;
    recordButton.disabled = false;
    transcribeButton.disabled = false; // Enable transcribe button after recording
    
    // Update UI to show stopped state
    recordButton.classList.remove('recording');
    document.getElementById('recordingStatus').textContent = 'Ready';
    
    // Stop timer
    stopTimer();
    
    recorder.finishRecording();
    isRecording = false;

    gumStream.getAudioTracks()[0].stop();
}

// Add these new timer functions
function startTimer() {
    const timerDisplay = document.getElementById('recordingTimer');
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const seconds = Math.floor((elapsed / 1000) % 60);
        const minutes = Math.floor((elapsed / 1000 / 60) % 60);
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById('recordingTimer').textContent = '00:00';
}

// Add this to handle page unload
window.onbeforeunload = function() {
    if (isRecording) {
        stopRecording();
    }
};

// Update the createDownloadLink function
function createDownloadLink(blob, encoding) {
    currentRecordingBlob = blob; // Store the blob for later use
    
    // Setup transcribe button handler
    transcribeButton.onclick = async function() {
        try {
            transcribeButton.disabled = true;
            const status = document.getElementById('transcriptionStatus');
            status.className = 'status-badge status-processing';
            status.textContent = 'Processing...';

            let fd = new FormData();
            fd.append('data', blob);
            
            const response = await fetch('/upload?preview=true', {
                method: 'POST',
                body: fd
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Upload failed');
            }
            
            const data = await response.json();
            
            // Enable editing and save button
            transcriptionText.value = data.text || 'No transcription available';
            transcriptionText.disabled = false;
            saveButton.disabled = false;
            
            // Update the status
            status.className = 'status-badge status-success';
            status.textContent = 'Ready to edit';
            
        } catch (error) {
            console.error('Error:', error);
            transcriptionText.value = `Error during transcription: ${error.message}. Please try again.`;
            const status = document.getElementById('transcriptionStatus');
            status.className = 'status-badge status-error';
            status.textContent = 'Error';
            transcribeButton.disabled = false;
        }
    };
}

// Update save button handler
saveButton.addEventListener('click', async () => {
    try {
        if (!currentRecordingBlob) {
            throw new Error('No recording available');
        }

        const lectureTitle = document.getElementById('lectureTitle').value || 'Untitled Lecture';
        const editedTranscription = transcriptionText.value;

        let fd = new FormData();
        fd.append('data', currentRecordingBlob);
        fd.append('title', lectureTitle);
        fd.append('transcription', editedTranscription);

        saveButton.disabled = true;
        const status = document.getElementById('transcriptionStatus');
        status.className = 'status-badge status-processing';
        status.textContent = 'Saving...';

        const response = await fetch('/upload', {
            method: 'POST',
            body: fd
        });

        if (!response.ok) {
            throw new Error('Failed to save recording');
        }

        const data = await response.json();
        
        if (data.success) {
            status.className = 'status-badge status-success';
            status.textContent = 'Saved!';
            
            // Add a timeout to revert back to ready state
            setTimeout(() => {
                status.className = 'status-badge status-ready';
                status.textContent = 'Ready';
            }, 2000);

            // Clear the current recording
            currentRecordingBlob = null;
            // Disable editing
            transcriptionText.disabled = true;
            transcribeButton.disabled = true;
        } else {
            throw new Error(data.error || 'Failed to save recording');
        }
    } catch (error) {
        console.error('Save error:', error);
        const status = document.getElementById('transcriptionStatus');
        status.className = 'status-badge status-error';
        status.textContent = 'Save failed';
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