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

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

// Add these variables at the top
let timerInterval;
let recordingStartTime;
let isRecording = false;

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

function createDownloadLink(blob, encoding) {
    let url = URL.createObjectURL(blob);
    let au = document.createElement('audio');
    let li = document.createElement('li');
    let link = document.createElement('a');
    let button = document.createElement('button');
    
    button.innerText = "Speech To Text";
    button.onclick = async function () {
        console.log("Uploading blob...");
        try {
            let fd = new FormData();
            fd.append('data', blob);
            const response = await fetch('/upload', {
                method: 'POST',
                body: fd
            });
            const data = await response.json();
            
            // Update the transcription text box
            const transcriptionText = document.getElementById('transcriptionText');
            transcriptionText.textContent = data.text || 'No transcription available';
            
            // Update the status
            document.getElementById('transcriptionStatus').textContent = 'Complete';
            
            // Disable the button after successful transcription
            button.disabled = true;
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('transcriptionText').textContent = 'Error during transcription. Please try again.';
            document.getElementById('transcriptionStatus').textContent = 'Error';
        }
    }

    au.controls = true;
    au.src = url;

    link.href = url;
    link.download = new Date().toISOString() + '.' + encoding;
    link.innerHTML = link.download;

    li.appendChild(au);
    li.appendChild(link);
    li.appendChild(button);

    recordingsList.appendChild(li);
}

function uploadBlob(soundBlob, encoding) {
    let fd = new FormData();
    fd.append('fname', Date.now().toString() + "." + encoding);
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
        const recordings = await response.json();
        console.log('Loaded recordings:', recordings);
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