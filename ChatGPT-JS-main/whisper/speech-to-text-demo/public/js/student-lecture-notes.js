class StudentLectureNotes {
    constructor() {
        this.lectureId = new URLSearchParams(window.location.search).get('id');
        this.courseId = new URLSearchParams(window.location.search).get('courseId');
        this.quill = null; // Initialize Quill reference
        
        if (!this.lectureId) {
            window.location.href = '/studentdashboard.html';
            return;
        }
        
        this.setupEventListeners();
        this.loadLectureData();
        this.setupNotesModification();
        this.initializeQuill();
    }

    initializeQuill() {
        // Initialize Quill with custom options
        this.quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Start taking your notes...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                ]
            }
        });
    }

    setupEventListeners() {
        document.getElementById('saveNotes').addEventListener('click', () => this.saveNotes());
        
        // Set up back to course button
        const backButton = document.querySelector('.back-to-course');
        backButton.href = `/scourse.html?id=${this.courseId}`;
        
        // Set up dashboard link with user's email
        const dashboardLink = document.querySelector('.dashboard-link');
        const userEmail = localStorage.getItem('currentUserEmail');
        if (dashboardLink && userEmail) {
            dashboardLink.href = `/studentdashboard.html?email=${encodeURIComponent(userEmail)}`;
        }
    }

    setupNotesModification() {
        // Set up modify notes button
        const modifyBtn = document.getElementById('modifyNotesBtn');
        const closeBtn = document.getElementById('closeSidebar');
        const savePreferencesBtn = document.getElementById('savePreferences');
        const sidebar = document.getElementById('modifySidebar');

        modifyBtn.addEventListener('click', () => this.toggleSidebar());
        closeBtn.addEventListener('click', () => this.closeSidebar());
        savePreferencesBtn.addEventListener('click', () => this.handleSavePreferences());

        // Handle click outside
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && 
                !modifyBtn.contains(e.target) && 
                sidebar.classList.contains('active')) {
                this.closeSidebar();
            }
        });

        // Load saved preferences
        this.loadSavedPreferences();
    }

    toggleSidebar() {
        const sidebar = document.getElementById('modifySidebar');
        sidebar.classList.toggle('active');
    }

    closeSidebar() {
        const sidebar = document.getElementById('modifySidebar');
        sidebar.classList.remove('active');
    }

    async loadLectureData() {
        try {
            console.log('Loading lecture data for ID:', this.lectureId);
            const response = await fetch(`/api/recordings/${this.lectureId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received lecture data:', data);
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load lecture data');
            }
            
            await this.loadCourseDetails();
            this.updateUI(data.recording);
            this.loadNotes();
            
        } catch (error) {
            console.error('Error loading lecture:', error);
            alert('Failed to load lecture data: ' + error.message);
        }
    }

    async loadCourseDetails() {
        if (!this.courseId) return;

        try {
            const response = await fetch(`/api/course/${this.courseId}`);
            const data = await response.json();
            
            if (data.success) {
                const courseBreadcrumb = document.getElementById('courseBreadcrumb');
                courseBreadcrumb.textContent = data.course.name;
                courseBreadcrumb.href = `/scourse.html?id=${this.courseId}`;
            }
        } catch (error) {
            console.error('Error loading course details:', error);
        }
    }

    updateUI(lecture) {
        console.log('Updating UI with lecture:', lecture);
        
        // Update title and breadcrumb
        const title = lecture.title || 'Untitled Lecture';
        document.getElementById('lectureTitle').textContent = title;
        document.getElementById('lectureBreadcrumb').textContent = title;
        
        // Update date
        if (lecture.createdAt) {
            document.getElementById('lectureDate').textContent = 
                new Date(lecture.createdAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
        }
        
        // Update audio player with enhanced error handling
        const audio = document.getElementById('lectureAudio');
        if (lecture.audioFile) {
            try {
                // Debug logging for audioFile object
                console.log('Audio file object details:', JSON.stringify(lecture.audioFile, null, 2));
                
                // AUDIO URL SELECTION LOGIC
                let audioUrl = null;
                
                // Priority 1: If it's a Dropbox URL and we have a path, use that directly
                if (lecture.audioFile.isDropbox === true && lecture.audioFile.path) {
                    console.log('Using Dropbox path directly:', lecture.audioFile.path);
                    audioUrl = lecture.audioFile.path;
                } 
                // Priority 2: If there's a URL provided by the server, use that
                else if (lecture.audioFile.url) {
                    console.log('Using server-provided URL:', lecture.audioFile.url);
                    audioUrl = lecture.audioFile.url;
                }
                // Priority 3: Fall back to local file path if nothing else works
                else if (lecture.audioFile.filename) {
                    console.log('Falling back to local file path:', lecture.audioFile.filename);
                    audioUrl = `/uploads/${lecture.audioFile.filename}`;
                }
                
                if (!audioUrl) {
                    throw new Error('No valid audio URL could be determined');
                }
                
                console.log('Final audio URL set to:', audioUrl);
                audio.src = audioUrl;
                
                // Add detailed error logging
                audio.onerror = (e) => {
                    console.error('Error loading audio:', e);
                    console.error('Audio error code:', audio.error ? audio.error.code : 'unknown');
                    console.error('Audio error message:', audio.error ? audio.error.message : 'unknown');
                    console.error('Audio src that failed:', audio.src);
                    
                    // Display error message below audio player
                    const audioSection = document.querySelector('.audio-section');
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'alert alert-danger mt-2';
                    errorMsg.innerHTML = `<strong>Error:</strong> Could not load audio file. <br>
                        Please contact your teacher or try again later.`;
                    audioSection.appendChild(errorMsg);
                };
                
                audio.onloadeddata = () => {
                    console.log('Audio loaded successfully from:', audio.src);
                };
            } catch (error) {
                console.error('Error setting audio source:', error);
            }
        } else {
            console.error('No audio file found in lecture data');
            
            // Display missing audio message
            const audioSection = document.querySelector('.audio-section');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'alert alert-warning mt-2';
            errorMsg.textContent = 'No audio recording is available for this lecture.';
            audioSection.appendChild(errorMsg);
        }
        
        // Update transcription
        const transcriptionElement = document.getElementById('transcriptionText');
        if (lecture.transcription && lecture.transcription.text) {
            // First show the raw transcription
            transcriptionElement.textContent = lecture.transcription.text;
            
            // Then format the transcription with Groq
            this.formatTranscript(lecture.transcription.text);
            
            const handler = new DefinitionsHandler();
            handler.initializeSection(transcriptionElement.parentElement);
        } else {
            console.error('No transcription found in lecture data');
            transcriptionElement.textContent = 'No transcription available';
        }

        // Set initial audio section visibility based on preferences
        const savedPreferences = localStorage.getItem('notePreferences');
        if (savedPreferences) {
            const preferences = JSON.parse(savedPreferences);
            const audioSection = document.querySelector('.audio-section');
            if (audioSection) {
                audioSection.style.display = preferences.audio ? 'block' : 'none';
            }
        } else {
            // Hide audio section by default
            const audioSection = document.querySelector('.audio-section');
            if (audioSection) {
                audioSection.style.display = 'none';
            }
        }
    }

    // Add this new method for formatting the transcript
    async formatTranscript(transcription) {
        try {
            // Show loading indicator
            const transcriptionElement = document.getElementById('transcriptionText');
            transcriptionElement.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Preparing Lecture Notes...</p></div>';
            
            const response = await fetch('/api/format-transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transcription })
            });
            
            if (!response.ok) {
                throw new Error('Failed to format transcript');
            }
            
            const data = await response.json();
            
            if (data.success && data.formattedTranscript) {
                // Update with formatted transcript using innerHTML to render markdown
                transcriptionElement.innerHTML = marked.parse(data.formattedTranscript);
                
                // Re-initialize definitions handler
                const handler = new DefinitionsHandler();
                handler.initializeSection(transcriptionElement.parentElement);
            } else {
                // Fallback to original transcription
                transcriptionElement.textContent = transcription;
            }
        } catch (error) {
            console.error('Error formatting transcript:', error);
            // Fallback to original transcription
            const transcriptionElement = document.getElementById('transcriptionText');
            transcriptionElement.textContent = transcription;
        }
    }

    async loadNotes() {
        try {
            const response = await fetch(`/api/recordings/${this.lectureId}/notes`);
            if (!response.ok) {
                throw new Error('Failed to fetch notes');
            }
            
            const data = await response.json();
            console.log('Loaded notes:', data);
            
            if (data.success && data.notes && this.quill) {
                // Set Quill content
                this.quill.setContents(JSON.parse(data.notes.content));
            }
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    async saveNotes() {
        if (!this.quill) return;

        try {
            const content = this.quill.getContents();
            const response = await fetch(`/api/recordings/${this.lectureId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: JSON.stringify(content)
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save notes');
            }

            this.showToastNotification('Notes saved successfully!');
        } catch (error) {
            console.error('Error saving notes:', error);
            this.showToastNotification('Failed to save notes', false);
        }
    }

    async handleSavePreferences() {
        const preferences = {
            summarization: document.getElementById('summarization').checked,
            flashcards: document.getElementById('flashcards').checked,
            audio: document.getElementById('audio').checked,
            visual: document.getElementById('visual').checked,
            kinesthetic: document.getElementById('kinesthetic').checked
        };

        // Save preferences to localStorage
        localStorage.setItem('notePreferences', JSON.stringify(preferences));

        // Handle audio section visibility
        const audioSection = document.querySelector('.audio-section');
        if (audioSection) {
            audioSection.style.display = preferences.audio ? 'block' : 'none';
        }

        // Handle summarization if selected
        if (preferences.summarization) {
            await this.handleSummarization();
        }

        // Handle flashcards if selected
        if (preferences.flashcards) {
            await this.handleFlashcards();
        }

        // Handle visual learning if selected
        if (preferences.visual) {
            await this.handleVisualLearning();
        }

        // Handle kinesthetic learning if selected
        if (preferences.kinesthetic) {
            await this.handleKinestheticLearning();
        }

        // Show toast notification
        this.showToastNotification('Preferences saved successfully');
        this.closeSidebar();

        // Add this to your existing handleSavePreferences method
        const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const card = e.target.closest('.preference-card');
                if (e.target.checked) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        });
    }

    async handleSummarization() {
        try {
            // Show loading state
            this.showLoadingState('Generating lecture summary...');

            // Get the transcription text
            const transcriptionElement = document.getElementById('transcriptionText');
            const transcription = transcriptionElement.textContent || transcriptionElement.innerText;
            
            console.log('Sending transcription for summarization, length:', transcription.length);

            // Send request to summarize
            const response = await fetch('/api/summarize-lecture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transcription })
            });

            const data = await response.json();
            console.log('Response from server:', data);

            if (!response.ok) {
                console.error('Server returned error:', data);
                throw new Error(data.error || `Failed to generate summary (status ${response.status})`);
            }

            if (!data.success) {
                console.error('API reported error:', data);
                throw new Error(data.error || 'Failed to generate summary');
            }

            if (!data.summary) {
                console.error('No summary data in response:', data);
                throw new Error('No summary data received from server');
            }

            console.log('Received summary data:', JSON.stringify(data.summary, null, 2));

            // Validate summary structure before rendering
            this.validateSummaryStructure(data.summary);

            // Update the summary section
            this.updateSummaryContent(data.summary);
            document.querySelector('.summary-section').style.display = 'block';

        } catch (error) {
            console.error('Summarization error:', error);
            this.showToastNotification('Failed to generate summary: ' + error.message, false);
            
            // Show error in summary section rather than hiding it
            document.querySelector('.summary-section').style.display = 'block';
            document.querySelector('.summary-title').textContent = 'Summary Generation Error';
            document.getElementById('mainThesis').textContent = 'We encountered an error while generating your summary.';
            document.getElementById('context').textContent = 'Error details: ' + error.message;
            document.getElementById('significance').textContent = 'Please try again or check the browser console for more information.';
            
            // Clear other sections to avoid displaying partial/incorrect data
            document.getElementById('keyPoints').innerHTML = '';
            document.getElementById('applications').innerHTML = '';
        } finally {
            this.hideLoadingState();
        }
    }

    validateSummaryStructure(summary) {
        // Check required top-level fields
        const requiredFields = ['title', 'overview', 'keyTopics', 'practicalApplications'];
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!summary[field]) {
                missingFields.push(field);
                console.error(`Missing required field in summary: ${field}`);
            }
        }
        
        if (missingFields.length > 0) {
            throw new Error(`Summary is missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Check nested fields
        if (!summary.overview.mainThesis) {
            console.warn('Missing mainThesis in overview');
        }
        
        if (!Array.isArray(summary.keyTopics) || summary.keyTopics.length === 0) {
            console.warn('keyTopics is empty or not an array');
        }
        
        if (!Array.isArray(summary.practicalApplications) || summary.practicalApplications.length === 0) {
            console.warn('practicalApplications is empty or not an array');
        }
    }

    updateSummaryContent(summary) {
        // Update title and overview
        document.querySelector('.summary-title').textContent = summary.title || '';
        document.getElementById('mainThesis').textContent = summary.overview?.mainThesis || '';
        document.getElementById('context').textContent = summary.overview?.context || '';
        document.getElementById('significance').textContent = summary.overview?.significance || '';

        // Update key points
        if (summary.keyTopics) {
            document.getElementById('keyPoints').innerHTML = `
                ${summary.keyTopics.map(topic => `
                    <div class="key-point">
                        <div class="point-header">
                            <h5><i class="bi bi-arrow-right-circle"></i> ${topic.heading || ''}</h5>
                        </div>
                        <div class="point-content">
                            <ul>
                                ${topic.mainPoints?.map(point => `
                                    <li class="definable">${point}</li>
                                `).join('') || ''}
                            </ul>
                            ${topic.details?.length ? `
                                <div class="supporting-details">
                                    <h6>Supporting Evidence & Examples</h6>
                                    <ul class="details-list">
                                        ${topic.details.map(detail => `
                                            <li class="definable">${detail}</li>
                                        `).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            `;
        }

        // Update practical applications
        if (summary.practicalApplications) {
            document.getElementById('applications').innerHTML = `
                ${summary.practicalApplications.map(app => `
                    <div class="application-card">
                        <div class="application-header">
                            <i class="bi bi-gear"></i>
                            <h5>${app.scenario || ''}</h5>
                        </div>
                        <p class="definable">${app.explanation || ''}</p>
                    </div>
                `).join('')}
            `;
        }

        // Initialize definitions handler for the new summary content
        const handler = new DefinitionsHandler();
        handler.initializeSection(document.querySelector('.summary-section'));
    }

    async handleVisualLearning() {
        try {
            this.showLoadingState('Preparing visual learning content...');
            
            // Get the lecture ID from URL
            const lectureId = this.getLectureIdFromUrl();
            if (!lectureId) {
                throw new Error('Lecture ID not found');
            }

            // Fetch raw transcript
            const rawResponse = await fetch(`/api/recordings/${lectureId}/raw-transcript`);
            if (!rawResponse.ok) throw new Error('Failed to fetch raw transcript');
            
            const rawData = await rawResponse.json();
            if (!rawData.success || !rawData.rawTranscript) {
                throw new Error(rawData.error || 'No transcript available for this lecture');
            }

            // Extract key terms from raw transcript
            const response = await fetch('/api/extract-key-terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    transcription: rawData.rawTranscript,
                    lectureTitle: document.getElementById('lectureTitle')?.textContent || '',
                    courseName: document.getElementById('courseBreadcrumb')?.textContent || ''
                })
            });

            if (!response.ok) throw new Error('Failed to extract key terms');
            
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to extract key terms');

            // Process the sections data
            if (data.sections && data.sections.length > 0) {
                await this.updateVisualLearningSection(data.sections);
                this.showToastNotification('Visual learning content ready');
            } else {
                throw new Error('No visual learning sections were generated');
            }
        } catch (error) {
            console.error('Visual learning error:', error);
            this.showToastNotification('Failed to process visual learning: ' + error.message, false);
            
            // Show error in visual learning section
            const visualLearningSection = document.getElementById('visual-learning-section') || 
                                      document.querySelector('.visual-learning-section');
            if (visualLearningSection) {
                visualLearningSection.innerHTML = '<h2>Visual Learning</h2>' +
                    '<p class="error">Failed to generate visual learning content: ' + error.message + '</p>';
                visualLearningSection.style.display = 'block';
            }
        } finally {
            this.hideLoadingState();
        }
    }

    // Process the sections and update the UI
    async updateVisualLearningSection(sections) {
        const visualLearningSection = document.getElementById('visual-learning-section') || 
                                  document.querySelector('.visual-learning-section');
        
        if (!visualLearningSection) {
            throw new Error('Visual learning section not found in the DOM');
        }

        // Clear existing content and set the title
        visualLearningSection.innerHTML = '<h2>Visual Learning</h2>';
        visualLearningSection.style.display = 'block';
        
        // Limit to 5 sections for initial testing
        const limitedSections = sections.slice(0, 5);
        
        if (limitedSections.length === 0) {
            visualLearningSection.innerHTML += '<p class="no-results">No visual learning items could be generated for this lecture.</p>';
            return;
        }
        
        // Create a container for the visual learning slideshow
        const slideContainer = document.createElement('div');
        slideContainer.className = 'visual-slideshow-container';
        
        // Add slides for each term
        for (const section of limitedSections) {
            try {
                // Search for an image related to the term
                const imageUrl = await this.searchImageForTerm(section.term);
                
                // Create the slide
                const slide = document.createElement('div');
                slide.className = 'visual-slide';
                
                // Create the content for the slide
                slide.innerHTML = `
                    <div class="visual-slide-content">
                        <div class="visual-slide-image">
                            <img src="${imageUrl}" alt="${section.term}" onerror="this.style.display='none'">
                        </div>
                        <div class="visual-slide-text">
                            <h3>${section.term}</h3>
                            <p>${section.explanation}</p>
                        </div>
                    </div>
                `;
                
                // Add the slide to the container
                slideContainer.appendChild(slide);
            } catch (error) {
                console.error(`Error creating visual item for ${section.term}:`, error);
            }
        }
        
        if (slideContainer.children.length === 0) {
            visualLearningSection.innerHTML += '<p class="no-results">Failed to create any visual learning items.</p>';
            return;
        }
        
        // Show first slide initially
        slideContainer.querySelector('.visual-slide').style.display = 'block';
        
        // Create navigation controls
        const navigation = document.createElement('div');
        navigation.className = 'visual-slide-navigation';
        navigation.innerHTML = `
            <button class="slide-btn prev-slide" disabled>
                    <i class="bi bi-chevron-left"></i> Previous
                </button>
            <span class="slide-counter">1/${slideContainer.children.length}</span>
            <button class="slide-btn next-slide" ${slideContainer.children.length > 1 ? '' : 'disabled'}>
                    Next <i class="bi bi-chevron-right"></i>
                </button>
            `;

        // Add the slideshow and navigation to the section
        visualLearningSection.appendChild(slideContainer);
        visualLearningSection.appendChild(navigation);
        
        // Set up navigation
        this.setupVisualSlideNavigation(slideContainer, navigation);
    }

    // New helper method to set up slide navigation (extracted for clarity)
    setupVisualSlideNavigation(slideContainer, navigation) {
        const prevButton = navigation.querySelector('.prev-slide');
        const nextButton = navigation.querySelector('.next-slide');
        const slideCounter = navigation.querySelector('.slide-counter');
        const slides = slideContainer.querySelectorAll('.visual-slide');
            let currentSlide = 0;
        
        // Function to update navigation buttons state
        const updateNavigation = () => {
            prevButton.disabled = currentSlide === 0;
            nextButton.disabled = currentSlide === slides.length - 1;
            slideCounter.textContent = `${currentSlide + 1}/${slides.length}`;
        };
        
        // Add click handlers for navigation
        prevButton.addEventListener('click', () => {
                    if (currentSlide > 0) {
                slides[currentSlide].style.display = 'none';
                currentSlide--;
                slides[currentSlide].style.display = 'block';
                updateNavigation();
                    }
                });

        nextButton.addEventListener('click', () => {
                    if (currentSlide < slides.length - 1) {
                slides[currentSlide].style.display = 'none';
                currentSlide++;
                slides[currentSlide].style.display = 'block';
                updateNavigation();
            }
        });
    }

    // Improved image search function with better error handling and optimization
    async searchImageForTerm(term) {
        if (!term) return null;
        
        try {
            // First try with educational focus
            const response = await fetch('/api/search-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: ` educational concept illustration about ${term}`,
                }),
            });
            
            if (!response.ok) {
                throw new Error(`Image search failed with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.imageUrl) {
                return data.imageUrl;
            }
            
            // If first attempt failed, try a more general search
            if (!data.imageUrl) {
                const fallbackResponse = await fetch('/api/search-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: `${term} visualization` }),
                });
                
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData.success && fallbackData.imageUrl) {
                        return fallbackData.imageUrl;
                    }
                }
            }
            
            console.warn(`No image found for term: ${term}`);
            return null;
        } catch (error) {
            console.error(`Error searching image for "${term}":`, error);
            return null;
        }
    }

    loadSavedPreferences() {
        try {
            const savedPreferences = localStorage.getItem('notePreferences');
            if (savedPreferences) {
                const preferences = JSON.parse(savedPreferences);
                Object.entries(preferences).forEach(([key, value]) => {
                    const checkbox = document.getElementById(key);
                    if (checkbox) {
                        checkbox.checked = value;
                        // Set initial active state
                        const card = checkbox.closest('.preference-card');
                        if (value) {
                            card.classList.add('active');
                        } else {
                            card.classList.remove('active');
                        }
                    }
                });

                // Set initial audio section visibility
                const audioSection = document.querySelector('.audio-section');
                if (audioSection) {
                    audioSection.style.display = preferences.audio ? 'block' : 'none';
                }

                // Set initial flashcards section visibility
                const flashcardsSection = document.querySelector('.flashcards-section');
                if (flashcardsSection && !preferences.flashcards) {
                    flashcardsSection.style.display = 'none';
                }

            } else {
                // Hide sections by default
                const audioSection = document.querySelector('.audio-section');
                if (audioSection) {
                    audioSection.style.display = 'none';
                }
                const flashcardsSection = document.querySelector('.flashcards-section');
                if (flashcardsSection) {
                    flashcardsSection.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }

    showLoadingState(message = 'Processing...') {
        const loader = document.createElement('div');
        loader.className = 'summary-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <p>${message}</p>
        `;
        document.body.appendChild(loader);
    }

    hideLoadingState() {
        const loader = document.querySelector('.summary-loader');
        if (loader) {
            loader.remove();
        }
    }

    showToastNotification(message, isSuccess = true, duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${isSuccess ? 'success' : 'error'}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}"></i>
                <span class="toast-message">${message}</span>
            </div>
            <div class="toast-progress">
                <div class="progress-bar"></div>
            </div>
        `;

        document.body.appendChild(toast);

        // Animate progress bar
        const progressBar = toast.querySelector('.progress-bar');
        progressBar.style.transition = `width ${duration}ms linear`;
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 10);

        // Dismiss toast after duration
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);

        // Make toast dismissible on click
        toast.addEventListener('click', () => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
    }

    async handleKinestheticLearning() {
        try {
            // Show loading state
            const loader = document.createElement('div');
            loader.className = 'summary-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p>Preparing interactive quizzes...</p>
                <small>This may take a moment</small>
            `;
            document.body.appendChild(loader);

            // Get the transcription and title
            const transcription = document.getElementById('transcriptionText').textContent;
            const lectureTitle = document.getElementById('lectureTitle').textContent;

            // Request quiz from server
            const response = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    transcription,
                    lectureTitle
                })
            });

            if (!response.ok) throw new Error('Failed to generate quiz');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate quiz');
            }

            // Create and show the quiz section
            await this.createQuizSection(data.quiz);

        } catch (error) {
            console.error('Quiz generation error:', error);
            alert('Failed to generate interactive quiz: ' + error.message);
        } finally {
            const loader = document.querySelector('.summary-loader');
            if (loader) loader.remove();
        }
    }

    async createQuizSection(quizContent) {
        // Remove existing quiz section if it exists
        const existingQuiz = document.querySelector('.kinesthetic-section');
        if (existingQuiz) {
            existingQuiz.remove();
        }

        // Create quiz section
        const quizSection = document.createElement('section');
        quizSection.className = 'kinesthetic-section';
        
        // Apply the background color to the section
        quizSection.style.backgroundColor = '#e0ebe6';
        quizSection.style.padding = '1.5rem';
        quizSection.style.borderRadius = '0.8rem';
        
        // Initial HTML with quiz mode selection
        quizSection.innerHTML = `
            <h2>Interactive Quizzes</h2>
            <div class="mode-selector">
                <button class="mode-btn active" data-mode="categorization" style="background-color: #7e9ebf; color: white;">Drag & Drop Quiz</button>
                <button class="mode-btn" data-mode="multipleChoice" style="background-color: #7e9ebf; color: white;">Multiple Choice Quiz</button>
            </div>
            <div class="quiz-container">
                <div class="categorization-mode active" id="categorizationQuiz"></div>
                <div class="multiple-choice-mode" id="multipleChoiceQuiz"></div>
            </div>
        `;
        
        // Add to content grid
        const contentGrid = document.querySelector('.content-grid');
        contentGrid.appendChild(quizSection);

        // Create both quiz types
        this.createCategorizationQuiz(quizContent.categorization, document.getElementById('categorizationQuiz'));
        this.createMultipleChoiceQuiz(quizContent.multipleChoice, document.getElementById('multipleChoiceQuiz'));

        // Add event listeners for mode buttons
        const modeButtons = quizSection.querySelectorAll('.mode-btn');
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button
                modeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    // Reset background color for inactive button
                    btn.style.backgroundColor = '#7e9ebf';
                });
                button.classList.add('active');
                // Highlight active button with slightly darker color
                button.style.backgroundColor = '#6b88a7';
                
                // Show the selected quiz mode
                const mode = button.dataset.mode;
                document.getElementById('categorizationQuiz').classList.toggle('active', mode === 'categorization');
                document.getElementById('multipleChoiceQuiz').classList.toggle('active', mode === 'multipleChoice');
            });
        });

        // Initialize the categorization drag and drop
        this.initializeCategorizationDragDrop();
    }

    createCategorizationQuiz(quizContent, container) {
        // Shuffle the items for the drag-drop challenge
        const shuffledItems = [...quizContent.items]
            .sort(() => Math.random() - 0.5);

        const quizHTML = `
            <h3>Drag & Drop Categorization Quiz</h3>
            <p class="quiz-instructions">Drag each item to its correct category.</p>
            
            <div class="categorization-quiz">
                <div class="categories-container">
                    ${quizContent.categories.map(category => `
                        <div class="category-column">
                            <div class="category-header">
                                <h3 class="category-title">${category}</h3>
                            </div>
                            <div class="category-items" data-category="${category}">
                                Drop items here
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="items-pool">
                    ${shuffledItems.map(item => `
                        <div class="item" draggable="true" data-category="${item.category}">
                            ${item.text}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="quiz-controls">
                <button class="check-answers-btn" id="checkCategorization">Check Categories</button>
                <button class="reset-quiz-btn" id="resetCategorization">Reset Quiz</button>
            </div>
        `;

        container.innerHTML = quizHTML;

        // Add event listeners for the control buttons
        container.querySelector('#checkCategorization').addEventListener('click', () => this.checkCategorizationAnswers());
        container.querySelector('#resetCategorization').addEventListener('click', () => this.resetCategorizationQuiz());
    }

    createMultipleChoiceQuiz(quizContent, container) {
        const quizHTML = `
            <h3>Multiple Choice Quiz</h3>
            <p class="quiz-instructions">Select the correct answer for each question.</p>
            
            <div class="multiple-choice-quiz">
                <div class="question-container" id="questionContainer">
                    ${quizContent.questions.map((q, qIndex) => `
                        <div class="question" data-question="${qIndex}" ${qIndex === 0 ? 'data-active="true"' : ''}>
                            <h4>Question ${qIndex + 1}</h4>
                            <p>${q.question}</p>
                            <div class="options-container">
                                ${q.options.map((option, oIndex) => `
                                    <div class="option">
                                        <input type="radio" id="q${qIndex}_option${oIndex}" 
                                            name="question${qIndex}" value="${oIndex}"
                                            data-correct="${oIndex === q.correctAnswer}">
                                        <label for="q${qIndex}_option${oIndex}">${option}</label>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="feedback-area" id="feedback_${qIndex}"></div>
                            <div class="explanation-area" id="explanation_${qIndex}" style="display: none;">
                                <div class="explanation-content">
                                    <h5>Explanation:</h5>
                                    <p>${q.explanation || 'No explanation available for this question.'}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="quiz-navigation">
                    <button id="prevQuestion" class="nav-button" disabled>Previous</button>
                    <span class="question-counter">Question <span id="currentQuestion">1</span> of ${quizContent.questions.length}</span>
                    <button id="nextQuestion" class="nav-button">Next</button>
                </div>
                
                <div class="quiz-controls">
                    <button class="check-answers-btn" id="checkMultipleChoice" disabled>Check All Answers</button>
                    <button class="reset-quiz-btn" id="resetMultipleChoice">Reset All</button>
                </div>
            </div>
        `;

        container.innerHTML = quizHTML;

        // Add event listeners for quiz navigation and controls
        this.setupMultipleChoiceNavigation(container, quizContent.questions.length);
        
        // Get the check button
        const checkButton = container.querySelector('.check-answers-btn');
        
        // Add event listeners for the check button
        checkButton.addEventListener('click', () => {
            // Only check answers if button is enabled
            if (!checkButton.disabled) {
                this.checkMultipleChoiceAnswers();
            } else {
                // Mark as attempted to show toast on next updateCheckButtonState call
                checkButton.dataset.attempted = 'true';
                this.updateCheckButtonState();
            }
        });
        
        // Add event listener for reset button
        container.querySelector('.reset-quiz-btn').addEventListener('click', () => this.resetMultipleChoiceQuiz());
        
        // Add event listeners to all radio buttons
        const radios = container.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateCheckButtonState();
            });
        });

        // Initialize check button state
        this.updateCheckButtonState();
    }

    updateCheckButtonState() {
        const multipleChoiceQuiz = document.getElementById('multipleChoiceQuiz');
        if (!multipleChoiceQuiz) return;
        
        const checkButton = multipleChoiceQuiz.querySelector('#checkMultipleChoice');
        if (!checkButton) return;
        
        const questions = multipleChoiceQuiz.querySelectorAll('.question');
        let allAnswered = true;
        let unansweredCount = 0;
        
        questions.forEach(question => {
            const answered = question.querySelector('input[type="radio"]:checked');
            if (!answered) {
                allAnswered = false;
                unansweredCount++;
            }
        });
        
        checkButton.disabled = !allAnswered;
        
        // Use a style directly instead of just adding a class
        if (allAnswered) {
            checkButton.style.opacity = "1";
            checkButton.style.backgroundColor = "var(--button-color)";
            checkButton.style.cursor = "pointer";
            } else {
            checkButton.style.opacity = "0.5";
            checkButton.style.backgroundColor = "#cccccc";
            checkButton.style.cursor = "not-allowed";
        }
        
        // If user clicked check but some questions are unanswered, show a toast
        if (!allAnswered && checkButton.dataset.attempted === 'true') {
            this.showToastNotification(`Please answer all ${unansweredCount} remaining question(s)`, false);
            checkButton.dataset.attempted = 'false';
        }
    }

    setupMultipleChoiceNavigation(container, totalQuestions) {
        const prevButton = container.querySelector('#prevQuestion');
        const nextButton = container.querySelector('#nextQuestion');
        const currentQuestionSpan = container.querySelector('#currentQuestion');
        let currentQuestionIndex = 0;

        // Function to update question visibility
        const updateQuestionVisibility = () => {
            container.querySelectorAll('.question').forEach((question, index) => {
                question.style.display = index === currentQuestionIndex ? 'block' : 'none';
            });
            currentQuestionSpan.textContent = currentQuestionIndex + 1;
            prevButton.disabled = currentQuestionIndex === 0;
            nextButton.disabled = currentQuestionIndex === totalQuestions - 1;
        };

        // Set up navigation event listeners
        prevButton.addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--;
                updateQuestionVisibility();
            }
        });

        nextButton.addEventListener('click', () => {
            if (currentQuestionIndex < totalQuestions - 1) {
                currentQuestionIndex++;
                updateQuestionVisibility();
            }
        });

        // Initialize with first question visible
        updateQuestionVisibility();
    }

    checkMultipleChoiceAnswers() {
        const questions = document.querySelectorAll('.question');
        let allCorrect = true;
        let correctCount = 0;
        const totalQuestions = questions.length;
        
        questions.forEach(question => {
            const questionIndex = question.dataset.question;
            const selectedOption = question.querySelector('input[type="radio"]:checked');
            const feedbackArea = document.getElementById(`feedback_${questionIndex}`);
            const explanationArea = document.getElementById(`explanation_${questionIndex}`);
            
            if (!selectedOption) {
                return; // Skip questions without an answer
            }
            
            const isCorrect = selectedOption.dataset.correct === "true";
            
            if (isCorrect) {
                correctCount++;
                this.showQuizFeedback('Correct!', true, feedbackArea);
            } else {
                const correctOption = question.querySelector('input[data-correct="true"]');
                const correctLabel = correctOption ? correctOption.nextElementSibling.textContent : '';
                this.showQuizFeedback(`Incorrect. The correct answer is: ${correctLabel}`, false, feedbackArea);
                allCorrect = false;
            }
            
            // Show explanation
            if (explanationArea) {
                explanationArea.style.display = 'block';
            }
        });
        
        // Show overall score
        const quizContainer = document.querySelector('.multiple-choice-quiz');
        let scoreDisplay = quizContainer.querySelector('.quiz-score');
        
        if (!scoreDisplay) {
            scoreDisplay = document.createElement('div');
            scoreDisplay.className = 'quiz-score';
            quizContainer.querySelector('.quiz-controls').insertAdjacentElement('beforebegin', scoreDisplay);
        }
        
        // Calculate percentage
        const percentage = Math.round((correctCount / totalQuestions) * 100);
        scoreDisplay.innerHTML = `<div class="score-display">
            <h4>Your Score: ${correctCount}/${totalQuestions} (${percentage}%)</h4>
            <p>Nice work! Take a moment to review your answers and keep learning.</p>
        </div>`;
        
        // Disable check button after checking
        const checkButton = document.getElementById('checkMultipleChoice');
        if (checkButton) {
            checkButton.disabled = true;
        }

        return allCorrect;
    }

    resetMultipleChoiceQuiz() {
        const quiz = document.querySelector('.multiple-choice-quiz');
        if (!quiz) return;
        
        // Clear all selections
        quiz.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.checked = false;
        });
        
        // Clear all feedback
        quiz.querySelectorAll('.feedback-area').forEach(feedback => {
            feedback.innerHTML = '';
        });
        
        // Hide explanations
        quiz.querySelectorAll('.explanation-area').forEach(explanation => {
            explanation.style.display = 'none';
        });
        
        // Disable check button
        const checkButton = document.getElementById('checkMultipleChoice');
        if (checkButton) {
            checkButton.disabled = true;
        }
    }

    // Update the feedback display to work with a specific container
    showQuizFeedback(message, isCorrect, container) {
        // Clear any existing feedback
                    container.innerHTML = '';

        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        feedback.innerHTML = `
            <i class="bi ${isCorrect ? 'bi-check-circle' : 'bi-x-circle'}"></i>
            <span>${message}</span>
        `;

        // Add to container
        container.appendChild(feedback);

        // Auto-remove feedback after a delay (for general feedback only)
        if (container.classList.contains('quiz-feedback-area')) {
        setTimeout(() => {
            feedback.classList.add('fade-out');
                setTimeout(() => feedback.remove(), 3000);
        }, 3000);
    }
    }

    checkCategorizationAnswers() {
                const categoryContainers = document.querySelectorAll('.category-items');
        let allCorrect = true;

                categoryContainers.forEach(container => {
            const correctCategory = container.dataset.category;
                    const items = container.querySelectorAll('.item');
                    
                    items.forEach(item => {
                const isCorrect = item.dataset.category === correctCategory;
                item.classList.remove('correct', 'incorrect');
                item.classList.add(isCorrect ? 'correct' : 'incorrect');
                
                if (!isCorrect) {
                allCorrect = false;
                }
            });
        });

        return allCorrect;
    }

    resetCategorizationQuiz() {
        const pool = document.querySelector('.items-pool');
        const items = document.querySelectorAll('.item');
        
        // Move all items back to pool
        items.forEach(item => {
            pool.appendChild(item);
        });

        // Reset category containers
        document.querySelectorAll('.category-items').forEach(container => {
            if (!container.querySelector('.item')) {
                container.innerHTML = 'Drop items here';
            }
        });
    }

    initializeCategorizationDragDrop() {
        const items = document.querySelectorAll('.item');
        const categoryContainers = document.querySelectorAll('.category-items');
        
        // Set up draggable items
        items.forEach(item => {
            item.addEventListener('dragstart', () => {
                item.classList.add('dragging');
        setTimeout(() => {
                    item.style.opacity = '0.4';
                }, 0);
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                item.style.opacity = '1';
            });
        });
        
        // Set up drop zones
        categoryContainers.forEach(container => {
            // When dragging over a container
            container.addEventListener('dragover', e => {
                e.preventDefault();
                container.classList.add('drag-over');
            });

            // When leaving a container
            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            // When dropping in a container
            container.addEventListener('drop', e => {
                e.preventDefault();
                const item = document.querySelector('.dragging');
                if (!item) return;
                
                // Clear placeholder text if this is the first item
                if (container.textContent.trim() === 'Drop items here') {
                    container.innerHTML = '';
                }
                
                // Add the item to the container
                container.appendChild(item);
                container.classList.remove('drag-over');
            });
        });
        
        // Set up the items pool as a drop zone too
        const itemsPool = document.querySelector('.items-pool');
        if (itemsPool) {
            itemsPool.addEventListener('dragover', e => {
                e.preventDefault();
                itemsPool.classList.add('drag-over');
            });
            
            itemsPool.addEventListener('dragleave', () => {
                itemsPool.classList.remove('drag-over');
            });
            
            itemsPool.addEventListener('drop', e => {
                e.preventDefault();
                const item = document.querySelector('.dragging');
                if (!item) return;
                
                itemsPool.appendChild(item);
                itemsPool.classList.remove('drag-over');
                
                // Reset any styling or classes on the item
                item.classList.remove('correct', 'incorrect');
            });
        }
    }

    // Improve getLectureIdFromUrl to handle different URL patterns
    getLectureIdFromUrl() {
        // First try URL params
        const urlParams = new URLSearchParams(window.location.search);
        const idParam = urlParams.get('id');
        if (idParam) return idParam;
        
        // Then try URL path patterns like /lectures/[id]
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 2 && pathParts[1] === 'lectures') {
            return pathParts[2];
        }
        
        return null;
    }

    // Add the handleFlashcards method
    async handleFlashcards() {
        try {
            // Show loading state
            const loader = document.createElement('div');
            loader.className = 'summary-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p>Generating flashcards...</p>
                <small>This may take a moment</small>
            `;
            document.body.appendChild(loader);

            // Get the transcription and title
            const transcription = document.getElementById('transcriptionText').textContent;
            const lectureTitle = document.getElementById('lectureTitle').textContent;

            // Request flashcards from server
            const response = await fetch('/api/generate-flashcards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    transcription,
                    lectureTitle
                })
            });

            if (!response.ok) throw new Error('Failed to generate flashcards');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate flashcards');
            }

            // Create and show the flashcards section
            this.createFlashcardsSection(data.flashcards);

        } catch (error) {
            console.error('Flashcards generation error:', error);
            alert('Failed to generate flashcards: ' + error.message);
        } finally {
            const loader = document.querySelector('.summary-loader');
            if (loader) loader.remove();
        }
    }

    createFlashcardsSection(flashcards) {
        // Remove existing flashcards section if it exists
        const existingSection = document.querySelector('.flashcards-section');
        if (existingSection) {
            existingSection.remove();
        }

        // Create flashcards section
        const section = document.createElement('section');
        section.className = 'flashcards-section';
        
        section.innerHTML = `
            <h2>Study Flashcards</h2>
            <div class="flashcards-controls">
                <div class="mode-selector">
                    <button class="mode-btn active" data-mode="read">Read Mode</button>
                    <button class="mode-btn" data-mode="practice">Practice Mode</button>
                    <div class="practice-progress">
                        <i class="bi bi-stack"></i>
                        <span class="progress-count"></span>
                    </div>
                </div>
                <div class="mode-instructions">
                    Read Mode: Flip through cards freely | Practice Mode: Test your knowledge
                </div>
                <div class="study-controls">
                    <button class="prev-card" disabled>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <span class="card-counter">1/${flashcards.length}</span>
                    <button class="next-card">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                    <button class="shuffle-cards">
                        <i class="bi bi-shuffle"></i>
                    </button>
                </div>
            </div>
            
            <div class="flashcards-container">
                ${flashcards.map((card, index) => `
                    <div class="flashcard ${index === 0 ? 'active' : ''}" data-category="${card.category}">
                        <div class="flashcard-inner">
                            <div class="flashcard-front">
                                <div class="card-content">${card.front}</div>
                                <div class="flip-hint">
                                    <i class="bi bi-arrow-repeat"></i>
                                    Click to reveal answer
                                </div>
                            </div>
                            <div class="flashcard-back">
                                <div class="card-content">${card.back}</div>
                                <div class="practice-controls" style="display: none;">
                                    <div class="practice-feedback"></div>
                                    <div class="practice-buttons">
                                        <button class="remember-btn">
                                            <i class="bi bi-check-lg"></i>
                                            Got It Right
                                        </button>
                                        <button class="forgot-btn">
                                            <i class="bi bi-arrow-repeat"></i>
                                            Review Later
                                        </button>
                                    </div>
                                </div>
                                <div class="flip-hint read-mode">
                                    <i class="bi bi-arrow-repeat"></i>
                                    Click to flip back
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                <div class="completion-message" style="display: none;">
                    <div class="completion-content">
                        <i class="bi bi-trophy"></i>
                        <h3>Great Job!</h3>
                        <p>You've completed all the flashcards in this session.</p>
                        <div class="completion-buttons">
                            <button class="restart-practice">Practice Again</button>
                            <button class="switch-to-read">Switch to Read Mode</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to content grid
        const contentGrid = document.querySelector('.content-grid');
        contentGrid.appendChild(section);

        // Initialize flashcards functionality
        this.initializeFlashcards();
    }

    initializeFlashcards() {
        const flashcardsContainer = document.querySelector('.flashcards-container');
        const cards = document.querySelectorAll('.flashcard');
        const prevButton = document.querySelector('.prev-card');
        const nextButton = document.querySelector('.next-card');
        const shuffleButton = document.querySelector('.shuffle-cards');
        const studyControls = document.querySelector('.study-controls');
        const modeButtons = document.querySelectorAll('.mode-btn');
        const counter = document.querySelector('.card-counter');
        const completionMessage = document.querySelector('.completion-message');
        
        let currentIndex = 0;
        let visibleCards = [...cards];
        let forgottenCards = [];
        let currentMode = 'read';
        let rememberedCards = new Set();

        // Initialize card flipping
        cards.forEach(card => {
            card.addEventListener('click', () => {
                if (currentMode === 'read' || !card.classList.contains('flipped')) {
                    card.classList.toggle('flipped');
                }
            });

            const rememberBtn = card.querySelector('.remember-btn');
            const forgotBtn = card.querySelector('.forgot-btn');

            if (rememberBtn) {
                rememberBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleRemembered(card);
                });
            }

            if (forgotBtn) {
                forgotBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleForgotten(card);
                });
            }
        });

        // Mode switching
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const newMode = button.dataset.mode;
                if (newMode === currentMode) return;

                modeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentMode = newMode;
                
                resetPracticeSession();
                studyControls.style.display = currentMode === 'read' ? 'flex' : 'none';
            });
        });

        // Navigation (only for read mode)
        prevButton.addEventListener('click', () => {
            if (currentMode === 'read' && currentIndex > 0) {
                currentIndex--;
                updateCardVisibility();
                updateCounter();
            }
        });

        nextButton.addEventListener('click', () => {
            if (currentMode === 'read' && currentIndex < visibleCards.length - 1) {
                currentIndex++;
                updateCardVisibility();
                updateCounter();
            }
        });

        // Shuffle functionality (only for read mode)
        shuffleButton.addEventListener('click', () => {
            if (currentMode === 'read') {
                resetCards();
                visibleCards = [...cards].sort(() => Math.random() - 0.5);
                currentIndex = 0;
                updateCardVisibility();
                updateCounter();

                shuffleButton.classList.add('rotating');
                setTimeout(() => shuffleButton.classList.remove('rotating'), 500);
            }
        });

        function handleRemembered(card) {
            if (currentMode !== 'practice') return;
            
            const feedback = card.querySelector('.practice-feedback');
            rememberedCards.add(card);
            
            feedback.textContent = "Great job!";
            feedback.classList.add('show');

            setTimeout(() => {
                if (rememberedCards.size === cards.length) {
                    // All cards are completed
                    completionMessage.style.display = 'flex';
                    completionMessage.classList.add('show');
                    
                    // Add event listeners for the buttons
                    const restartButton = completionMessage.querySelector('.restart-practice');
                    const switchToReadButton = completionMessage.querySelector('.switch-to-read');
                    
                    if (restartButton) {
                        restartButton.onclick = resetPracticeSession;
                    }
                    if (switchToReadButton) {
                        switchToReadButton.onclick = () => {
                            const readModeBtn = document.querySelector('.mode-btn[data-mode="read"]');
                            if (readModeBtn) readModeBtn.click();
                        };
                    }

                    // Hide the current card
                    cards.forEach(c => c.style.display = 'none');
                } else if (currentIndex < visibleCards.length - 1) {
                    feedback.textContent = "Moving to next card...";
                    setTimeout(() => {
                        currentIndex++;
                        updateCardVisibility();
                        updateCounter();
                    }, 500);
                }
                updateProgressCount();
            }, 500);
        }

        function handleForgotten(card) {
            if (currentMode !== 'practice') return;
            
            const feedback = card.querySelector('.practice-feedback');
            rememberedCards.delete(card);
            forgottenCards.push(card);
            
            feedback.textContent = "No problem! We'll review this one later.";
            feedback.classList.add('show');

            setTimeout(() => {
                if (currentIndex < visibleCards.length - 1) {
                    currentIndex++;
                    updateCardVisibility();
                    updateCounter();
                } else {
                    // If we're at the end, continue with forgotten cards
                    visibleCards = [...forgottenCards];
                    forgottenCards = [];
                    visibleCards.sort(() => Math.random() - 0.5);
                    currentIndex = 0;
                    updateCardVisibility();
                    updateCounter();
                }
            }, 1000);
        }

        function resetCards() {
            cards.forEach(card => {
                card.classList.remove('flipped');
                card.style.display = '';
                const feedback = card.querySelector('.practice-feedback');
                if (feedback) feedback.classList.remove('show');
            });
            forgottenCards = [];
            rememberedCards.clear();
            completionMessage.style.display = 'none';
            completionMessage.classList.remove('show');
        }

        function resetPracticeSession() {
            resetCards();
            visibleCards = [...cards];
            if (currentMode === 'practice') {
                visibleCards.sort(() => Math.random() - 0.5);
            }
            currentIndex = 0;
            
            // Show all cards again and hide completion message
            cards.forEach(card => card.style.display = '');
            completionMessage.style.display = 'none';
            completionMessage.classList.remove('show');
            
            updateCardVisibility();
            updateCounter();
            updatePracticeMode();
        }

        function updatePracticeMode() {
            cards.forEach(card => {
                const practiceControls = card.querySelector('.practice-controls');
                const readModeHint = card.querySelector('.flip-hint.read-mode');
                
                if (currentMode === 'practice') {
                    practiceControls.style.display = 'flex';
                    readModeHint.style.display = 'none';
                    document.querySelector('.practice-progress').classList.add('show');
                } else {
                    practiceControls.style.display = 'none';
                    readModeHint.style.display = 'block';
                    document.querySelector('.practice-progress').classList.remove('show');
                }
            });
            updateProgressCount();
        }

        function updateProgressCount() {
            const progressCount = document.querySelector('.progress-count');
            if (progressCount && currentMode === 'practice') {
                progressCount.textContent = `${rememberedCards.size}/${cards.length} Completed`;
            }
        }

        function updateCardVisibility() {
            cards.forEach(card => {
                card.classList.remove('active', 'flipped');
                const feedback = card.querySelector('.practice-feedback');
                if (feedback) feedback.classList.remove('show');
            });

            if (visibleCards[currentIndex]) {
                visibleCards[currentIndex].classList.add('active');
                updateProgressCount();
            }
        }

        function updateCounter() {
            counter.textContent = `${currentIndex + 1}/${visibleCards.length}`;
            prevButton.disabled = currentIndex === 0;
            nextButton.disabled = currentIndex === visibleCards.length - 1;
        }

        // Add swipe support for mobile
        let touchStartX = 0;
        flashcardsContainer.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        });

        flashcardsContainer.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            const swipeThreshold = 50;

            if (Math.abs(diff) < swipeThreshold) return;

            if (diff > 0 && currentIndex < visibleCards.length - 1) {
                currentIndex++;
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex--;
            }

            updateCardVisibility();
            updateCounter();
        });

        // Initialize practice mode visibility and progress
        updatePracticeMode();
        updateProgressCount();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new StudentLectureNotes();
});

// Add global function for onclick handler
window.toggleNoteSidebar = function() {
    const sidebar = document.getElementById('notesSidebar');
    sidebar.classList.toggle('active');
};

document.addEventListener('DOMContentLoaded', function() {
    const explanationButton = document.querySelector('.explanation-btn');
    const checkAnswersButton = document.querySelector('.check-answers-btn');

    if (explanationButton && checkAnswersButton) {
        explanationButton.disabled = true;

        checkAnswersButton.addEventListener('click', () => {
            const isCorrect = this.checkCategorizationAnswers();
            if (isCorrect) {
                explanationButton.disabled = false;
                explanationButton.addEventListener('click', async () => {
                    const explanations = await this.fetchExplanations();
                    this.displayExplanations(explanations);
                });
            } else {
                explanationButton.disabled = true;
            }
        });
    }
}.bind(this)); 

// End of file (any content after this line should be removed) 