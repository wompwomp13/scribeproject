class CoursePage {
    constructor() {
        this.modal = document.getElementById('lectureModal');
        this.setupEventListeners();
        this.loadLectures();
    }

    setupEventListeners() {
        // Close modal when clicking X
        document.querySelector('.modal .close').onclick = () => {
            this.modal.style.display = 'none';
            document.getElementById('modalAudio').pause();
        };

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === this.modal) {
                this.modal.style.display = 'none';
                document.getElementById('modalAudio').pause();
            }
        };
        
        // Set up dashboard link with user's email
        const dashboardLink = document.querySelector('.dashboard-link');
        const userEmail = localStorage.getItem('currentUserEmail');
        
        if (dashboardLink && userEmail) {
            dashboardLink.href = `/studentdashboard.html?email=${encodeURIComponent(userEmail)}`;
        }
    }

    async loadLectures() {
        try {
            const response = await fetch('/api/recordings');
            const data = await response.json();
            
            // Update lecture count
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentCount = data.recordings.filter(
                rec => new Date(rec.createdAt) > weekAgo
            ).length;
            
            document.getElementById('lectureCount').textContent = 
                `${recentCount} new lectures this week`;
            
            // Render lectures
            this.renderLectures(data.recordings);
        } catch (error) {
            console.error('Error loading lectures:', error);
        }
    }

    renderLectures(lectures) {
        const container = document.getElementById('lecturesList');
        container.innerHTML = ''; // Clear existing
        
        lectures.forEach(lecture => {
            const card = this.createLectureCard(lecture);
            container.appendChild(card);
        });
    }

    createLectureCard(lecture) {
        const card = document.createElement('div');
        card.className = 'lecture-item';
        
        const date = new Date(lecture.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Create URL-friendly slug from lecture title
        const slug = lecture.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        card.innerHTML = `
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
                <a href="/lectures/${slug}?id=${lecture._id}" class="view-lecture">
                    View Notes
                </a>
            </div>
        `;
        
        return card;
    }

    showLecture(lecture) {
        document.getElementById('modalTitle').textContent = lecture.title;
        document.getElementById('modalAudio').src = `/uploads/${lecture.audioFile.filename}`;
        document.getElementById('modalTranscript').textContent = lecture.transcription.text;
        this.modal.style.display = 'block';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CoursePage();
});