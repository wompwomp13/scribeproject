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

// Add this class to handle the modify notes functionality
class ModifyNotesHandler {
    constructor() {
        this.sidebar = document.getElementById('modifySidebar');
        this.modifyBtn = document.getElementById('modifyNotesBtn');
        this.closeBtn = document.getElementById('closeSidebar');
        this.saveBtn = document.getElementById('savePreferences');
        this.contentGrid = document.querySelector('.content-grid');
        this.transcriptionText = document.getElementById('transcriptionText');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
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

        // Show success message
        alert('Preferences saved successfully!');
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

        // Clean up the summary data
        const cleanSummary = {
            title: this.cleanText(summary.title),
            overview: this.cleanText(summary.overview),
            keyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints.map(point => ({
                heading: this.cleanText(point.heading),
                details: Array.isArray(point.details) ? point.details.map(detail => this.cleanText(detail)) : []
            })) : [],
            importantConcepts: Array.isArray(summary.importantConcepts) ? 
                summary.importantConcepts.map(concept => this.cleanText(concept)) : [],
            conclusion: this.cleanText(summary.conclusion)
        };

        // Create new summary section
        const summarySection = document.createElement('section');
        summarySection.className = 'summary-section';

        // Create the HTML structure
        summarySection.innerHTML = `
            <h2>Lecture Summary</h2>
            <div class="summary-content">
                <h3 class="summary-title">${cleanSummary.title}</h3>
                
                <div class="summary-overview">
                    <p>${cleanSummary.overview}</p>
                </div>

                <div class="key-points">
                    <h4>Key Points</h4>
                    ${cleanSummary.keyPoints.map(point => `
                        <div class="key-point">
                            <h5>${point.heading}</h5>
                            <ul>
                                ${point.details.map(detail => `
                                    <li>${detail}</li>
                                `).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>

                ${cleanSummary.importantConcepts.length > 0 ? `
                    <div class="important-concepts">
                        <h4>Important Concepts</h4>
                        <div class="concepts-grid">
                            ${cleanSummary.importantConcepts.map(concept => `
                                <div class="concept-card">
                                    <i class="bi bi-lightbulb"></i>
                                    <span>${concept}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="summary-conclusion">
                    <h4>Conclusion</h4>
                    <p>${cleanSummary.conclusion}</p>
                </div>
            </div>
        `;

        // Add to content grid
        this.contentGrid.appendChild(summarySection);
    }

    // Add this helper method to clean up text
    cleanText(text) {
        if (!text) return '';
        
        // Remove JSON-like formatting and quotes
        return text
            .replace(/^["']|["']$/g, '') // Remove surrounding quotes
            .replace(/\\n/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[{}"]/g, '') // Remove curly braces and quotes
            .replace(/^\s*[a-z]+:\s*/i, '') // Remove property names (e.g., "title:", "overview:")
            .trim(); // Remove leading/trailing whitespace
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
}

// Initialize both handlers when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ModifyNotesHandler();
    new LectureNotes();
}); 