class CourseManager {
    constructor() {
        this.courses = [];
        this.filteredCourses = [];
        this.currentCourseId = null;
        this.searchText = '';
        this.sortOption = 'name-asc';
        this.setupEventListeners();
        this.loadCourses();
        this.loadInstructors();

        // Add event listener for user changes
        window.addEventListener('userAdded', () => {
            this.loadInstructors();
        });
    }

    setupEventListeners() {
        // Initialize Bootstrap modal
        this.courseModal = new bootstrap.Modal(document.getElementById('courseModal'));
        
        // Handle modal hidden event
        document.getElementById('courseModal').addEventListener('hidden.bs.modal', () => {
            // Clear form when modal is closed
            document.getElementById('courseForm').reset();
            // Remove any temporary instructor options
            const instructorSelect = document.getElementById('courseInstructor');
            Array.from(instructorSelect.options).forEach(option => {
                if (option.dataset.temporary) {
                    option.remove();
                }
            });
        });

        // Add event listeners for search and sort
        const searchInput = document.getElementById('courseSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchText = e.target.value.toLowerCase();
                this.filterAndSortCourses();
            });
        }

        const sortSelect = document.getElementById('sortCourses');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortOption = e.target.value;
                this.filterAndSortCourses();
            });
        }
    }

    filterAndSortCourses() {
        // First filter courses based on search text
        this.filteredCourses = this.courses.filter(course => {
            const courseName = (course.name || '').toLowerCase();
            const courseCode = (course.code || '').toLowerCase();
            const courseDescription = (course.description || '').toLowerCase();
            
            return courseName.includes(this.searchText) || 
                   courseCode.includes(this.searchText) ||
                   courseDescription.includes(this.searchText);
        });

        // Then sort the filtered courses
        this.filteredCourses.sort((a, b) => {
            switch (this.sortOption) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'date-new':
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                case 'date-old':
                    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                default:
                    return 0;
            }
        });

        // Render the filtered and sorted courses
        this.renderFilteredCourses();
    }

    renderFilteredCourses() {
        const container = document.querySelector('.courses-grid');
        container.innerHTML = '';

        if (this.filteredCourses.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = `
                <i class="bi bi-search"></i>
                <p>No courses found matching "${this.searchText}"</p>
            `;
            container.appendChild(noResults);
            return;
        }

        this.filteredCourses.forEach(course => {
            const card = this.createCourseCard(course);
            container.appendChild(card);
        });
    }

    async loadCourses() {
        try {
            const response = await fetch('/api/courses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.success) {
                this.courses = data.courses;
                this.filteredCourses = [...this.courses];
                this.filterAndSortCourses();
                // Dispatch event for course list update
                window.dispatchEvent(new CustomEvent('coursesUpdated', {
                    detail: { courses: this.courses }
                }));
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            // Keep existing courses if API fails
            this.filterAndSortCourses();
        }
    }

    async loadInstructors() {
        try {
            const response = await fetch('/api/users?role=teacher');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('courseInstructor');
                const currentValue = select.value; // Store current selection
                
                select.innerHTML = '<option value="">Select Instructor</option>';
                
                data.users.forEach(instructor => {
                    const option = document.createElement('option');
                    option.value = instructor._id;
                    option.textContent = instructor.name;
                    select.appendChild(option);
                });

                // Restore selection if it still exists
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        } catch (error) {
            console.error('Error loading instructors:', error);
        }
    }

    renderCourses() {
        // Use filterAndSortCourses method instead, which calls renderFilteredCourses
        this.filterAndSortCourses();
    }

    createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        // Safely handle instructor data
        let instructorName = 'No Instructor';
        let instructorInitials = 'NA';
        
        if (course.instructor) {
            if (typeof course.instructor === 'object' && course.instructor.name) {
                instructorName = course.instructor.name;
            } else if (typeof course.instructor === 'string') {
                instructorName = course.instructor;
            }
            
            // Only create initials if we have a valid instructor name
            if (instructorName !== 'No Instructor') {
                instructorInitials = instructorName
                    .split(' ')
                    .map(n => n[0])
                    .join('');
            }
        }

        card.innerHTML = `
            <div class="course-header">
                <div class="course-info" style="width: 100%; text-align: center;">
                    <h3 style="text-align: center;">${course.name || 'Untitled Course'}</h3>
                    <div class="course-code" style="text-align: center;">${course.code || 'No Code'}</div>
                </div>
                <div class="course-actions">
                    <button class="action-btn" onclick="courseManager.handleEditCourse('${course._id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="action-btn" onclick="courseManager.handleDeleteCourse('${course._id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="course-details">
                <div class="instructor-info">
                    <div class="instructor-avatar">
                        ${instructorInitials}
                    </div>
                    <span>${instructorName}</span>
                </div>
                <p class="course-description">${course.description || ''}</p>
                <div class="course-status ${course.status || 'active'}">
                    ${course.status || 'active'}
                </div>
            </div>
        `;
        
        return card;
    }

    handleAddCourse() {
        this.currentCourseId = null;
        document.getElementById('courseForm').reset();
        document.querySelector('#courseModal .modal-title').textContent = 'Add Course';
        this.courseModal.show();
    }

    handleEditCourse(courseId) {
        const course = this.courses.find(c => c._id === courseId);
        if (!course) {
            console.error('Course not found:', courseId);
            return;
        }

        this.currentCourseId = courseId;
        document.getElementById('courseName').value = course.name || '';
        document.getElementById('courseCode').value = course.code || '';
        document.getElementById('courseDescription').value = course.description || '';
        
        // Find and select the instructor
        const instructorSelect = document.getElementById('courseInstructor');
        let instructorId = '';
        
        if (course.instructor) {
            if (typeof course.instructor === 'object' && course.instructor._id) {
                instructorId = course.instructor._id;
            } else if (typeof course.instructor === 'string') {
                instructorId = course.instructor;
            }
        }
        
        // Set the instructor in the dropdown
        if (instructorId) {
            instructorSelect.value = instructorId;
            // If the value wasn't set (instructor not in list), add a temporary option
            if (instructorSelect.value !== instructorId) {
                const tempOption = document.createElement('option');
                tempOption.value = instructorId;
                tempOption.textContent = course.instructor.name || 'Unknown Instructor';
                tempOption.dataset.temporary = 'true';
                instructorSelect.appendChild(tempOption);
                instructorSelect.value = instructorId;
            }
        }

        document.querySelector('#courseModal .modal-title').textContent = 'Edit Course';
        this.courseModal.show();
    }

    showNotification(message, type = 'success') {
        const toast = document.getElementById('saveToast');
        const toastMessage = document.getElementById('toastMessage');
        
        // Clear previous classes
        toast.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info');
        
        // Add the appropriate toast color class
        toast.classList.add(`toast-${type}`);
        
        // Update icon based on type
        let icon = 'check-circle';
        if (type === 'error') icon = 'x-circle';
        else if (type === 'warning') icon = 'exclamation-triangle';
        else if (type === 'info') icon = 'info-circle';
        
        // Update message and icon
        const iconElement = toast.querySelector('.bi');
        iconElement.className = `bi bi-${icon}`;
        toastMessage.textContent = message;
        
        // Initialize Bootstrap toast if not already done
        if (!this.bsToast) {
            this.bsToast = new bootstrap.Toast(toast, {
                delay: 3000
            });
        }
        
        // Show the toast
        this.bsToast.show();
    }

    async handleSaveCourse() {
        const form = document.getElementById('courseForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const courseData = {
            name: document.getElementById('courseName').value,
            code: document.getElementById('courseCode').value,
            instructor: document.getElementById('courseInstructor').value,
            description: document.getElementById('courseDescription').value,
            status: 'active'
        };

        try {
            const url = this.currentCourseId ? 
                `/api/courses/${this.currentCourseId}` : 
                '/api/courses';
            
            const method = this.currentCourseId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            if (data.success) {
                // Close modal first
                this.courseModal.hide();
                // Then reload courses
                await this.loadCourses();
                // Show success notification
                this.showNotification(
                    `Course ${this.currentCourseId ? 'updated' : 'created'} successfully!`
                );
                // Dispatch event for dashboard update
                window.dispatchEvent(new CustomEvent('courseChanged', {
                    detail: { 
                        action: this.currentCourseId ? 'update' : 'create',
                        course: data.course
                    }
                }));
            } else {
                throw new Error(data.error || 'Failed to save course');
            }
        } catch (error) {
            console.error('Error saving course:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async handleDeleteCourse(courseId) {
        // Store the courseId for later use when confirmed
        this.courseToDelete = courseId;
        
        // Show the confirmation modal
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        deleteModal.show();
        
        // Set up the confirmation button
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        // Remove any existing listeners to prevent duplicates
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Add click event to the new button
        newConfirmBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/courses/${this.courseToDelete}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    throw new Error('Failed to parse server response');
                }
                
                // Hide the modal
                deleteModal.hide();
                
                if (!response.ok) {
                    throw new Error(data.error || `Server error (${response.status})`);
                }
                
                // Reload courses first to ensure UI is updated
                await this.loadCourses();
                
                // Show success notification
                this.showNotification('Course deleted successfully!');
                
                // Dispatch event for dashboard update
                window.dispatchEvent(new CustomEvent('courseChanged', {
                    detail: { 
                        action: 'delete',
                        courseId: this.courseToDelete
                    }
                }));
            } catch (error) {
                console.error('Error deleting course:', error);
                this.showNotification(
                    `Failed to delete course: ${error.message}`,
                    'error'
                );
                deleteModal.hide();
            }
        });
    }
}

// Initialize the course manager
const courseManager = new CourseManager();

// Global handlers
function handleAddCourse() {
    courseManager.handleAddCourse();
}

function handleSaveCourse() {
    courseManager.handleSaveCourse();
} 