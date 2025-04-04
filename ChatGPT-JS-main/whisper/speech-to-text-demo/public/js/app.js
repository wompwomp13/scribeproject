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
let transcriptionChunks = [];        // Only for transcription, not audio storage
let currentChunkNumber = 0;
let transcriptionParts = [];
let isProcessingComplete = false;
const CHUNK_DURATION = 120; // 2 minutes in seconds for transcription chunks
let originalTranscription = '';
let isTranscriptionEdited = false;

// Main recorder for the entire lecture (continuous recording)
let mainRecorder = null;
let mainRecordingBlob = null;
let currentChunkRecorder = null;    // For tracking the current transcription chunk

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
    transcriptionChunks = [];
    currentChunkNumber = 0;
    mainRecordingBlob = null;
    
    // Start timer
    startTimer();

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        console.log("getUserMedia() success, stream created, initializing WebAudioRecorder...");

        audioContext = new AudioContext();
        gumStream = stream;
        input = audioContext.createMediaStreamSource(stream);

        // Start the main recorder for the entire lecture
        startMainRecorder();
        
        // Also start the first transcription chunk
        startTranscriptionChunk();

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

// Function to start the main recorder (records the entire lecture as one file)
function startMainRecorder() {
    mainRecorder = new WebAudioRecorder(input, {
        workerDir: "js/",
        encoding: 'mp3',
        numChannels: 2,
        onEncoderLoading: function(recorder, encoding) {
            console.log("Loading "+encoding+" encoder for main recording...");
        },
        onEncoderLoaded: function(recorder, encoding) {
            console.log(encoding+" encoder loaded for main recording");
        }
    });

    mainRecorder.onComplete = function(recorder, blob) { 
        console.log("Main recording encoding complete");
        mainRecordingBlob = blob;
        
        // Don't automatically upload the full recording
        // It will only be uploaded when the user clicks the save button
        isProcessingComplete = true;
        setLoading(false);
        saveButton.disabled = false;
    }

    mainRecorder.setOptions({
        encodeAfterRecord: encodeAfterRecord,
        mp3: {bitRate: 160}
    });

    mainRecorder.startRecording();
    isRecording = true;
}

// Function to start recording a transcription chunk (for real-time transcription)
function startTranscriptionChunk() {
    currentChunkNumber++;
    isProcessingComplete = false;

    let chunkRecorder = new WebAudioRecorder(input, {
        workerDir: "js/",
        encoding: 'mp3',
        numChannels: 2,
        onEncoderLoading: function(recorder, encoding) {
            console.log("Loading "+encoding+" encoder for chunk...");
        },
        onEncoderLoaded: function(recorder, encoding) {
            console.log(encoding+" encoder loaded for chunk");
        }
    });

    chunkRecorder.onComplete = function(recorder, blob) { 
        console.log("Chunk encoding complete");
        processTranscriptionChunk(blob);
    }

    chunkRecorder.setOptions({
        timeLimit: CHUNK_DURATION,
        encodeAfterRecord: encodeAfterRecord,
        mp3: {bitRate: 160}
    });

    chunkRecorder.startRecording();
    
    // Store reference to the current chunk recorder
    // This is accessed in stopRecording to process partial chunks
    currentChunkRecorder = chunkRecorder;

    // Set timeout to automatically finish this chunk and start the next one
    setTimeout(() => {
        if (isRecording) {
            chunkRecorder.finishRecording();
            startTranscriptionChunk();
        }
    }, CHUNK_DURATION * 1000);
}

// Function to process each transcription chunk
async function processTranscriptionChunk(blob) {
    try {
        transcriptionChunks.push(blob);
        
        // Show loading only for final chunk
        if (!isRecording) {
            setLoading(true, 'Finalizing transcription...');
        }

        // Upload and transcribe the chunk
        const formData = new FormData();
        formData.append('data', blob);
        
        // Use the preview endpoint for transcription
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
        
        // If this is the final chunk, enable editing
        if (!isRecording) {
            originalTranscription = transcription;
            enableTranscriptionEditing();
        }
        
        // Scroll to bottom of textarea to show latest text
        transcriptionText.scrollTop = transcriptionText.scrollHeight;
        
    } catch (error) {
        console.error('Error processing chunk:', error);
        if (!isRecording) {
            setLoading(false);
            alert('Error processing the recording. Please try again.');
        }
    }
}

// Add function to enable transcription editing
function enableTranscriptionEditing() {
    transcriptionText.disabled = false;
    transcriptionText.classList.add('editable');
    
    // Add event listener for changes
    transcriptionText.addEventListener('input', () => {
        isTranscriptionEdited = transcriptionText.value !== originalTranscription;
    });
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
    
    // First set isRecording to false to prevent new chunks from starting
    isRecording = false;
    
    // Stop the main recorder
    if (mainRecorder && mainRecorder.isRecording()) {
        setLoading(true, 'Processing final recording...');
        mainRecorder.finishRecording();
    }
    
    // Also stop the current chunk recorder to process the partial chunk
    if (currentChunkRecorder && currentChunkRecorder.isRecording()) {
        console.log("Finishing partial chunk recording");
        currentChunkRecorder.finishRecording();
    }

    gumStream.getAudioTracks()[0].stop();
    
    // Save button will be enabled when mainRecorder.onComplete fires
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
        if (!mainRecordingBlob) {
            throw new Error('No recording available');
        }

        // Get the selected course ID
        const courseSelect = document.getElementById('courseSelect');
        const courseId = courseSelect.value;
        
        if (!courseId) {
            alert('Please select a course before saving');
            return;
        }

        const lectureTitle = document.getElementById('lectureTitle').value || 'Untitled Lecture';
        const editedTranscription = transcriptionText.value;

        let fd = new FormData();
        fd.append('data', mainRecordingBlob);  // Use the main recording blob (entire lecture)
        fd.append('title', lectureTitle);
        fd.append('transcription', editedTranscription);
        fd.append('courseId', courseId);

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
            transcriptionChunks = [];
            transcriptionParts = [];
            currentChunkNumber = 0;
            isProcessingComplete = false;
            isTranscriptionEdited = false;
            mainRecordingBlob = null;
            
            // Disable editing
            transcriptionText.disabled = true;
            transcriptionText.classList.remove('editable');
            
            setLoading(false);
            showSuccessMessage();

            // Redirect to course page after successful save
            setTimeout(() => {
                window.location.href = `/tcourse/${courseId}`;
            }, 1500);
        } else {
            throw new Error(data.error || 'Failed to save recording');
        }
    } catch (error) {
        console.error('Error saving recording:', error);
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