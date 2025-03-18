class StudentClass {
    constructor() {
        this.courseId = new URLSearchParams(window.location.search).get('id');
        
        // Set up dashboard link with user's email
        this.setupDashboardLink();
        
        if (this.courseId) {
            this.loadCourseDetails();
            this.loadLectures();
        }
    }

    setupDashboardLink() {
        const dashboardLink = document.querySelector('.dashboard-link');
        const userEmail = localStorage.getItem('currentUserEmail');
        
        if (dashboardLink && userEmail) {
            dashboardLink.href = `/studentdashboard.html?email=${encodeURIComponent(userEmail)}`;
        }
    }

    async loadCourseDetails() {
        try {
            const response = await fetch(`/api/course/${this.courseId}`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('courseCode').textContent = data.course.code;
                document.getElementById('courseName').textContent = data.course.name;
                document.getElementById('courseDescription').textContent = data.course.description || 'No description available';
                document.getElementById('courseInstructor').textContent = data.course.instructor || 'TBA';
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
            document.getElementById('lecturesList').innerHTML = 
                '<p class="error-message">Error loading lectures. Please try again later.</p>';
        }
    }

    renderLectures(lectures) {
        const container = document.getElementById('lecturesList');
        container.innerHTML = ''; // Clear existing

        if (lectures.length === 0) {
            container.innerHTML = '<p class="no-lectures">No lectures available yet.</p>';
            return;
        }

        // Sort lectures by date (newest first)
        lectures.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
        card.className = 'lecture-item';
        card.innerHTML = `
            <div class="lecture-info">
                <h3>${lecture.title || 'Untitled Lecture'}</h3>
                <p class="lecture-date">
                    <i class="bi bi-calendar"></i>
                    ${date}
                </p>
            </div>
            <div class="lecture-actions">
                <a href="/student-lecture-notes.html?id=${lecture._id}&courseId=${this.courseId}" class="view-btn">
                    <i class="bi bi-play-circle"></i>
                    View Lecture
                </a>
            </div>
        `;

        return card;
    }

    updateLectureCount(count) {
        const thisWeekCount = this.countLecturesThisWeek(count);
        document.getElementById('lectureCount').textContent = 
            `${thisWeekCount} lecture${thisWeekCount !== 1 ? 's' : ''} this week`;
    }

    countLecturesThisWeek(count) {
        // For now, just return the total count
        // Could be enhanced to actually count this week's lectures
        return count;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new StudentClass();
}); 