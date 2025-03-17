class StudentLectureNotes {
    constructor() {
        this.lectureId = new URLSearchParams(window.location.search).get('id');
        this.courseId = new URLSearchParams(window.location.search).get('courseId');
        
        if (!this.lectureId) {
            window.location.href = '/studentdashboard.html';
            return;
        }
        
        this.setupEventListeners();
        this.loadLectureData();
        this.setupNotesModification();
    }

    setupEventListeners() {
        document.getElementById('saveNotes').addEventListener('click', () => this.saveNotes());
        
        // Set up back to course button
        const backButton = document.querySelector('.back-to-course');
        backButton.href = `/scourse.html?id=${this.courseId}`;
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
        
        // Update audio player with error handling
        const audio = document.getElementById('lectureAudio');
        if (lecture.audioFile && lecture.audioFile.filename) {
            try {
                const audioUrl = `/uploads/${lecture.audioFile.filename}`;
                console.log('Setting audio URL:', audioUrl);
                audio.src = audioUrl;
                
                audio.onerror = (e) => {
                    console.error('Error loading audio:', e);
                };
                audio.onloadeddata = () => {
                    console.log('Audio loaded successfully');
                };
            } catch (error) {
                console.error('Error setting audio source:', error);
            }
        } else {
            console.error('No audio file found in lecture data');
        }
        
        // Update transcription
        const transcriptionElement = document.getElementById('transcriptionText');
        if (lecture.transcription && lecture.transcription.text) {
            transcriptionElement.textContent = lecture.transcription.text;
            
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

    async loadNotes() {
        try {
            const response = await fetch(`/api/recordings/${this.lectureId}/notes`);
            if (!response.ok) {
                throw new Error('Failed to fetch notes');
            }
            
            const data = await response.json();
            console.log('Loaded notes:', data);
            
            if (data.success && data.notes) {
                document.getElementById('notesEditor').value = data.notes.content;
            }
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    async saveNotes() {
        try {
            const content = document.getElementById('notesEditor').value;
            
            const response = await fetch(`/api/recordings/${this.lectureId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new Error('Failed to save notes');
            }
            
            const data = await response.json();
            if (data.success) {
                this.showToastNotification('Notes saved successfully!');
            } else {
                throw new Error(data.error || 'Failed to save notes');
            }
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Failed to save notes: ' + error.message);
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
            this.showLoadingState();

            // Get the transcription text
            const transcription = document.getElementById('transcriptionText').textContent;

            // Send request to summarize
            const response = await fetch('/api/summarize-lecture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transcription })
            });

            if (!response.ok) {
                throw new Error('Failed to get summary');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate summary');
            }

            // Update the summary section
            this.updateSummaryContent(data.summary);
            document.querySelector('.summary-section').style.display = 'block';

        } catch (error) {
            console.error('Summarization error:', error);
            alert('Failed to generate summary: ' + error.message);
        } finally {
            this.hideLoadingState();
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

        // Update study guide
        if (summary.studyGuide) {
            document.getElementById('studyGuide').innerHTML = `
                <div class="study-sections">
                    <div class="key-highlights">
                        <h5><i class="bi bi-star"></i> Essential Points</h5>
                        <ul>
                            ${summary.studyGuide.keyHighlights?.map(highlight => 
                                `<li class="definable">${highlight}</li>`
                            ).join('') || ''}
                        </ul>
                    </div>
                    ${summary.studyGuide.commonMisconceptions?.length ? `
                        <div class="misconceptions">
                            <h5><i class="bi bi-exclamation-circle"></i> Common Misconceptions</h5>
                            <ul>
                                ${summary.studyGuide.commonMisconceptions.map(misconception => 
                                    `<li class="definable">${misconception}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Initialize definitions handler for the new summary content
        const handler = new DefinitionsHandler();
        handler.initializeSection(document.querySelector('.summary-section'));
    }

    async handleVisualLearning() {
        try {
            // Show loading state
            const loader = document.createElement('div');
            loader.className = 'summary-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p>Preparing visual learning content...</p>
                <small>This may take a moment as we gather and process visual elements</small>
            `;
            document.body.appendChild(loader);

            // Get the data from the server
            const response = await fetch('/api/extract-key-terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    transcription: document.getElementById('transcriptionText').textContent,
                    lectureTitle: document.getElementById('lectureTitle').textContent,
                    courseName: document.getElementById('courseBreadcrumb').textContent
                })
            });

            if (!response.ok) throw new Error('Failed to extract key terms');
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to extract key terms');

            // Ensure we have exactly 3 valid terms
            const validKeyTerms = data.keyTerms
                .filter(term => typeof term === 'string')
                .slice(0, 3);

            if (validKeyTerms.length !== 3) {
                throw new Error('Failed to generate required number of key terms');
            }

            // Pre-fetch images with improved search
            const imageCache = new Map();
            
            // Simplified collections focused on educational content
            const educationalCollections = '317099,4332580';

            await Promise.all(validKeyTerms.map(async (term) => {
                // Simplify the search query
                const searchQuery = encodeURIComponent(`${term} education diagram`);
                
                const params = new URLSearchParams({
                    query: searchQuery,
                    per_page: '20',
                    order_by: 'relevant',
                    content_filter: 'high',
                    orientation: 'landscape',
                    collections: educationalCollections
                });

                try {
                    const response = await fetch(
                        `https://api.unsplash.com/search/photos?${params.toString()}&client_id=KpzwsxtICNRSkYOMRoDs2dweYyqycu0mU875j_QMKcA`
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    if (data.results && data.results.length > 0) {
                        // Find the most relevant image
                        const bestMatch = data.results.find(img => {
                            const description = (img.description || '').toLowerCase();
                            const altDescription = (img.alt_description || '').toLowerCase();
                            const termLower = term.toLowerCase();
                            
                            return description.includes(termLower) || 
                                   altDescription.includes(termLower) ||
                                   description.includes('education') ||
                                   description.includes('diagram');
                        }) || data.results[0];

                        imageCache.set(term, bestMatch.urls.regular);
                    } else {
                        // Fallback to a more generic search if no results found
                        const fallbackParams = new URLSearchParams({
                            query: encodeURIComponent(term),
                            per_page: '1',
                            order_by: 'relevant',
                            content_filter: 'high',
                            orientation: 'landscape'
                        });

                        const fallbackResponse = await fetch(
                            `https://api.unsplash.com/search/photos?${fallbackParams.toString()}&client_id=KpzwsxtICNRSkYOMRoDs2dweYyqycu0mU875j_QMKcA`
                        );

                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.results && fallbackData.results.length > 0) {
                                imageCache.set(term, fallbackData.results[0].urls.regular);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching image for "${term}":`, error);
                    // Try fallback without collections
                    try {
                        const fallbackParams = new URLSearchParams({
                            query: encodeURIComponent(term),
                            per_page: '1',
                            order_by: 'relevant',
                            content_filter: 'high'
                        });

                        const fallbackResponse = await fetch(
                            `https://api.unsplash.com/search/photos?${fallbackParams.toString()}&client_id=KpzwsxtICNRSkYOMRoDs2dweYyqycu0mU875j_QMKcA`
                        );

                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.results && fallbackData.results.length > 0) {
                                imageCache.set(term, fallbackData.results[0].urls.regular);
                            }
                        }
                    } catch (fallbackError) {
                        console.error(`Fallback fetch failed for "${term}":`, fallbackError);
                    }
                }
            }));

            // Proceed if we have at least one image
            if (imageCache.size > 0) {
                // Update the UI with whatever images we got
                await this.updateKeyTermsSection(validKeyTerms, imageCache);
                await this.processVisualTranscript(data.cleanedTranscript, validKeyTerms, imageCache);
                this.showToastNotification('Visual learning content ready');
            } else {
                throw new Error('Unable to fetch any images for the key terms');
            }

        } catch (error) {
            console.error('Visual learning error:', error);
            alert('Failed to process visual learning: ' + error.message);
        } finally {
            const loader = document.querySelector('.summary-loader');
            if (loader) loader.remove();
        }
    }

    async updateKeyTermsSection(keyTerms, imageCache) {
        const contentGrid = document.querySelector('.content-grid');
        
        // Remove existing visual learning section if it exists
        const existingSection = document.querySelector('.visual-learning-section');
        if (existingSection) {
            existingSection.remove();
        }

        // Create new visual learning section with enhanced visual focus
        const visualSection = document.createElement('section');
        visualSection.className = 'visual-learning-section';
        
        visualSection.innerHTML = `
            <h2>Visual Learning</h2>
            <div class="visual-transcript-section">
                <div class="visual-transcript-content">
                    <div class="transcript-text"></div>
                </div>
            </div>
        `;

        contentGrid.appendChild(visualSection);
    }

    async processVisualTranscript(cleanedTranscript, keyTerms, imageCache) {
        const textContainer = document.querySelector('.visual-transcript-content');
        if (!textContainer) return;

        try {
            const shownTerms = new Set();
            const paragraphs = cleanedTranscript.split('\n\n');
            
            // Create navigation elements
            const progressIndicator = document.createElement('div');
            progressIndicator.className = 'progress-indicator';
            progressIndicator.innerHTML = paragraphs.map((_, i) => 
                `<div class="progress-dot ${i === 0 ? 'active' : ''}"></div>`
            ).join('');

            const navControls = document.createElement('div');
            navControls.className = 'visual-nav-controls';
            navControls.innerHTML = `
                <button class="nav-button prev-btn" disabled>
                    <i class="bi bi-chevron-left"></i> Previous
                </button>
                <span class="progress-text">1/${paragraphs.length}</span>
                <button class="nav-button next-btn">
                    Next <i class="bi bi-chevron-right"></i>
                </button>
            `;

            // Create swipeable container
            const blocksWrapper = document.createElement('div');
            blocksWrapper.className = 'visual-blocks-wrapper';
            
            // Process content
            const processedContent = paragraphs.map((paragraph, index) => {
                for (const term of keyTerms) {
                    if (!shownTerms.has(term) && imageCache.has(term)) {
                        const termRegex = new RegExp(`(${term})`, 'i');
                        if (termRegex.test(paragraph)) {
                            shownTerms.add(term);
                            
                            const parts = paragraph.split(termRegex);
                            return `
                                <div class="visual-block ${index === 0 ? 'active' : ''}">
                                    <div class="visual-content-wrapper">
                                        <div class="text-content">
                                            ${parts[0]}
                                            <span class="highlighted-term">${term}</span>
                                            ${parts.slice(2).join('')}
                                        </div>
                                        <div class="image-content">
                                            <div class="image-wrapper">
                                                <img src="${imageCache.get(term)}" alt="${term}" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    }
                }
                
                return `
                    <div class="visual-block ${index === 0 ? 'active' : ''}">
                        <div class="visual-content-wrapper">
                            <div class="text-content">
                                ${paragraph}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            blocksWrapper.innerHTML = processedContent;

            // Add swipe hint
            const swipeHint = document.createElement('div');
            swipeHint.className = 'swipe-hint show';
            swipeHint.innerHTML = `
                <i class="bi bi-arrow-left-right"></i>
                Swipe to navigate
            `;

            // Add progress bar
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = '<div class="progress-fill"></div>';

            // Combine all elements
            textContainer.innerHTML = '';
            textContainer.appendChild(progressBar);
            textContainer.appendChild(progressIndicator);
            textContainer.appendChild(blocksWrapper);
            textContainer.appendChild(navControls);
            textContainer.appendChild(swipeHint);

            // Initialize navigation
            let currentSlide = 0;
            const slides = blocksWrapper.querySelectorAll('.visual-block');
            const dots = progressIndicator.querySelectorAll('.progress-dot');
            const prevBtn = navControls.querySelector('.prev-btn');
            const nextBtn = navControls.querySelector('.next-btn');
            const progressText = navControls.querySelector('.progress-text');

            // Update the progress bar
            const updateProgressBar = (index, total) => {
                const progressFill = document.querySelector('.progress-fill');
                const progress = ((index + 1) / total) * 100;
                progressFill.style.width = `${progress}%`;
            };

            // Add click handlers to progress dots
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => {
                    goToSlide(index);
                });
            });

            // Update the navigation event listeners
            const setupNavigation = () => {
                prevBtn.addEventListener('click', () => {
                    if (currentSlide > 0) {
                        goToSlide(currentSlide - 1);
                    }
                });

                nextBtn.addEventListener('click', () => {
                    if (currentSlide < slides.length - 1) {
                        goToSlide(currentSlide + 1);
                    }
                });
            };

            // Update the goToSlide function
            const goToSlide = (index) => {
                currentSlide = index;
                blocksWrapper.style.transform = `translateX(-${index * 100}%)`;
                
                // Update active states
                slides.forEach((slide, i) => {
                    slide.classList.toggle('active', i === index);
                    dots[i].classList.toggle('active', i === index);
                });

                // Update progress bar
                const progressFill = document.querySelector('.progress-fill');
                if (progressFill) {
                    const progress = ((index + 1) / slides.length) * 100;
                    progressFill.style.width = `${progress}%`;
                }

                // Update buttons
                prevBtn.disabled = index === 0;
                nextBtn.disabled = index === slides.length - 1;
            };

            // Call setupNavigation after initializing the elements
            setupNavigation();

            // Hide swipe hint after 3 seconds
            setTimeout(() => {
                swipeHint.classList.remove('show');
            }, 3000);

        } catch (error) {
            console.error('Error processing visual transcript:', error);
            textContainer.innerHTML = '<div class="error-message">Failed to process visual content.</div>';
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

    showLoadingState() {
        const loader = document.createElement('div');
        loader.className = 'summary-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <p>Generating summary...</p>
        `;
        document.body.appendChild(loader);
    }

    hideLoadingState() {
        const loader = document.querySelector('.summary-loader');
        if (loader) {
            loader.remove();
        }
    }

    showToastNotification(message) {
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <i class="bi bi-check-circle-fill"></i>
            <span class="message">${message}</span>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    async handleKinestheticLearning() {
        try {
            // Show loading state
            const loader = document.createElement('div');
            loader.className = 'summary-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p>Preparing interactive quiz...</p>
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
            await this.createQuizSection(data.quizType, data.quiz);

        } catch (error) {
            console.error('Kinesthetic learning error:', error);
            alert('Failed to generate interactive quiz: ' + error.message);
        } finally {
            const loader = document.querySelector('.summary-loader');
            if (loader) loader.remove();
        }
    }

    async createQuizSection(quizType, quizContent) {
        // Remove existing quiz section if it exists
        const existingQuiz = document.querySelector('.kinesthetic-section');
        if (existingQuiz) {
            existingQuiz.remove();
        }

        // Create quiz section
        const quizSection = document.createElement('section');
        quizSection.className = 'kinesthetic-section';
        
        // Create quiz content based on type
        let quizHTML = '';
        switch (quizType) {
            case 'matching':
                quizHTML = this.createMatchingQuiz(quizContent);
                break;
            case 'sorting':
                quizHTML = this.createSortingQuiz(quizContent);
                break;
            case 'categorization':
                quizHTML = this.createCategorizationQuiz(quizContent);
                break;
        }

        quizSection.innerHTML = quizHTML;
        
        // Add to content grid
        const contentGrid = document.querySelector('.content-grid');
        contentGrid.appendChild(quizSection);

        // Initialize drag and drop
        this.initializeDragAndDrop(quizType);

        // Store quiz content for explanations
        this.quizContent = quizContent;

        // Ensure explanation buttons are always enabled
        this.ensureExplanationButtonsEnabled();
    }

    createMatchingQuiz(quizContent) {
        // Shuffle the definitions for the drag-drop challenge
        const shuffledDefinitions = [...quizContent.pairs]
            .map(pair => ({ id: Math.random(), ...pair }))
            .sort(() => Math.random() - 0.5);

        return `
            <h2>Interactive Matching Quiz</h2>
            <p class="quiz-instructions">Drag the definitions to match their corresponding terms.</p>
            
            <div class="matching-quiz">
                <div class="terms-column">
                    ${quizContent.pairs.map((pair, index) => `
                        <div class="term-container">
                            <div class="term">${pair.term}</div>
                            <div class="definition-slot" data-term="${pair.term}" data-index="${index}">
                                Drop definition here
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="definitions-pool">
                    ${shuffledDefinitions.map(pair => `
                        <div class="definition" draggable="true" data-definition="${pair.definition}">
                            ${pair.definition}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="quiz-controls">
                <button class="check-answers-btn">Check Answers</button>
                <button class="reset-quiz-btn">Reset Quiz</button>
            </div>
        `;
    }

    createSortingQuiz(quizContent) {
        // Shuffle the events for the drag-drop challenge
        const shuffledEvents = [...quizContent.events]
            .sort(() => Math.random() - 0.5);

        return `
            <h2>Interactive Chronological Sorting Quiz</h2>
            <p class="quiz-instructions">Drag and arrange the events in chronological order.</p>
            
            <div class="sorting-quiz">
                <div class="events-container">
                    ${shuffledEvents.map(event => `
                        <div class="event" draggable="true" data-order="${event.order}">
                            ${event.text}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="quiz-controls">
                <button class="check-answers-btn">Check Order</button>
                <button class="reset-quiz-btn">Reset Quiz</button>
            </div>
        `;
    }

    createCategorizationQuiz(quizContent) {
        // Shuffle the items for the drag-drop challenge
        const shuffledItems = [...quizContent.items]
            .sort(() => Math.random() - 0.5);

        return `
            <h2>Interactive Categorization Quiz</h2>
            <p class="quiz-instructions">Drag each item to its correct category.</p>
            
            <div class="categorization-quiz">
                <div class="categories-container">
                    ${quizContent.categories.map(category => `
                        <div class="category-column">
                            <div class="category-header">
                                <h3 class="category-title">${category}</h3>
                                <button class="explanation-btn-small" data-category="${category}" onclick="studentLectureNotes.toggleCategoryExplanation('${category}')">
                                    <i class="bi bi-lightbulb"></i>
                                </button>
                            </div>
                            <div class="category-items" data-category="${category}">
                                Drop items here
                            </div>
                            <div class="category-explanation-tooltip" data-category="${category}"></div>
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
                <button class="check-answers-btn">Check Categories</button>
                <button class="reset-quiz-btn">Reset Quiz</button>
            </div>
        `;
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

    initializeDragAndDrop(quizType) {
        const draggables = document.querySelectorAll('[draggable="true"]');
        let draggedElement = null;

        // Common drag event listeners
        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                draggedElement = e.target;
                e.target.classList.add('dragging');
            });

            draggable.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                draggedElement = null;
            });
        });

        switch (quizType) {
            case 'matching':
                this.initializeMatchingDragDrop();
                break;
            case 'sorting':
                this.initializeSortingDragDrop();
                break;
            case 'categorization':
                this.initializeCategorizationDragDrop();
                break;
        }

        // Initialize quiz controls
        this.initializeQuizControls(quizType);
    }

    initializeMatchingDragDrop() {
        const slots = document.querySelectorAll('.definition-slot');
        
        slots.forEach(slot => {
            slot.addEventListener('dragover', e => {
                e.preventDefault();
                slot.classList.add('drag-over');
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });

            slot.addEventListener('drop', e => {
                e.preventDefault();
                const definition = document.querySelector('.dragging');
                if (!definition) return;

                // Remove from previous slot if exists
                const previousSlot = document.querySelector(`.definition-slot .definition`);
                if (previousSlot && previousSlot.parentElement) {
                    previousSlot.parentElement.innerHTML = 'Drop definition here';
                }

                slot.innerHTML = '';
                slot.appendChild(definition);
                slot.classList.remove('drag-over');
            });
        });
    }

    initializeSortingDragDrop() {
        const container = document.querySelector('.events-container');
        
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (afterElement) {
                container.insertBefore(draggable, afterElement);
            } else {
                container.appendChild(draggable);
            }
        });
    }

    initializeCategorizationDragDrop() {
        const categoryContainers = document.querySelectorAll('.category-items');
        
        categoryContainers.forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                container.classList.add('drag-over');
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', e => {
                e.preventDefault();
                const item = document.querySelector('.dragging');
                if (!item) return;
                
                if (container.innerHTML === 'Drop items here') {
                    container.innerHTML = '';
                }
                container.appendChild(item);
                container.classList.remove('drag-over');
            });
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.event:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    initializeQuizControls(quizType) {
        const checkButton = document.querySelector('.check-answers-btn');
        const resetButton = document.querySelector('.reset-quiz-btn');
        const explanationButton = document.querySelector('.explanation-btn');

        if (checkButton) {
            checkButton.addEventListener('click', () => this.checkAnswers(quizType));
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetQuiz(quizType));
        }

    }

    checkAnswers(quizType) {
        let isCorrect = false;
        let feedback = '';

        switch (quizType) {
            case 'matching':
                isCorrect = this.checkMatchingAnswers();
                feedback = isCorrect ? 'All matches are correct!' : 'Some matches are incorrect. Try again!';
                break;
            case 'sorting':
                isCorrect = this.checkSortingAnswers();
                feedback = isCorrect ? 'Perfect order!' : 'The order is not correct. Try again!';
                break;
            case 'categorization':
                isCorrect = this.checkCategorizationAnswers();
                feedback = isCorrect ? 'All items are correctly categorized!' : 'Some items are in the wrong category. Try again!';
                
                // Check each category separately
                const categoryContainers = document.querySelectorAll('.category-items');
                categoryContainers.forEach(container => {
                    const category = container.dataset.category;
                    const items = container.querySelectorAll('.item');
                    let categoryCorrect = true;
                    
                    items.forEach(item => {
                        if (item.dataset.category !== category) {
                            categoryCorrect = false;
                        }
                    });

                    // Find and update the explanation button for this category
                    const explanationButton = document.querySelector(`.explanation-btn-small[data-category="${category}"]`);
                    if (explanationButton) {
                        explanationButton.title = 'Click to see why these items belong here';
                    }
                });
                break;
        }

        // Show feedback
        this.showQuizFeedback(feedback, isCorrect);
    }

    checkMatchingAnswers() {
        const slots = document.querySelectorAll('.definition-slot');
        let allCorrect = true;

        slots.forEach(slot => {
            const term = slot.dataset.term;
            const definition = slot.querySelector('.definition');
            
            if (!definition) {
                allCorrect = false;
                return;
            }

            const isCorrect = definition.dataset.definition === term;
            slot.classList.remove('correct', 'incorrect');
            slot.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            if (!isCorrect) allCorrect = false;
        });

        return allCorrect;
    }

    checkSortingAnswers() {
        const events = document.querySelectorAll('.event');
        let allCorrect = true;
        let previousOrder = 0;

        events.forEach((event, index) => {
            const currentOrder = parseInt(event.dataset.order);
            event.classList.remove('correct', 'incorrect');
            
            if (currentOrder <= previousOrder) {
                allCorrect = false;
                event.classList.add('incorrect');
            } else {
                event.classList.add('correct');
            }
            
            previousOrder = currentOrder;
        });

        return allCorrect;
    }

    showQuizFeedback(message, isCorrect) {
        // Remove existing feedback
        const existingFeedback = document.querySelector('.quiz-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }

        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        feedback.innerHTML = `
            <i class="bi ${isCorrect ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
            <span>${message}</span>
        `;

        // Add to quiz section
        const quizControls = document.querySelector('.quiz-controls');
        quizControls.insertAdjacentElement('beforebegin', feedback);

        // Remove feedback after 3 seconds
        setTimeout(() => {
            feedback.classList.add('fade-out');
            setTimeout(() => feedback.remove(), 300);
        }, 3000);
    }

    resetQuiz(quizType) {
        switch (quizType) {
            case 'matching':
                this.resetMatchingQuiz();
                break;
            case 'sorting':
                this.resetSortingQuiz();
                break;
            case 'categorization':
                this.resetCategorizationQuiz();
                break;
        }

        // Remove any feedback
        const feedback = document.querySelector('.quiz-feedback');
        if (feedback) feedback.remove();

        // Remove correct/incorrect classes
        document.querySelectorAll('.correct, .incorrect').forEach(el => {
            el.classList.remove('correct', 'incorrect');
        });
    }

    resetMatchingQuiz() {
        const slots = document.querySelectorAll('.definition-slot');
        const pool = document.querySelector('.definitions-pool');
        
        // Move all definitions back to pool
        slots.forEach(slot => {
            const definition = slot.querySelector('.definition');
            if (definition) {
                pool.appendChild(definition);
                slot.innerHTML = 'Drop definition here';
            }
        });
    }

    resetSortingQuiz() {
        const container = document.querySelector('.events-container');
        const events = [...container.querySelectorAll('.event')];
        
        // Shuffle events
        events.sort(() => Math.random() - 0.5).forEach(event => {
            container.appendChild(event);
        });
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

        // Ensure explanation buttons are always enabled
        this.ensureExplanationButtonsEnabled();
    }

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

    toggleCategoryExplanation(category) {
        const tooltip = document.querySelector(`.category-explanation-tooltip[data-category="${category}"]`);
        const allTooltips = document.querySelectorAll('.category-explanation-tooltip');
        
        // Close other open tooltips
        allTooltips.forEach(t => {
            if (t !== tooltip && t.classList.contains('active')) {
                t.classList.remove('active');
            }
        });

        // Toggle current tooltip
        if (!tooltip.classList.contains('active')) {
            // Generate explanation content
            const categoryItems = this.quizContent.items.filter(item => item.category === category);
            tooltip.innerHTML = `
                <div class="tooltip-content">
                    <h4>Why these items belong to "${category}":</h4>
                    <div class="explanation-items">
                        ${categoryItems.map(item => `
                            <div class="explanation-item">
                                <p class="item-text"><strong>${item.text}</strong></p>
                                <p class="item-reason">${item.explanation || `This item demonstrates key characteristics of the ${category} category.`}</p>
                            </div>
                        `).join('')}
                    </div>
                    <button class="close-tooltip-btn">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;

            // Add close button handler
            tooltip.querySelector('.close-tooltip-btn').onclick = () => {
                tooltip.classList.remove('active');
            };

            tooltip.classList.add('active');
        } else {
            tooltip.classList.remove('active');
        }
    }

    // Ensure explanation buttons are always enabled
    ensureExplanationButtonsEnabled() {
        document.querySelectorAll('.explanation-btn-small').forEach(button => {
            button.disabled = false;
            const category = button.dataset.category;
            button.onclick = () => this.toggleCategoryExplanation(category);
            button.title = 'Click this button for an explanation of the items in this category.';
        });
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