class StudentClass {
    constructor() {
        this.courseId = new URLSearchParams(window.location.search).get('id');
        this.lectures = [];
        this.searchInput = document.getElementById('lectureSearch');
        this.sortSelect = document.getElementById('sortLectures');
        
        // Set up dashboard link with user's email
        this.setupDashboardLink();
        
        // Setup search and filter event listeners
        this.setupEventListeners();
        
        if (this.courseId) {
            this.loadCourseDetails();
            this.loadLectures();
        }
    }

    setupEventListeners() {
        // Add event listeners for search and filter
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                this.filterAndSortLectures();
            });
        }

        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => {
                this.filterAndSortLectures();
            });
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
                // Always set document title
                document.title = `SCRIBE - ${data.course.name}`;
                
                // Update elements if they exist
                const codeElement = document.getElementById('courseCode');
                if (codeElement) codeElement.textContent = data.course.code;
                
                const nameElement = document.getElementById('courseName');
                if (nameElement) nameElement.textContent = data.course.name;
                
                const descriptionElement = document.getElementById('courseDescription');
                if (descriptionElement) {
                    descriptionElement.textContent = data.course.description || 'No description available';
                }
                
                // Only try to update instructor if the element exists
                const instructorElement = document.getElementById('courseInstructor');
                if (instructorElement) {
                    instructorElement.textContent = data.course.instructor || 'TBA';
                }
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
                this.lectures = data.recordings;
                this.filterAndSortLectures();
                this.updateLectureCount(data.recordings.length);
            }
        } catch (error) {
            console.error('Error loading lectures:', error);
            document.getElementById('lecturesList').innerHTML = 
                '<p class="error-message">Error loading lectures. Please try again later.</p>';
        }
    }

    filterAndSortLectures() {
        const searchText = this.searchInput ? this.searchInput.value.toLowerCase() : '';
        const sortOption = this.sortSelect ? this.sortSelect.value : 'date-new';
        
        // Filter lectures based on search text
        let filteredLectures = this.lectures.filter(lecture => {
            const title = (lecture.title || 'Untitled Lecture').toLowerCase();
            const date = new Date(lecture.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).toLowerCase();
            
            return title.includes(searchText) || date.includes(searchText);
        });
        
        // Sort filtered lectures
        filteredLectures.sort((a, b) => {
            switch (sortOption) {
                case 'date-new':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'date-old':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'name-asc':
                    return (a.title || 'Untitled Lecture').localeCompare(b.title || 'Untitled Lecture');
                case 'name-desc':
                    return (b.title || 'Untitled Lecture').localeCompare(a.title || 'Untitled Lecture');
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
        
        this.renderFilteredLectures(filteredLectures);
    }

    renderFilteredLectures(lectures) {
        const container = document.getElementById('lecturesList');
        container.innerHTML = ''; // Clear existing

        if (lectures.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <i class="bi bi-search"></i>
                    <p>No lectures found</p>
                </div>
            `;
            return;
        }

        lectures.forEach(lecture => {
            const card = this.createLectureCard(lecture);
            container.appendChild(card);
        });
    }

    renderLectures(lectures) {
        this.lectures = lectures;
        this.filterAndSortLectures();
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