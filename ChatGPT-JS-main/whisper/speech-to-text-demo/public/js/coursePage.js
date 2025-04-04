class TeacherClass {
    constructor() {
        this.courseId = window.location.pathname.split('/tcourse/')[1];
        this.loadLectures();
        this.setupRecordingButton();
        this.loadCourseDetails();
    }

    async loadCourseDetails() {
        try {
            const courseId = window.location.pathname.split('/').pop();
            const response = await fetch(`/api/course/${courseId}`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('courseCode').textContent = data.course.code;
                document.getElementById('courseName').textContent = data.course.name;
                document.title = `SCRIBE - ${data.course.name}`;
            }
        } catch (error) {
            console.error('Error loading course details:', error);
        }
    }

    async loadLectures() {
        try {
            const response = await fetch(`/api/courses/${this.courseId}/recordings`);
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
                        <span class="topic-tag">Mechanics</span>
                        <span class="date">
                            <i class="bi bi-calendar"></i>
                            ${date}
                        </span>
                        <span class="duration">
                            <i class="bi bi-clock"></i>
                            45 mins
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
                        card.remove();
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
        // Store the current course ID in localStorage
        localStorage.setItem('selectedCourseId', this.courseId);
        
        // Redirect to index.html with the course ID as a query parameter
        window.location.href = `/index.html?courseId=${encodeURIComponent(this.courseId)}`;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TeacherClass();
}); 