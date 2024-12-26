class CourseManager {
    constructor() {
        this.courses = [];
        this.currentCourseId = null;
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
                this.renderCourses();
                // Dispatch event for course list update
                window.dispatchEvent(new CustomEvent('coursesUpdated', {
                    detail: { courses: this.courses }
                }));
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            // Keep existing courses if API fails
            this.renderCourses();
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
        const container = document.querySelector('.courses-grid');
        container.innerHTML = '';

        this.courses.forEach(course => {
            const card = this.createCourseCard(course);
            container.appendChild(card);
        });
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
                <div class="course-info">
                    <h3>${course.name || 'Untitled Course'}</h3>
                    <div class="course-code">${course.code || 'No Code'}</div>
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
                instructorSelect.appendChild(tempOption);
                instructorSelect.value = instructorId;
            }
        }

        document.querySelector('#courseModal .modal-title').textContent = 'Edit Course';
        this.courseModal.show();
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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Close modal first
                this.courseModal.hide();
                // Then reload courses
                await this.loadCourses();
                // Clear the form
                form.reset();
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
            alert('Failed to save course: ' + error.message);
        }
    }

    async handleDeleteCourse(courseId) {
        if (confirm('Are you sure you want to delete this course?')) {
            try {
                const response = await fetch(`/api/courses/${courseId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    await this.loadCourses();
                    // Dispatch event for dashboard update
                    window.dispatchEvent(new CustomEvent('courseChanged', {
                        detail: { 
                            action: 'delete',
                            courseId: courseId
                        }
                    }));
                }
            } catch (error) {
                console.error('Error deleting course:', error);
                alert('Failed to delete course: ' + error.message);
            }
        }
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