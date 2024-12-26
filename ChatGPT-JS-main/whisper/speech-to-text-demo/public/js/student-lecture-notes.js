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
        console.log('Audio file details:', lecture.audioFile);
        console.log('Transcription details:', lecture.transcription);
        
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
                
                // Add event listeners to check if audio loads
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
        
        // Update transcription with error handling
        const transcriptionElement = document.getElementById('transcriptionText');
        if (lecture.transcription && lecture.transcription.text) {
            console.log('Setting transcription:', lecture.transcription.text);
            transcriptionElement.textContent = lecture.transcription.text;
            
            // Initialize definitions handler for transcription
            const handler = new DefinitionsHandler();
            handler.initializeSection(transcriptionElement.parentElement);
        } else {
            console.error('No transcription found in lecture data');
            transcriptionElement.textContent = 'No transcription available';
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
            auditory: document.getElementById('auditory').checked
        };

        // Save preferences to localStorage
        localStorage.setItem('notePreferences', JSON.stringify(preferences));

        // Handle summarization if selected
        if (preferences.summarization) {
            await this.handleSummarization();
        }

        // Show toast notification
        this.showToastNotification('Preferences saved successfully');
        this.closeSidebar();
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

        // Update key concepts
        if (summary.conceptualFramework?.keyTerms) {
            document.getElementById('conceptTerms').innerHTML = `
                <div class="concepts-grid">
                    ${summary.conceptualFramework.keyTerms.map(term => `
                        <div class="concept-card definable">
                            <div class="concept-header">
                                <i class="bi bi-lightbulb"></i>
                                <h5>${term.term || ''}</h5>
                            </div>
                            <p>${term.definition || ''}</p>
                            ${term.context ? `
                                <div class="concept-context">
                                    <small><strong>Context:</strong> ${term.context}</small>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

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

        // Update challenges and future directions
        if (summary.connections) {
            document.getElementById('challenges').innerHTML = `
                <div class="connections-grid">
                    ${summary.connections.interdisciplinary?.length ? `
                        <div class="connection-box">
                            <h5><i class="bi bi-exclamation-triangle"></i> Current Challenges</h5>
                            <ul>
                                ${summary.connections.interdisciplinary.map(challenge => 
                                    `<li class="definable">${challenge}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${summary.connections.futureTopics?.length ? `
                        <div class="connection-box">
                            <h5><i class="bi bi-arrow-up-right-circle"></i> Future Outlook</h5>
                            <ul>
                                ${summary.connections.futureTopics.map(topic => 
                                    `<li class="definable">${topic}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
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

    loadSavedPreferences() {
        try {
            const savedPreferences = localStorage.getItem('notePreferences');
            if (savedPreferences) {
                const preferences = JSON.parse(savedPreferences);
                document.getElementById('summarization').checked = preferences.summarization ?? true;
                document.getElementById('flashcards').checked = preferences.flashcards ?? false;
                document.getElementById('auditory').checked = preferences.auditory ?? false;
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