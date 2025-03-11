class RecordingStudio {
    constructor(preSelectedCourse = null) {
        console.log('Initializing RecordingStudio...');
        updateDebug('Starting initialization...');
        this.preSelectedCourse = preSelectedCourse;
        this.initializeElements();
        this.loadCourses();
    }

    initializeElements() {
        this.courseSelect = document.getElementById('courseSelect');
        if (!this.courseSelect) {
            console.error('Course select element not found!');
            updateDebug('Error: Course select not found');
            return;
        }
        console.log('Course select element found');
        updateDebug('Found course select element');

        // If we have a pre-selected course, just set its value
        if (this.preSelectedCourse) {
            this.courseSelect.value = this.preSelectedCourse;
            updateDebug('Pre-selected course set: ' + this.preSelectedCourse);
            
            // Enable recording controls immediately
            const recordButton = document.getElementById('recordButton');
            if (recordButton) {
                recordButton.disabled = false;
            }
        }
    }

    async loadCourses() {
        try {
            updateDebug('Fetching courses...');
            
            // Get the current user's email from localStorage
            const userEmail = localStorage.getItem('currentUserEmail');
            if (!userEmail) {
                window.location.href = '/login.html';
                return;
            }

            // First get the current user's information
            const userResponse = await fetch(`/api/auth/current-user?userEmail=${encodeURIComponent(userEmail)}`);
            const userData = await userResponse.json();
            
            if (!userData.success) {
                throw new Error('Failed to get current user');
            }

            // Fetch only courses assigned to this teacher
            const response = await fetch(`/api/users/${userData.user._id}/courses`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to fetch courses');
            }

            console.log('Course data received:', data);
            updateDebug(`Found ${data.courses ? data.courses.length : 0} courses`);

            // Always populate dropdown with all available courses
            this.courseSelect.innerHTML = '<option value="">Choose a course...</option>';
            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course._id;
                option.textContent = course.name;
                this.courseSelect.appendChild(option);
            });

            // If we have a pre-selected course, select it in the dropdown
            if (this.preSelectedCourse) {
                const selectedCourse = data.courses.find(course => course._id === this.preSelectedCourse);
                if (selectedCourse) {
                    this.courseSelect.value = this.preSelectedCourse;
                    updateDebug(`Pre-selected course: ${selectedCourse.name}`);
                    
                    // Enable recording controls since we have a course selected
                    const recordButton = document.getElementById('recordButton');
                    if (recordButton) {
                        recordButton.disabled = false;
                    }
                }
            }

            // Add change event listener to handle course selection
            this.courseSelect.addEventListener('change', () => {
                const recordButton = document.getElementById('recordButton');
                if (recordButton) {
                    recordButton.disabled = !this.courseSelect.value;
                }
                updateDebug(`Course changed to: ${this.courseSelect.options[this.courseSelect.selectedIndex].text}`);
            });

        } catch (error) {
            console.error('Error loading courses:', error);
            updateDebug(`Error: ${error.message}`);
            this.handleCourseLoadError();
        }
    }

    handleCourseLoadError() {
        this.courseSelect.innerHTML = '<option value="">Error loading courses</option>';
        updateDebug('Failed to load courses');
        console.error('Course loading failed');
    }

    setupRecordingHandlers() {
        this.saveButton = document.getElementById('saveRecording');
        this.titleInput = document.getElementById('lectureTitle');
        this.transcriptionText = document.getElementById('transcriptionText');

        this.saveButton.addEventListener('click', async () => {
            const courseId = this.courseSelect.value;
            if (!courseId) {
                alert('Please select a course before saving');
                return;
            }

            if (!this.titleInput.value.trim()) {
                alert('Please enter a title for the lecture');
                return;
            }

            await this.saveRecording();
        });
    }

    async saveRecording() {
        const courseId = this.courseSelect.value;
        const title = this.titleInput.value.trim();
        const transcription = this.transcriptionText.value;

        // Show loading overlay
        document.getElementById('loadingOverlay').classList.add('active');
        document.getElementById('loadingText').textContent = 'Saving recording...';

        try {
            console.log('Saving recording for course:', courseId);
            updateDebug('Saving recording...');

            const formData = new FormData();
            formData.append('data', this.audioBlob);
            formData.append('title', title);
            formData.append('transcription', transcription);
            formData.append('courseId', courseId);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                console.log('Recording saved successfully:', data);
                updateDebug('Recording saved successfully');
                this.showSuccessMessage();
                
                // Redirect to the course page
                setTimeout(() => {
                    window.location.href = `/tcourse/${courseId}`;
                }, 1500);
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            updateDebug(`Error saving recording: ${error.message}`);
            alert('Failed to save recording. Please try again.');
        } finally {
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    }

    showSuccessMessage() {
        const template = document.getElementById('successMessageTemplate');
        const message = template.content.cloneNode(true);
        document.body.appendChild(message);

        setTimeout(() => {
            const successMessage = document.querySelector('.success-message');
            if (successMessage) {
                successMessage.remove();
            }
        }, 3000);
    }
} 