class CoursePage {
    constructor(courseId) {
        this.courseId = courseId;
        this.modal = document.getElementById('lectureModal');
        this.setupEventListeners();
        this.loadLectures();
    }

    setupEventListeners() {
        // Close modal
        document.querySelector('.modal .close').onclick = () => {
            this.modal.style.display = 'none';
            document.getElementById('modalAudio').pause();
        };

        // Close modal on outside click
        window.onclick = (event) => {
            if (event.target === this.modal) {
                this.modal.style.display = 'none';
                document.getElementById('modalAudio').pause();
            }
        };
    }

    async loadLectures() {
        try {
            const response = await fetch(`/api/courses/${this.courseId}/recordings`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('recentCount').textContent = data.total;
                this.renderLectures(data.recordings);
            }
        } catch (error) {
            console.error('Load error:', error);
        }
    }

    renderLectures(lectures) {
        const container = document.getElementById('lecturesList');
        const template = document.getElementById('lecture-card-template');
        
        container.innerHTML = ''; // Clear existing
        
        lectures.forEach(lecture => {
            const card = template.content.cloneNode(true);
            
            card.querySelector('.lecture-title').textContent = lecture.title;
            card.querySelector('.lecture-date').textContent = new Date(lecture.createdAt).toLocaleDateString();
            card.querySelector('.lecture-duration').textContent = this.formatDuration(lecture.duration);
            
            card.querySelector('.view-lecture').onclick = () => this.showLecture(lecture._id);
            
            container.appendChild(card);
        });
    }

    async showLecture(lectureId) {
        try {
            const response = await fetch(`/api/recordings/${lectureId}`);
            const data = await response.json();
            
            if (data.success) {
                const { recording } = data;
                
                document.getElementById('modalTitle').textContent = recording.title;
                document.getElementById('modalAudio').src = recording.audioFile.url;
                document.getElementById('modalTranscript').textContent = recording.transcription.text;
                
                this.modal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading lecture:', error);
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
} 