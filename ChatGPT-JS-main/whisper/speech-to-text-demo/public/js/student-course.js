document.addEventListener('DOMContentLoaded', function() {
    // Get course ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (courseId) {
        loadCourseDetails(courseId);
        loadLectures(courseId);
    }
});

async function loadCourseDetails(courseId) {
    try {
        const response = await fetch(`/api/courses/${courseId}`);
        const course = await response.json();

        // Update course details in the UI
        document.title = `${course.code} - SCRIBE`;
        document.querySelector('.course-code').textContent = course.code;
        document.querySelector('.course-header h1').textContent = course.name;
        
        // Set course description if available
        const descriptionElement = document.getElementById('courseDescription');
        if (descriptionElement && course.description) {
            descriptionElement.textContent = course.description;
        }
        
        // Removed meta information update - no longer showing schedule and student count
    } catch (error) {
        console.error('Error loading course details:', error);
    }
}

async function loadLectures(courseId) {
    try {
        const response = await fetch(`/api/courses/${courseId}/recordings`);
        const recordings = await response.json();
        
        const lecturesList = document.getElementById('lecturesList');
        lecturesList.innerHTML = ''; // Clear existing lectures
        
        if (!recordings || recordings.length === 0) {
            lecturesList.innerHTML = '<p class="no-lectures">No lectures available yet.</p>';
            document.getElementById('lectureCount').textContent = '0 lectures this week';
            return;
        }

        // Count lectures from this week
        const thisWeekLectures = recordings.filter(isThisWeek);
        document.getElementById('lectureCount').textContent = 
            `${thisWeekLectures.length} lecture${thisWeekLectures.length !== 1 ? 's' : ''} this week`;

        // Sort recordings by date (newest first)
        recordings.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Create lecture elements
        recordings.forEach(recording => {
            const lectureElement = createLectureElement(recording);
            lecturesList.appendChild(lectureElement);
        });

        // Set up modal functionality
        setupModal();
    } catch (error) {
        console.error('Error loading lectures:', error);
    }
}

function createLectureElement(recording) {
    const date = new Date(recording.date);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    // Create a sanitized copy of the recording object for the button data attribute
    const recordingData = {
        _id: recording._id,
        title: recording.title,
        date: recording.date,
        transcript: recording.transcript,
        audioUrl: recording.audioUrl,
        audioFile: recording.audioFile
    };

    const lecture = document.createElement('div');
    lecture.className = 'lecture-item';
    lecture.innerHTML = `
        <div class="lecture-info">
            <h3>${recording.title || 'Untitled Lecture'}</h3>
            <p class="lecture-date">${formattedDate}</p>
        </div>
        <div class="lecture-actions">
            <button class="play-btn" data-recording='${JSON.stringify(recordingData)}'>
                <i class="bi bi-play-circle"></i>
                Play
            </button>
        </div>
    `;

    return lecture;
}

function setupModal() {
    const modal = document.getElementById('lectureModal');
    const modalAudio = document.getElementById('modalAudio');
    const modalTitle = document.getElementById('modalTitle');
    const modalTranscript = document.getElementById('modalTranscript');
    const closeBtn = modal.querySelector('.close');

    // Play button click handler
    document.querySelectorAll('.play-btn').forEach(button => {
        button.addEventListener('click', () => {
            const recording = JSON.parse(button.dataset.recording);
            modalTitle.textContent = recording.title || 'Untitled Lecture';
            
            // Determine the audio URL based on storage type
            let audioUrl;
            if (recording.audioFile && recording.audioFile.isDropbox) {
                audioUrl = recording.audioFile.url;
            } else if (recording.audioUrl) {
                audioUrl = recording.audioUrl;
            } else if (recording.audioFile && recording.audioFile.filename) {
                audioUrl = `/uploads/${recording.audioFile.filename}`;
            } else {
                audioUrl = '';
                console.error('No audio URL available for this recording');
            }
            
            modalAudio.src = audioUrl;
            modalTranscript.textContent = recording.transcript || 'No transcript available';
            modal.style.display = 'block';
        });
    });

    // Close button handler
    closeBtn.onclick = () => {
        modal.style.display = 'none';
        modalAudio.pause();
    };

    // Click outside modal to close
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            modalAudio.pause();
        }
    };
}

function isThisWeek(recording) {
    const recordingDate = new Date(recording.date);
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return recordingDate >= weekStart && recordingDate <= weekEnd;
} 