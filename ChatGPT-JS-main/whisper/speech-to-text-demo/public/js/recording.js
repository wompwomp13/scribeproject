class RecordingStudio {
    constructor() {
        console.log('Initializing RecordingStudio...');
        updateDebug('Starting initialization...');
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
    }

    async loadCourses() {
        try {
            updateDebug('Fetching courses...');
            console.log('Fetching courses from API...');
            
            const response = await fetch('/api/courses');
            console.log('Response received:', response.status);
            updateDebug(`API Response: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Course data received:', data);
            updateDebug(`Found ${data.courses ? data.courses.length : 0} courses`);
            
            if (!data.success) {
                throw new Error('Failed to fetch courses');
            }

            this.populateCourseSelect(data.courses);
        } catch (error) {
            console.error('Error loading courses:', error);
            updateDebug(`Error: ${error.message}`);
            this.handleCourseLoadError();
        }
    }

    populateCourseSelect(courses) {
        if (!Array.isArray(courses)) {
            console.error('Courses data is not an array:', courses);
            updateDebug('Error: Invalid course data');
            this.handleCourseLoadError();
            return;
        }

        try {
            this.courseSelect.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Choose a course...';
            this.courseSelect.appendChild(defaultOption);
            
            const sortedCourses = courses.sort((a, b) => 
                (a.code || '').localeCompare(b.code || '')
            );

            let addedCourses = 0;
            sortedCourses.forEach(course => {
                if (course._id && (course.code || course.name)) {
                    const option = document.createElement('option');
                    option.value = course._id;
                    option.textContent = course.code ? 
                        `${course.code} - ${course.name}` : 
                        course.name;
                    this.courseSelect.appendChild(option);
                    addedCourses++;
                    console.log('Added course:', option.textContent);
                }
            });

            updateDebug(`Loaded ${addedCourses} courses successfully`);
            console.log(`Added ${addedCourses} courses to select`);
        } catch (error) {
            console.error('Error populating select:', error);
            updateDebug(`Error populating select: ${error.message}`);
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