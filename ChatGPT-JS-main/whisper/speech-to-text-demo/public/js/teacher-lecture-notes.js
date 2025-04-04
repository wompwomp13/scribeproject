class TeacherLectureNotes {
    constructor() {
        this.lectureId = new URLSearchParams(window.location.search).get('id');
        if (!this.lectureId) {
            window.location.href = '/tclass1.html';
            return;
        }
        
        this.setupEventListeners();
        this.loadLectureData();
        this.setupToolbar();
        
        // Hide save status initially
        const status = document.querySelector('.save-status');
        if (status) status.style.display = 'none';
    }

    setupEventListeners() {
        document.getElementById('saveTranscription').addEventListener('click', () => this.saveTranscription());
    }

    async loadLectureData() {
        try {
            const response = await fetch(`/api/recordings/${this.lectureId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load lecture data');
            }
            
            this.updateUI(data.recording);
            
        } catch (error) {
            console.error('Error loading lecture:', error);
            alert('Failed to load lecture data: ' + error.message);
        }
    }

    updateUI(lecture) {
        document.getElementById('lectureTitle').textContent = lecture.title;
        document.getElementById('lectureBreadcrumb').textContent = lecture.title;
        
        const date = new Date(lecture.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('lectureDate').textContent = date;
        
        // Debug logging
        console.log('Audio file data:', JSON.stringify(lecture.audioFile, null, 2));
        
        const audioPlayer = document.getElementById('lectureAudio');
        
        if (lecture.audioFile) {
            try {
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
                audioPlayer.src = audioUrl;
                
                // Add detailed error handling
                audioPlayer.onerror = (e) => {
                    console.error('Error loading audio:', e);
                    console.error('Audio error code:', audioPlayer.error ? audioPlayer.error.code : 'unknown');
                    console.error('Audio error message:', audioPlayer.error ? audioPlayer.error.message : 'unknown');
                    console.error('Audio src that failed:', audioPlayer.src);
                    
                    // Display error message below audio player
                    const audioSection = document.querySelector('.audio-section');
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'alert alert-danger mt-2';
                    errorMsg.innerHTML = `<strong>Error:</strong> Could not load audio file. <br>
                        The file may be missing or corrupted. You can try re-uploading the lecture.`;
                    audioSection.appendChild(errorMsg);
                };
                
                audioPlayer.onloadeddata = () => {
                    console.log('Audio loaded successfully from:', audioPlayer.src);
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
        
        document.getElementById('transcriptionEditor').value = lecture.transcription.text;
    }

    setupToolbar() {
        const toolbar = document.querySelector('.transcription-toolbar');
        toolbar.addEventListener('click', (e) => {
            const button = e.target.closest('.tool-btn');
            if (!button) return;

            // Remove active class from all buttons
            toolbar.querySelectorAll('.tool-btn').forEach(btn => 
                btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');

            // Handle tool action
            const action = button.dataset.action;
            this.handleToolAction(action);
        });
    }

    handleToolAction(action) {
        const editor = document.getElementById('transcriptionEditor');
        switch(action) {
            case 'find':
                this.showFindDialog();
                break;
        }
    }

    setupAutoSave() {
        let saveTimeout;
        const editor = document.getElementById('transcriptionEditor');
        const status = document.querySelector('.save-status');

        editor.addEventListener('input', () => {
            status.className = 'save-status saving';
            status.innerHTML = '<i class="bi bi-clock"></i><span>Saving...</span>';

            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => this.saveTranscription(true), 2000);
        });
    }

    async saveTranscription(isAutoSave = false) {
        try {
            const transcriptionText = document.getElementById('transcriptionEditor').value;
            const status = document.querySelector('.save-status');

            const response = await fetch(`/api/recordings/${this.lectureId}/transcription`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcription: transcriptionText })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to save transcription');
            }

            // Show save status only after manual save
            if (!isAutoSave) {
                status.style.display = 'flex';
                status.className = 'save-status saved';
                status.innerHTML = '<i class="bi bi-check-circle"></i><span>Changes saved!</span>';
                
                // Hide the status after 3 seconds
                setTimeout(() => {
                    status.style.display = 'none';
                }, 3000);
            }

        } catch (error) {
            console.error('Error saving transcription:', error);
            if (!isAutoSave) {
                alert('Failed to save transcription: ' + error.message);
            }
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatTranscription(text) {
        // Add basic formatting (example implementation)
        return text
            // Add periods at the end of sentences
            .replace(/([a-z])\s+([A-Z])/g, '$1. $2')
            // Capitalize first letter of sentences
            .replace(/(^\w|\.\s+\w)/g, letter => letter.toUpperCase())
            // Add paragraph breaks
            .replace(/\n{3,}/g, '\n\n');
    }

    showFindDialog() {
        // Remove any existing search container
        const existingSearch = document.querySelector('.search-container');
        if (existingSearch) {
            existingSearch.remove();
            return;
        }

        // Create search container
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        
        // Create search input and buttons
        searchContainer.innerHTML = `
            <div class="search-input-group">
                <input type="text" class="search-input" placeholder="Type and press Enter to search...">
                <span class="match-count"></span>
                <button class="search-nav-btn" data-direction="prev">
                    <i class="bi bi-chevron-up"></i>
                </button>
                <button class="search-nav-btn" data-direction="next">
                    <i class="bi bi-chevron-down"></i>
                </button>
                <button class="search-close-btn">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;

        // Add to transcription section
        const transcriptionSection = document.querySelector('.transcription-section');
        transcriptionSection.insertBefore(searchContainer, transcriptionSection.firstChild);

        const searchInput = searchContainer.querySelector('.search-input');
        const matchCount = searchContainer.querySelector('.match-count');
        const editor = document.getElementById('transcriptionEditor');
        const text = editor.value;
        
        let currentMatchIndex = -1;
        let matches = [];

        const performSearch = () => {
            const searchTerm = searchInput.value.trim();
            matches = [];
            currentMatchIndex = -1;
            matchCount.textContent = '';

            if (!searchTerm) return;

            try {
                // Find all matches
                const regex = new RegExp(searchTerm, 'gi');
                let match;
                while ((match = regex.exec(text)) !== null) {
                    matches.push(match);
                }

                // Update match count and navigate to first match
                if (matches.length > 0) {
                    matchCount.textContent = `${matches.length} matches`;
                    navigateMatch('next');
                } else {
                    matchCount.textContent = 'No matches';
                    editor.setSelectionRange(0, 0);
                }
            } catch (e) {
                console.error('Search error:', e);
            }
        };

        const navigateMatch = (direction) => {
            if (!matches.length) return;

            if (direction === 'next') {
                currentMatchIndex = (currentMatchIndex + 1) % matches.length;
            } else {
                currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
            }

            const match = matches[currentMatchIndex];
            editor.focus();
            editor.setSelectionRange(match.index, match.index + match[0].length);
            
            // Ensure the match is visible
            const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
            const matchPosition = editor.value.substr(0, match.index).split('\n').length - 1;
            editor.scrollTop = matchPosition * lineHeight - editor.clientHeight / 2;

            matchCount.textContent = `${currentMatchIndex + 1} of ${matches.length}`;
        };

        // Focus the input
        searchInput.focus();

        // Navigation buttons
        searchContainer.querySelectorAll('.search-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (matches.length > 0) {
                    navigateMatch(btn.dataset.direction);
                }
            });
        });

        // Close button
        searchContainer.querySelector('.search-close-btn').addEventListener('click', () => {
            searchContainer.remove();
            editor.focus();
        });

        // Keyboard shortcuts
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey && matches.length > 0) {
                    // Shift+Enter to go to previous match
                    navigateMatch('prev');
                } else if (matches.length > 0) {
                    // Enter to go to next match
                    navigateMatch('next');
                } else {
                    // No matches yet, perform search
                    performSearch();
                }
            } else if (e.key === 'Escape') {
                searchContainer.remove();
                editor.focus();
            }
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TeacherLectureNotes();
}); 