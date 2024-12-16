class TeacherClass {
    constructor() {
        this.loadLectures();
        this.setupRecordingButton();
    }

    async loadLectures() {
        try {
            const response = await fetch('/api/recordings');
            const data = await response.json();
            
            if (data.success && data.recordings) {
                this.renderLectures(data.recordings);
                this.updateLectureCount(data.recordings.length);
            }
        } catch (error) {
            console.error('Error loading lectures:', error);
        }
    }

    renderLectures(lectures) {
        const container = document.querySelector('.lecture-list');
        container.innerHTML = ''; // Clear existing

        lectures.forEach(lecture => {
            const card = this.createLectureCard(lecture);
            container.appendChild(card);
        });
    }

    createLectureCard(lecture) {
        const date = new Date(lecture.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const card = document.createElement('div');
        card.className = 'lecture-card';
        card.innerHTML = `
            <div class="lecture-content">
                <div class="lecture-info">
                    <h3>${lecture.title}</h3>
                    <div class="lecture-meta">
                        <span class="date">
                            <i class="bi bi-calendar"></i>
                            ${date}
                        </span>
                    </div>
                </div>
                <div class="lecture-actions">
                    <a href="/teacher-lecture-notes.html?id=${lecture._id}" class="view-lecture">
                        View Notes
                    </a>
                    <button class="delete-lecture" data-id="${lecture._id}">
                        <i class="bi bi-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;

        // Add delete event listener
        const deleteBtn = card.querySelector('.delete-lecture');
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to delete this lecture? This action cannot be undone.')) {
                try {
                    const lectureId = deleteBtn.getAttribute('data-id');
                    const response = await fetch(`/api/recordings/${lectureId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        card.remove(); // Remove the card from the UI
                        const remainingLectures = document.querySelectorAll('.lecture-card').length;
                        this.updateLectureCount(remainingLectures);
                    } else {
                        throw new Error(data.error || 'Failed to delete lecture');
                    }
                } catch (error) {
                    console.error('Error deleting lecture:', error);
                    alert('Failed to delete lecture. Please try again.');
                }
            }
        });

        return card;
    }

    updateLectureCount(count) {
        const countElement = document.querySelector('.lecture-count');
        if (countElement) {
            countElement.textContent = `${count} lecture${count !== 1 ? 's' : ''} this week`;
        }
    }

    setupRecordingButton() {
        const recordingCircle = document.querySelector('.recording-circle');
        const startRecordingBtn = document.querySelector('.start-recording-btn');

        recordingCircle.addEventListener('click', () => this.startRecording());
        startRecordingBtn.addEventListener('click', () => this.startRecording());
    }

    startRecording() {
        window.location.href = '/index.html';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TeacherClass();
}); 