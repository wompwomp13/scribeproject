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
        
        // Update meta information
        const timeSlot = document.querySelector('.time-slot');
        if (timeSlot) {
            timeSlot.innerHTML = `<i class="bi bi-clock"></i> ${course.schedule || 'Schedule TBA'}`;
        }
        
        const students = document.querySelector('.students');
        if (students) {
            students.innerHTML = `<i class="bi bi-person"></i> ${course.instructor || 'TBA'}`;
        }
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

    const lecture = document.createElement('div');
    lecture.className = 'lecture-item';
    lecture.innerHTML = `
        <div class="lecture-info">
            <h3>${recording.title || 'Untitled Lecture'}</h3>
            <p class="lecture-date">${formattedDate}</p>
        </div>
        <div class="lecture-actions">
            <button class="play-btn" data-recording='${JSON.stringify(recording)}'>
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
            modalAudio.src = recording.audioUrl;
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