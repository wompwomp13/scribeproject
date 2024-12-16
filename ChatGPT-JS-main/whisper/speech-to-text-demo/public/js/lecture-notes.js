class LectureNotes {
    constructor() {
        this.lectureId = new URLSearchParams(window.location.search).get('id');
        if (!this.lectureId) {
            window.location.href = '/course1.html';
            return;
        }
        
        this.setupEventListeners();
        this.loadLectureData();
    }

    setupEventListeners() {
        document.getElementById('saveNotes').addEventListener('click', () => this.saveNotes());
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
            
            this.updateUI(data.recording);
            this.loadNotes();
            
        } catch (error) {
            console.error('Error loading lecture:', error);
            alert('Failed to load lecture data: ' + error.message);
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
                alert('Notes saved successfully!');
            } else {
                throw new Error(data.error || 'Failed to save notes');
            }
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Failed to save notes: ' + error.message);
        }
    }
}

// Add the ModifyNotesHandler class
class ModifyNotesHandler {
    constructor() {
        // Check if we're on the student lecture notes page
        if (!document.querySelector('.modify-sidebar')) {
            return;
        }

        this.sidebar = document.getElementById('modifySidebar');
        this.modifyBtn = document.getElementById('modifyNotesBtn');
        this.closeBtn = document.getElementById('closeSidebar');
        this.saveBtn = document.getElementById('savePreferences');
        this.contentGrid = document.querySelector('.content-grid');
        this.transcriptionText = document.getElementById('transcriptionText');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modifyBtn || !this.closeBtn || !this.saveBtn) {
            console.error('Required elements not found');
            return;
        }

        // Toggle sidebar
        this.modifyBtn.addEventListener('click', () => this.toggleSidebar());
        this.closeBtn.addEventListener('click', () => this.closeSidebar());
        
        // Handle click outside
        document.addEventListener('click', (e) => {
            if (!this.sidebar.contains(e.target) && 
                !this.modifyBtn.contains(e.target) && 
                this.sidebar.classList.contains('active')) {
                this.closeSidebar();
            }
        });

        // Save preferences
        this.saveBtn.addEventListener('click', () => this.handleSavePreferences());
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('active');
    }

    closeSidebar() {
        this.sidebar.classList.remove('active');
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
            const transcription = this.transcriptionText.textContent;

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

            // Create and add the summary section
            this.createSummarySection(data.summary);

        } catch (error) {
            console.error('Summarization error:', error);
            alert('Failed to generate summary: ' + error.message);
        } finally {
            this.hideLoadingState();
        }
    }

    createSummarySection(summary) {
        // Remove existing summary section if it exists
        const existingSummary = document.querySelector('.summary-section');
        if (existingSummary) {
            existingSummary.remove();
        }

        // Create new summary section
        const summarySection = document.createElement('section');
        summarySection.className = 'summary-section';
        summarySection.setAttribute('data-definitions-enabled', 'true');

        // Create the HTML structure with enhanced organization
        summarySection.innerHTML = `
            <h2>Lecture Summary</h2>
            <div class="summary-content">
                <h3 class="summary-title">${summary.title || 'Summary'}</h3>
                
                <!-- Context and Significance -->
                <div class="summary-overview">
                    <h4>Context & Purpose</h4>
                    <div class="overview-box">
                        <p class="definable"><strong>Main Theme:</strong> ${summary.overview?.mainThesis || ''}</p>
                        <p class="definable"><strong>Scientific Context:</strong> ${summary.overview?.context || ''}</p>
                        <p class="definable"><strong>Real-World Significance:</strong> ${summary.overview?.significance || ''}</p>
                    </div>
                </div>

                <!-- Key Concepts Section -->
                <div class="key-concepts">
                    <h4>Key Scientific Concepts</h4>
                    ${summary.conceptualFramework?.keyTerms?.length ? `
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
                    ` : ''}
                </div>

                <!-- Main Discussion Points -->
                <div class="key-points">
                    <h4>Main Discussion Points</h4>
                    ${summary.keyTopics?.map(topic => `
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
                    `).join('') || ''}
                </div>

                <!-- Practical Applications -->
                ${summary.practicalApplications?.length ? `
                    <div class="practical-applications">
                        <h4>Practical Applications & Real-World Examples</h4>
                        ${summary.practicalApplications.map(app => `
                            <div class="application-card">
                                <div class="application-header">
                                    <i class="bi bi-gear"></i>
                                    <h5>${app.scenario || ''}</h5>
                                </div>
                                <p class="definable">${app.explanation || ''}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Challenges and Limitations -->
                ${summary.connections?.interdisciplinary?.length ? `
                    <div class="challenges-section">
                        <h4>Challenges & Future Directions</h4>
                        <div class="connections-grid">
                            <div class="connection-box">
                                <h5><i class="bi bi-exclamation-triangle"></i> Current Challenges</h5>
                                <ul>
                                    ${summary.connections.interdisciplinary.map(challenge => 
                                        `<li class="definable">${challenge}</li>`
                                    ).join('')}
                                </ul>
                            </div>
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
                    </div>
                ` : ''}

                <!-- Study Guide -->
                ${summary.studyGuide ? `
                    <div class="study-guide">
                        <h4>Key Takeaways & Study Guide</h4>
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
                    </div>
                ` : ''}
            </div>
        `;

        // Add to content grid
        this.contentGrid.appendChild(summarySection);

        // Initialize definitions handler for the summary section
        new DefinitionsHandler().initializeSection(summarySection);
    }

    cleanText(text) {
        if (!text) return '';
        
        // Remove JSON-like formatting and quotes
        return text
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/\\n/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[{}"]/g, '') // Remove curly braces and quotes
            .replace(/^\s*[a-z]+:\s*/i, '') // Remove property names
            .trim();
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

// Initialize based on the page we're on
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the student lecture notes page
    if (document.querySelector('.modify-sidebar')) {
        new ModifyNotesHandler();
        new LectureNotes();
    }
    // If we're on the teacher page, don't initialize these handlers
}); 