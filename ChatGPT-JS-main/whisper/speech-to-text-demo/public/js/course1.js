// Constants
const CURRENT_CLASS_ID = 'physics101'; // Replace with actual class ID
const REFRESH_INTERVAL = 30000; // 30 seconds

// Load lectures for Physics 101
async function loadLectures() {
    try {
        const response = await fetch('/api/recordings/physics101');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recordings = await response.json();
        console.log('Loaded recordings:', recordings);
        
        // Update lecture count
        updateLectureCount(recordings);
        
        // Update recent lectures
        updateRecentLectures(recordings);
        
        // Update previous lectures
        updatePreviousLectures(recordings);
    } catch (error) {
        console.error('Error loading lectures:', error);
        document.querySelector('.loading-placeholder').innerHTML = `
            <i class="bi bi-exclamation-triangle"></i>
            <span>Error loading lectures: ${error.message}</span>
        `;
    }
}

// Update lecture count
function updateLectureCount(recordings) {
    const recentCount = recordings.filter(r => {
        const recordingDate = new Date(r.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return recordingDate > weekAgo;
    }).length;
    
    const lectureCount = document.querySelector('.lecture-count');
    if (lectureCount) {
        lectureCount.textContent = `${recentCount} lectures this week`;
    }
}

// Update recent lectures section
function updateRecentLectures(recordings) {
    const recentLectures = recordings.slice(0, 2); // Get most recent 2 lectures
    const container = document.querySelector('.lecture-cards');
    
    if (container) {
        container.innerHTML = ''; // Clear existing lectures
        
        if (recentLectures.length === 0) {
            container.innerHTML = `
                <div class="no-lectures">
                    <i class="bi bi-info-circle"></i>
                    <span>No recent lectures available</span>
                </div>
            `;
            return;
        }
        
        recentLectures.forEach(recording => {
            container.appendChild(createLectureCard(recording));
        });
    }
}

// Create a lecture card
function createLectureCard(recording) {
    const card = document.createElement('div');
    card.className = 'lecture-item';
    
    const recordingDate = new Date(recording.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    
    card.innerHTML = `
        <a href="#" class="lecture-link" data-recording-id="${recording._id}">
            <div class="lecture-play">
                <i class="bi bi-play-circle"></i>
            </div>
            <div class="lecture-info">
                <h3>${recording.title}</h3>
                <div class="lecture-meta">
                    <span class="date">
                        <i class="bi bi-calendar"></i>
                        ${recordingDate}
                    </span>
                    <span class="duration">
                        <i class="bi bi-clock"></i>
                        ${recording.audioFile.duration || '0:00'}
                    </span>
                </div>
            </div>
            <div class="lecture-actions">
                <button class="edit-btn">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="more-btn">
                    <i class="bi bi-three-dots-vertical"></i>
                </button>
            </div>
        </a>
    `;
    
    // Add click handler
    card.querySelector('.lecture-link').addEventListener('click', (e) => {
        e.preventDefault();
        openLecture(recording._id);
    });
    
    return card;
}

// Open lecture view
async function openLecture(recordingId) {
    try {
        const response = await fetch(`/api/recording/${recordingId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const recording = await response.json();
        
        // Get modal elements
        const modal = document.getElementById('lectureModal');
        const modalTitle = modal.querySelector('.modal-title');
        const audioPlayer = modal.querySelector('.audio-player');
        const transcriptionText = modal.querySelector('.transcription-text');
        
        // Update modal content
        modalTitle.textContent = recording.title;
        audioPlayer.innerHTML = `
            <audio controls class="w-100">
                <source src="/uploads/${recording.audioFile.filename}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
        `;
        transcriptionText.textContent = recording.transcription.text;
        
        // Show modal
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    } catch (error) {
        console.error('Error opening lecture:', error);
        alert('Failed to load lecture: ' + error.message);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadLectures();
    // Set up periodic refresh
    setInterval(loadLectures, 30000); // Check for new lectures every 30 seconds
});