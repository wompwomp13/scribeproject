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
        console.log('Loading overlay activated:', message);
    } else {
        overlay.classList.remove('active');
        console.log('Loading overlay deactivated');
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
        console.log("Main recording blob size:", blob.size);
        
        // Don't automatically upload the full recording
        // It will only be uploaded when the user clicks the save button
        isProcessingComplete = true;
        setLoading(false);
        saveButton.disabled = false;
    }

    // IMPORTANT: Explicitly set timeLimit to 0 to disable the default 300-second (5-minute) limit
    mainRecorder.setOptions({
        encodeAfterRecord: encodeAfterRecord,
        mp3: {bitRate: 160},
        timeLimit: 3600  
    });

    mainRecorder.startRecording();
    isRecording = true;
    console.log("Main recorder started with no time limit");
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

// Add this helper function to force complete loading in case of stalls
function forceCompleteLoading() {
    console.log('Force completing loading process');
    setLoading(false);
    isProcessingComplete = true;
    saveButton.disabled = false;
    
    // Check if transcription exists but might be incomplete
    if (transcriptionParts.length > 0) {
        const transcription = combineTranscriptions();
        transcriptionText.value = transcription;
        originalTranscription = transcription;
        enableTranscriptionEditing();
    }
}

// Function to process each transcription chunk
async function processTranscriptionChunk(blob) {
    try {
        // Add chunk to array, but limit array size to prevent memory issues
        transcriptionChunks.push(blob);
        if (transcriptionChunks.length > 10) {
            // Keep only the last 10 chunks to prevent memory bloat
            transcriptionChunks = transcriptionChunks.slice(-10);
        }
        
        // Show loading only for final chunk
        if (!isRecording) {
            // Ensure loading screen is visible
            setLoading(true, 'Finalizing transcription...');
            console.log('Showing loading screen for final chunk processing');
            
            // Set a safety timeout for long recordings (8-10 minutes)
            // If we're processing the final chunk and it takes more than 30 seconds, 
            // force the completion to prevent stuck loading
            setTimeout(() => {
                // Only run if we're still showing "Finalizing transcription..."
                const loadingText = document.getElementById('loadingText');
                if (loadingText && 
                    loadingText.textContent === 'Finalizing transcription...' && 
                    !isRecording) {
                    console.warn('Final transcription processing timed out after 30 seconds');
                    forceCompleteLoading();
                }
            }, 30000); // Increased to 30 seconds
        }

        // Upload and transcribe the chunk
        const formData = new FormData();
        formData.append('data', blob);
        
        console.log(`Processing chunk #${currentChunkNumber}, size: ${blob.size} bytes`);
        
        // Use the preview endpoint for transcription with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout (extended for longer recordings)
        
        try {
            const response = await fetch('/upload?preview=true', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Failed to process audio: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validate the response data
            if (!data || !data.text) {
                console.warn('Received empty text from transcription service');
                data.text = ''; // Use empty string if text is missing
            }
            
            transcriptionParts.push(data.text);
            console.log(`Added transcription part #${transcriptionParts.length}: "${data.text.substring(0, 50)}..."`);
            
            // Update the transcription text area with all parts
            const transcription = combineTranscriptions();
            transcriptionText.value = transcription;
            
            // If this is the final chunk, enable editing
            if (!isRecording) {
                originalTranscription = transcription;
                enableTranscriptionEditing();
                
                // Wait a moment before completing to ensure loading screen is visible
                setTimeout(() => {
                    // Ensure processing is marked as complete
                    isProcessingComplete = true;
                    setLoading(false);
                    saveButton.disabled = false;
                }, 1500);
            }
            
            // Scroll to bottom of textarea to show latest text
            transcriptionText.scrollTop = transcriptionText.scrollHeight;
        } catch (fetchError) {
            clearTimeout(timeoutId);
            // Handle timeout specifically
            if (fetchError.name === 'AbortError') {
                console.error('Transcription request timed out');
                if (!isRecording) {
                    // For final chunk timeout, force completion
                    forceCompleteLoading();
                    alert('Transcription processing timed out. The recording has been saved but transcription might be incomplete.');
                }
            } else {
                throw fetchError;
            }
        }
    } catch (error) {
        console.error('Error processing chunk:', error);
        if (!isRecording) {
            // Don't block saving if there's an error with transcription
            forceCompleteLoading();
            alert('Error processing the recording. You can still save, but the transcription might be incomplete.');
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
    
    // Make loading visible immediately
    setLoading(true, 'Processing recording...');
    
    // Master safety timeout - if all else fails, ensure UI isn't stuck after 90 seconds
    const masterTimeout = setTimeout(() => {
        if (document.getElementById('loadingOverlay').classList.contains('active')) {
            console.warn('Master timeout reached, forcing completion');
            forceCompleteLoading();
            alert('The processing is taking too long. You can now save the recording.');
        }
    }, 90000);
    
    // Track completion of both recorders
    let mainComplete = false;
    let chunkComplete = true; // Default to true if no chunk recorder
    
    // Stop the main recorder
    if (mainRecorder && mainRecorder.isRecording()) {
        setLoading(true, 'Processing final recording...');
        
        // Add timeout to ensure we don't get stuck processing
        const processTimeout = setTimeout(() => {
            if (!isProcessingComplete) {
                console.warn('Recording processing timeout reached');
                clearTimeout(masterTimeout); // Clear master timeout since we're handling it here
                forceCompleteLoading();
                alert('Processing is taking longer than expected. You can try saving now.');
            }
        }, 60000); // 60 second timeout as fallback
        
        // Override the onComplete handler to track completion
        const originalOnComplete = mainRecorder.onComplete;
        mainRecorder.onComplete = function(recorder, blob) {
            // Call original handler
            originalOnComplete.call(this, recorder, blob);
            mainComplete = true;
            
            console.log("Main recording complete, blob size:", blob.size);
            
            // If both complete, we're done
            if (mainComplete && chunkComplete) {
                clearTimeout(processTimeout);
                clearTimeout(masterTimeout);
                isProcessingComplete = true;
                setLoading(false);
                saveButton.disabled = false;
            }
        };
        
        mainRecorder.finishRecording();
    } else {
        mainComplete = true;
    }
    
    // Also stop the current chunk recorder to process the partial chunk
    if (currentChunkRecorder && currentChunkRecorder.isRecording()) {
        console.log("Finishing partial chunk recording");
        chunkComplete = false;
        
        // Override the onComplete handler
        const originalOnComplete = currentChunkRecorder.onComplete;
        currentChunkRecorder.onComplete = function(recorder, blob) {
            // Call original handler
            originalOnComplete.call(this, recorder, blob);
            chunkComplete = true;
            
            console.log("Final chunk complete, blob size:", blob.size);
            
            // If both complete, we're done
            if (mainComplete && chunkComplete) {
                clearTimeout(masterTimeout);
                isProcessingComplete = true;
                
                // Keep loading visible for transcription processing
                // setLoading will be called in processTranscriptionChunk with 'Finalizing transcription...'
            }
        };
        
        currentChunkRecorder.finishRecording();
    }

    gumStream.getAudioTracks()[0].stop();
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
        if (window.toast && window.toast.warn) window.toast.warn('Please wait for processing to complete before saving.'); else alert('Please wait for processing to complete before saving.');
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
            if (window.toast && window.toast.warn) window.toast.warn('Please select a course before saving'); else alert('Please select a course before saving');
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
            // Attempt to save the audio locally on the teacher's laptop (optional)
            try {
                await trySaveLectureLocally(data.recording);
            } catch (e) {
                console.warn('Local save skipped/failed:', e);
            }
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
        if (window.toast && window.toast.error) window.toast.error('Failed to save recording: ' + error.message); else alert('Failed to save recording: ' + error.message);
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

// ===== Optional Local Sync (Teacher's laptop) =====
// Uses the File System Access API (Chromium-based browsers) with IndexedDB to remember the folder
(function() {
    const DB_NAME = 'scribe-sync';
    const DB_VERSION = 1;
    const STORE_HANDLES = 'handles';
    const STORE_FILES = 'files'; // key: recordingId, value: { filename }

    function supportsFileSystemAccess() {
        return 'showDirectoryPicker' in window;
    }

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function(e) {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES);
                if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbGet(storeName, key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbSet(storeName, key, value) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function idbDelete(storeName, key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function getSyncDirHandle() {
        try {
            return await idbGet(STORE_HANDLES, 'syncDir');
        } catch (e) {
            return null;
        }
    }

    async function setSyncDirHandle(handle) {
        await idbSet(STORE_HANDLES, 'syncDir', handle);
    }

    async function ensureSyncDirHandleWithPrompt() {
        let handle = await getSyncDirHandle();
        if (!handle) {
            const proceed = confirm('Enable local sync? Pick a folder to save lecture audio locally.');
            if (!proceed) return null;
            handle = await window.showDirectoryPicker();
            await setSyncDirHandle(handle);
        }
        // Request permission if needed
        if (handle) {
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            if (perm !== 'granted') return null;
        }
        return handle;
    }

    async function writeFileToDir(dirHandle, fileName, blob) {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    function extractFilenameFromUrl(url) {
        try {
            const u = new URL(url, window.location.origin);
            return u.pathname.split('/').pop();
        } catch (e) {
            // Fallback if relative path
            const parts = (url || '').split('/');
            return parts[parts.length - 1] || 'lecture.mp3';
        }
    }

    async function recordLocalMapping(recordingId, fileName) {
        await idbSet(STORE_FILES, recordingId, { filename: fileName });
    }

    // Expose helper to global scope for reuse elsewhere
    window.trySaveLectureLocally = async function trySaveLectureLocally(recording) {
        try {
            if (!supportsFileSystemAccess() || !recording || !recording.audioUrl || !recording.id) return;
            const dir = await ensureSyncDirHandleWithPrompt();
            if (!dir) return; // user declined
            const fileName = extractFilenameFromUrl(recording.audioUrl);
            const res = await fetch(recording.audioUrl);
            if (!res.ok) throw new Error('Failed to download audio for local save');
            const blob = await res.blob();
            await writeFileToDir(dir, fileName, blob);
            await recordLocalMapping(recording.id, fileName);
        } catch (e) {
            // Silent failure; local save is optional
            console.warn('Local sync error:', e);
        }
    };
})();

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