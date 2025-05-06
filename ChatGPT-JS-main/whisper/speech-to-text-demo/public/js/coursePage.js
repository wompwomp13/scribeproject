class TeacherClass {
    constructor() {
        this.courseId = window.location.pathname.split('/tcourse/')[1];
        this.lectures = [];
        this.searchInput = document.getElementById('lectureSearch');
        this.sortSelect = document.getElementById('sortLectures');
        
        // Setup search and filter event listeners
        this.setupEventListeners();
        
        this.loadLectures();
        this.setupRecordingButton();
        this.loadCourseDetails();
        this.setupToast();
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

    async loadCourseDetails() {
        try {
            const courseId = window.location.pathname.split('/').pop();
            const response = await fetch(`/api/course/${courseId}`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('courseCode').textContent = data.course.code;
                document.getElementById('courseName').textContent = data.course.name;
                
                // Set the course description if it exists
                const descriptionElement = document.getElementById('courseDescription');
                if (descriptionElement && data.course.description) {
                    descriptionElement.textContent = data.course.description;
                }
                
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
                this.lectures = data.recordings;
                this.filterAndSortLectures();
                this.updateLectureCount(data.recordings.length);
            }
        } catch (error) {
            console.error('Error loading lectures:', error);
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
        const container = document.querySelector('.lecture-list');
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

    setupToast() {
        // Create toast container if it doesn't exist
        if (!document.querySelector('.toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.innerHTML = `
                <div id="deleteToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header">
                        <strong class="me-auto">Delete Lecture</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        Are you sure you want to delete this lecture? This action cannot be undone.
                        <div class="mt-2 pt-2 border-top">
                            <button type="button" class="btn btn-danger btn-sm" id="confirmDeleteBtn">Delete</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="toast">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(toastContainer);
        }
    }

    showDeleteToast(lectureId, card) {
        const toast = new bootstrap.Toast(document.getElementById('deleteToast'));
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        // Remove any existing listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Add click event to the new button
        newConfirmBtn.addEventListener('click', async () => {
            try {
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
                    toast.hide();
                } else {
                    throw new Error(data.error || 'Failed to delete lecture');
                }
            } catch (error) {
                console.error('Error deleting lecture:', error);
                alert('Failed to delete lecture. Please try again.');
            }
        });
        
        toast.show();
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
                    <h3>${lecture.title || 'Untitled Lecture'}</h3>
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

        const deleteBtn = card.querySelector('.delete-lecture');
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const lectureId = deleteBtn.getAttribute('data-id');
            this.showDeleteToast(lectureId, card);
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