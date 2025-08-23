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
        this.setupNotesModification();
        this.loadSavedPreferences();
        // Source selectors removed; default to showing saved if present
        
        // Hide save status initially
        const status = document.querySelector('.save-status');
        if (status) status.style.display = 'none';
    }

    ensureSummaryVisibleWithMessage(message) {
        const section = document.querySelector('.summary-section');
        if (!section) return;
        section.style.display = 'block';
        const titleEl = section.querySelector('.summary-title');
        if (titleEl) titleEl.textContent = 'Summary';
        const mainThesis = document.getElementById('mainThesis');
        const context = document.getElementById('context');
        const significance = document.getElementById('significance');
        const keyPoints = document.getElementById('keyPoints');
        const applications = document.getElementById('applications');
        if (mainThesis) mainThesis.textContent = message || '';
        if (context) context.textContent = '';
        if (significance) significance.textContent = '';
        if (keyPoints) keyPoints.innerHTML = '';
        if (applications) applications.innerHTML = '';
    }

    setupEventListeners() {
        const topSaveBtn = document.getElementById('saveTranscription');
        if (topSaveBtn) {
            topSaveBtn.addEventListener('click', async () => {
                const ok = await this.saveTranscription(false);
                if (ok) {
                    this.showToastNotification('Transcription saved');
                } else {
                    this.showToastNotification('Failed to save transcription', false);
                }
            });
        }
        // Wire up regenerate/save buttons for transcript and cleaned transcript
        document.addEventListener('click', async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.id === 'saveTranscriptBtn') {
                const editor = document.getElementById('transcriptionEditor');
                if (!editor) return;
                // Save raw transcription text via existing endpoint and toast result
                const ok = await this.saveTranscription(false);
                if (ok) {
                    this.showToastNotification('Transcription saved');
                } else {
                    this.showToastNotification('Failed to save transcription', false);
                }
            }
            if (target.id === 'editTranscriptBtn') {
                const editor = document.getElementById('transcriptionEditor');
                if (editor) {
                    editor.focus();
                    // add subtle focus ring to container
                    const wrap = editor.closest('.transcript-box');
                    if (wrap) {
                        wrap.classList.add('editing-focus');
                        setTimeout(() => wrap.classList.remove('editing-focus'), 1500);
                    }
                }
            }
            if (target.id === 'regenCleanedBtn') {
                const editor = document.getElementById('transcriptionEditor');
                await this.renderFormattedTranscript(editor.value, null);
            }
            if (target.id === 'saveCleanedBtn') {
                const container = document.getElementById('formattedTranscriptionText');
                const html = container ? container.innerHTML : '';
                await this.saveFinalizedContent({ formattedTranscript: html, summary: null, visualSections: undefined }, 'cleaned transcript');
            }
            if (target.id === 'editCleanedBtn') {
                const container = document.getElementById('formattedTranscriptionText');
                if (container) {
                    container.setAttribute('contenteditable', 'true');
                    this.showToastNotification('Edit mode: Cleaned Transcript');
                }
            }
            // Summary buttons
            if (target.id === 'regenSummaryBtn') {
                await this.handleSummarization();
            }
            if (target.id === 'saveSummaryBtn') {
                // Disable edit mode before collecting
                this.toggleSummaryEditing(false);
                const summary = this.collectRenderedSummary();
                await this.saveFinalizedContent({ formattedTranscript: undefined, summary, visualSections: undefined }, 'summary');
            }
            if (target.id === 'editSummaryBtn') {
                this.toggleSummaryEditing(true);
                this.showToastNotification('Edit mode: Summary');
            }
            // Visual learning buttons
            if (target.id === 'regenVisualBtn') {
                await this.handleVisualLearning();
                this.showToastNotification('Visual learning regenerated');
            }
            if (target.id === 'saveVisualBtn') {
                const sections = this.collectRenderedVisualSections();
                await this.saveFinalizedContent({ formattedTranscript: undefined, summary: undefined, visualSections: sections }, 'visual learning');
            }
            if (target.id === 'editVisualBtn') {
                this.toggleVisualEditing(true);
            }

            // Zoom image (lightbox) handler - supports clicking icon inside the button
            const zoomBtn = target.closest && target.closest('.zoom-image-btn');
            if (zoomBtn) {
                const src = zoomBtn.dataset.src || '';
                const alt = zoomBtn.dataset.alt || 'Image';
                if (src) {
                    this.openImageLightbox(src, alt);
                }
            }
        });
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

    collectRenderedSummary() {
        const summary = {
            title: document.querySelector('.summary-title')?.textContent || 'Lecture Summary',
            overview: {
                mainThesis: document.getElementById('mainThesis')?.textContent || '',
                context: document.getElementById('context')?.textContent || '',
                significance: document.getElementById('significance')?.textContent || ''
            },
            keyTopics: [],
            practicalApplications: []
        };
        document.querySelectorAll('#keyPoints .key-point').forEach(point => {
            const heading = point.querySelector('.point-header h5')?.textContent?.replace(/^\d+\.\s*/, '') || '';
            const mainPoints = Array.from(point.querySelectorAll('.point-content ul li')).map(li => li.textContent.trim());
            summary.keyTopics.push({ heading, mainPoints });
        });
        document.querySelectorAll('#applications .application-item').forEach(app => {
            const h5 = app.querySelector('h5')?.textContent || '';
            const p = app.querySelector('p')?.textContent || '';
            summary.practicalApplications.push({ scenario: h5, explanation: p });
        });
        return summary;
    }

    toggleSummaryEditing(enable) {
        const editableSelectors = [
            '.summary-title',
            '#mainThesis',
            '#context',
            '#significance',
            '#keyPoints .key-point .point-header h5',
            '#keyPoints .key-point .point-content li',
            '#applications .application-item h5',
            '#applications .application-item p'
        ];
        editableSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (enable) {
                    el.setAttribute('contenteditable', 'true');
                } else {
                    el.removeAttribute('contenteditable');
                }
            });
        });
    }

    collectRenderedVisualSections() {
        const sections = [];
        const slides = document.querySelectorAll('#visual-learning-section .visual-slide');
        slides.forEach(slide => {
            const term = slide.querySelector('h3')?.textContent || '';
            const explanation = slide.querySelector('p')?.textContent || '';
            const img = slide.querySelector('img');
            const imageUrl = img ? img.getAttribute('src') : '';
            sections.push({ term, explanation, imageUrl });
        });
        return sections;
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

        // Store finalized for source switching
        this.finalized = lecture.finalized || null;

        // Render AI-cleaned transcript (prefer saved by default)
        this.renderFormattedTranscript(lecture.transcription.text, lecture.finalized?.formattedTranscript);

        // If saved summary exists, render it by default
        if (this.finalized?.summary) {
            this.updateSummaryContent(this.finalized.summary);
            const section = document.querySelector('.summary-section');
            if (section) section.style.display = 'block';
        }

        // If saved visual learning exists, render it by default
        if (this.finalized?.visualSections?.length) {
            this.updateVisualLearningSection(this.finalized.visualSections);
        }
        // Also replace the student-like immediate formatting into the editable area preview if needed

        // Apply initial audio section visibility based on preferences
        try {
            const savedPreferences = localStorage.getItem('notePreferences');
            const audioSection = document.querySelector('.audio-section');
            if (audioSection) {
                if (savedPreferences) {
                    const prefs = JSON.parse(savedPreferences);
                    audioSection.style.display = prefs.audio ? 'block' : 'none';
                } else {
                    audioSection.style.display = 'none';
                }
            }
        } catch (_) {}
    }

    setupToolbar() {
        const toolbar = document.querySelector('.transcription-toolbar');
        if (!toolbar) return; // toolbar removed in HTML; keep safe-guard
        toolbar.addEventListener('click', (e) => {
            const button = e.target.closest('.tool-btn');
            if (!button) return;
            toolbar.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const action = button.dataset.action;
            this.handleToolAction(action);
        });
    }

    async renderFormattedTranscript(transcription, finalizedHtml) {
        try {
            const container = document.getElementById('formattedTranscriptionText');
            if (!container) return;
            // Respect current source selector when available
            const sourceMode = document.getElementById('cleanedSourceSelect')?.value || 'saved';
            if (sourceMode === 'saved' && finalizedHtml && finalizedHtml.trim()) {
                container.innerHTML = finalizedHtml;
            } else {
                container.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Preparing AI-Cleaned Transcript...</p></div>';
            }

            const response = await fetch('/api/format-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcription })
            });

            if (!response.ok) throw new Error('Failed to format transcript');
            const data = await response.json();

            if (data.success && data.formattedTranscript) {
                // Only overwrite UI with generated content if mode is generate
                const modeNow = document.getElementById('cleanedSourceSelect')?.value || 'saved';
                if (modeNow === 'generate' || !finalizedHtml) {
                    container.innerHTML = marked.parse(data.formattedTranscript);
                }
                const handler = new DefinitionsHandler();
                handler.initializeSection(container.parentElement);
            } else {
                // Fallback: add a basic header and paragraph formatting
                const title = document.getElementById('lectureTitle')?.textContent || 'Lecture Transcript';
                const fallbackMd = `# ${title}\n\n${transcription}`;
                container.innerHTML = typeof marked !== 'undefined' ? marked.parse(fallbackMd) : `<h1>${title}</h1><pre>${transcription}</pre>`;
            }
        } catch (error) {
            console.error('Error formatting transcript:', error);
            const container = document.getElementById('formattedTranscriptionText');
            if (container) {
                const title = document.getElementById('lectureTitle')?.textContent || 'Lecture Transcript';
                const fallbackMd = `# ${title}\n\n${transcription}`;
                container.innerHTML = typeof marked !== 'undefined' ? marked.parse(fallbackMd) : `<h1>${title}</h1><pre>${transcription}</pre>`;
            }
        }
    }

    // Save finalized content helpers
    async saveFinalizedContent({ formattedTranscript, summary, visualSections }, label = 'content') {
        try {
            const userEmail = localStorage.getItem('currentUserEmail') || '';
            const userRes = await fetch(`/api/auth/current-user?userEmail=${encodeURIComponent(userEmail)}`);
            const userData = await userRes.json();
            const userId = userData?.user?._id || null;
            const res = await fetch(`/api/recordings/${this.lectureId}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formattedTranscript, summary, visualSections, userId })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
            this.showToastNotification(`Saved ${label} successfully`);
        } catch (e) {
            console.error('Save finalized error:', e);
            this.showToastNotification(`Failed to save ${label}`, false);
        }
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
            return true;
        } catch (error) {
            console.error('Error saving transcription:', error);
            if (!isAutoSave) {
                alert('Failed to save transcription: ' + error.message);
            }
            return false;
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

    // ====== Added: Sidebar and feature controls (parity with student page) ======
    setupNotesModification() {
        const modifyBtn = document.getElementById('modifyNotesBtn');
        const closeBtn = document.getElementById('closeSidebar');
        const savePreferencesBtn = document.getElementById('savePreferences');
        const sidebar = document.getElementById('modifySidebar');

        if (modifyBtn) modifyBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.toggleSidebar(); });
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeSidebar());
        if (savePreferencesBtn) savePreferencesBtn.addEventListener('click', () => this.handleSavePreferences());

        // Source buttons inside preference cards (Saved / Generate New)
        sidebar?.addEventListener('click', async (e) => {
            const btn = e.target.closest && e.target.closest('.source-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const feature = btn.getAttribute('data-feature');
            const mode = btn.getAttribute('data-mode');
            try {
                if (feature === 'cleaned') {
                    const editor = document.getElementById('transcriptionEditor');
                    const text = editor?.value || '';
                    if (mode === 'saved') {
                        if (this.finalized?.formattedTranscript) {
                            const container = document.getElementById('formattedTranscriptionText');
                            if (container) container.innerHTML = this.finalized.formattedTranscript;
                            this.showToastNotification('Loaded saved cleaned transcript');
                        } else {
                            this.showToastNotification('No saved cleaned transcript yet', false);
                        }
                    } else {
                        await this.renderFormattedTranscript(text, null);
                        this.showToastNotification('Generated new cleaned transcript');
                    }
                }
                if (feature === 'summary') {
                    if (mode === 'saved') {
                        if (this.finalized?.summary) {
                            this.updateSummaryContent(this.finalized.summary);
                            const section = document.querySelector('.summary-section');
                            if (section) section.style.display = 'block';
                            this.showToastNotification('Loaded saved summary');
                        } else {
                            this.ensureSummaryVisibleWithMessage('No saved summary yet.');
                            this.showToastNotification('No saved summary yet', false);
                        }
                    } else {
                        await this.handleSummarization();
                        this.showToastNotification('Generated new summary');
                    }
                }
                if (feature === 'visual') {
                    if (mode === 'saved') {
                        if (this.finalized?.visualSections?.length) {
                            await this.updateVisualLearningSection(this.finalized.visualSections);
                            this.showToastNotification('Loaded saved visual learning');
                        } else {
                            const visualSection = document.getElementById('visual-learning-section') || document.querySelector('.visual-learning-section');
                            if (visualSection) {
                                visualSection.style.display = 'block';
                                const contentRoot = visualSection.querySelector('.visual-content') || visualSection;
                                contentRoot.innerHTML = '<p class="no-results">No saved visual learning yet.</p>';
                            }
                            this.showToastNotification('No saved visual learning yet', false);
                        }
                    } else {
                        await this.handleVisualLearning();
                        this.showToastNotification('Generated new visual learning');
                    }
                }
            } catch (err) {
                console.error('Source switch error:', err);
                this.showToastNotification('Failed to switch content source', false);
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!sidebar) return;
            const target = e.target;
            const clickedToggle = (target && (target.id === 'modifyNotesBtn' || target.closest && target.closest('#modifyNotesBtn')));
            if (!sidebar.contains(e.target) && !clickedToggle && sidebar.classList.contains('active')) {
                this.closeSidebar();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('modifySidebar');
        if (sidebar) sidebar.classList.toggle('active');
    }

    closeSidebar() {
        const sidebar = document.getElementById('modifySidebar');
        if (sidebar) sidebar.classList.remove('active');
    }

    loadSavedPreferences() {
        try {
            const savedPreferences = localStorage.getItem('notePreferences');
            if (!savedPreferences) {
                const audioSection = document.querySelector('.audio-section');
                const flashcardsSection = document.querySelector('.flashcards-section');
                if (audioSection) audioSection.style.display = 'none';
                if (flashcardsSection) flashcardsSection.style.display = 'none';
                return;
            }
            const preferences = JSON.parse(savedPreferences);
            Object.entries(preferences).forEach(([key, value]) => {
                const checkbox = document.getElementById(key);
                if (checkbox) {
                    checkbox.checked = value;
                    const card = checkbox.closest('.preference-card');
                    if (card) card.classList.toggle('active', Boolean(value));
                }
            });
            const audioSection = document.querySelector('.audio-section');
            if (audioSection) audioSection.style.display = preferences.audio ? 'block' : 'none';
            const flashcardsSection = document.querySelector('.flashcards-section');
            if (flashcardsSection && !preferences.flashcards) flashcardsSection.style.display = 'none';
        } catch (err) {
            console.error('Error loading preferences:', err);
        }
    }

    async handleSavePreferences() {
        const preferences = {
            summarization: document.getElementById('summarization')?.checked || false,
            flashcards: document.getElementById('flashcards')?.checked || false,
            audio: document.getElementById('audio')?.checked || false,
            visual: document.getElementById('visual')?.checked || false,
            kinesthetic: document.getElementById('kinesthetic')?.checked || false,
        };

        localStorage.setItem('notePreferences', JSON.stringify(preferences));

        const audioSection = document.querySelector('.audio-section');
        if (audioSection) audioSection.style.display = preferences.audio ? 'block' : 'none';

        if (preferences.summarization) await this.handleSummarization();
        if (preferences.flashcards) await this.handleFlashcards();
        if (preferences.visual) await this.handleVisualLearning();
        if (preferences.kinesthetic) await this.handleKinestheticLearning();

        this.showToastNotification('Preferences saved successfully');
        this.closeSidebar();

        // Toggle active cards visual state
        const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const card = e.target.closest('.preference-card');
                if (card) card.classList.toggle('active', e.target.checked);
            });
        });
    }

    async handleSummarization() {
        try {
            this.showLoadingState('Generating lecture summary...');
            const transcription = document.getElementById('transcriptionEditor')?.value || '';
            const response = await fetch('/api/summarize-lecture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcription })
            });
            const data = await response.json();
            if (!response.ok || !data.success || !data.summary) {
                throw new Error(data.error || 'Failed to generate summary');
            }
            this.validateSummaryStructure(data.summary);
            this.updateSummaryContent(data.summary);
            const section = document.querySelector('.summary-section');
            if (section) section.style.display = 'block';
        } catch (error) {
            console.error('Summarization error:', error);
            this.showToastNotification('Failed to generate summary: ' + error.message, false);
            const section = document.querySelector('.summary-section');
            if (section) {
                section.style.display = 'block';
                section.querySelector('.summary-title').textContent = 'Summary Generation Error';
                document.getElementById('mainThesis').textContent = 'We encountered an error while generating your summary.';
                document.getElementById('context').textContent = 'Error details: ' + error.message;
                document.getElementById('significance').textContent = 'Please try again or check the browser console for more information.';
                document.getElementById('keyPoints').innerHTML = '';
                document.getElementById('applications').innerHTML = '';
            }
        } finally {
            this.hideLoadingState();
        }
    }

    validateSummaryStructure(summary) {
        const required = ['title', 'overview', 'keyTopics', 'practicalApplications'];
        const missing = required.filter(f => !summary[f]);
        if (missing.length) throw new Error(`Summary is missing required fields: ${missing.join(', ')}`);
    }

    updateSummaryContent(summary) {
        document.querySelector('.summary-title').textContent = summary.title || 'Lecture Summary';
        document.getElementById('mainThesis').textContent = summary.overview?.mainThesis || '';
        document.getElementById('context').textContent = summary.overview?.context || '';
        document.getElementById('significance').textContent = summary.overview?.significance || '';

        const keyPointsContainer = document.getElementById('keyPoints');
        if (summary.keyTopics && summary.keyTopics.length > 0) {
            keyPointsContainer.innerHTML = summary.keyTopics.map(topic => `
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
            `).join('');
        } else {
            keyPointsContainer.innerHTML = '<p>No key points available.</p>';
        }

        const applicationsContainer = document.getElementById('applications');
        if (summary.practicalApplications && summary.practicalApplications.length > 0) {
            applicationsContainer.innerHTML = summary.practicalApplications.map(app => `
                <div class="application-item definable">
                    <h5>${app.scenario}</h5>
                    <p>${app.explanation}</p>
                </div>
            `).join('');
        } else {
            applicationsContainer.innerHTML = '<p>No practical applications available.</p>';
        }
    }

    async handleVisualLearning() {
        try {
            this.showLoadingState('Preparing visual learning content...');
            const rawResponse = await fetch(`/api/recordings/${this.lectureId}/raw-transcript`);
            if (!rawResponse.ok) throw new Error('Failed to fetch raw transcript');
            const rawData = await rawResponse.json();
            if (!rawData.success || !rawData.rawTranscript) throw new Error(rawData.error || 'No transcript available');

            const response = await fetch('/api/extract-key-terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    transcription: rawData.rawTranscript,
                    lectureTitle: document.getElementById('lectureTitle')?.textContent || ''
                })
            });
            if (!response.ok) throw new Error('Failed to extract key terms');
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to extract key terms');
            if (data.sections && data.sections.length > 0) {
                await this.updateVisualLearningSection(data.sections);
                this.showToastNotification('Visual learning content ready');
            } else {
                throw new Error('No visual learning sections were generated');
            }
        } catch (error) {
            console.error('Visual learning error:', error);
            this.showToastNotification('Failed to process visual learning: ' + error.message, false);
            const section = document.getElementById('visual-learning-section') || document.querySelector('.visual-learning-section');
            if (section) {
                section.innerHTML = '<h2>Visual Learning</h2>' +
                    '<p class="error">Failed to generate visual learning content: ' + error.message + '</p>';
                section.style.display = 'block';
            }
        } finally {
            this.hideLoadingState();
        }
    }

    async updateVisualLearningSection(sections) {
        const visualLearningSection = document.getElementById('visual-learning-section') || 
                                  document.querySelector('.visual-learning-section');
        
        if (!visualLearningSection) {
            throw new Error('Visual learning section not found in the DOM');
        }

        // Use the dedicated content root when present
        const contentRoot = visualLearningSection.querySelector('.visual-content') || visualLearningSection;
        contentRoot.innerHTML = '';
        visualLearningSection.style.display = 'block';
        
        // Use all available sections (already teacher-saved or newly generated)
        const limitedSections = sections;
        
        if (limitedSections.length === 0) {
            contentRoot.innerHTML += '<p class="no-results">No visual learning items could be generated for this lecture.</p>'; 
            return;
        }
        
        // Create a container for the visual learning slideshow
        const slideContainer = document.createElement('div');
        slideContainer.className = 'visual-slideshow-container';
        
        // Add slides for each term
        for (const section of limitedSections) {
            try {
                // Prefer saved imageUrl if provided (teacher-saved). Fallback to scraping if missing.
                const imageUrl = section.imageUrl && section.imageUrl.trim()
                    ? section.imageUrl
                    : await this.searchImageForTerm(section.term);
                
                // Create the slide
                const slide = document.createElement('div');
                slide.className = 'visual-slide';
                
                // Create the content for the slide
                slide.innerHTML = `
                    <div class="visual-slide-content">
                        <div class="visual-slide-image" style="position:relative;">
                            <img src="${imageUrl}" alt="${section.term}" onerror="this.style.display='none'">
                            <button class="zoom-image-btn" data-src="${imageUrl}" data-alt="${section.term}"
                                style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;" title="Expand">
                                <i class="bi bi-arrows-fullscreen"></i>
                            </button>
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
            contentRoot.innerHTML += '<p class="no-results">Failed to create any visual learning items.</p>';
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
        contentRoot.appendChild(slideContainer);
        contentRoot.appendChild(navigation);
        
        // Set up navigation
        this.setupVisualSlideNavigation(slideContainer, navigation);
    }

    setupVisualSlideNavigation(slideContainer, navigation) {
        const prevButton = navigation.querySelector('.prev-slide');
        const nextButton = navigation.querySelector('.next-slide');
        const slideCounter = navigation.querySelector('.slide-counter');
        const slides = slideContainer.querySelectorAll('.visual-slide');
        let currentSlide = 0;
        const updateNavigation = () => {
            prevButton.disabled = currentSlide === 0;
            nextButton.disabled = currentSlide === slides.length - 1;
            slideCounter.textContent = `${currentSlide + 1}/${slides.length}`;
        };
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

    async searchImageForTerm(term) {
        if (!term) return null;
        try {
            const lectureTitle = document.getElementById('lectureTitle').textContent;
            const response = await fetch('/api/search-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `educational concept illustration about ${term} in the context of ${lectureTitle}` })
            });
            if (!response.ok) throw new Error(`Image search failed with status: ${response.status}`);
            const data = await response.json();
            if (data.success && data.imageUrl) {
                if (window.toast && data.source) {
                    window.toast.info(`Image source: ${data.source}`);
                }
                return data.imageUrl;
            }
            const fallback = await fetch('/api/search-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `${term} in the context of ${lectureTitle}` })
            });
            if (fallback.ok) {
                const fData = await fallback.json();
                if (fData.success && fData.imageUrl) {
                    if (window.toast && fData.source) {
                        window.toast.info(`Image source: ${fData.source}`);
                    }
                    return fData.imageUrl;
                }
            }
            return null;
        } catch (e) {
            console.error('Error searching image:', e);
            return null;
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
        if (loader) loader.remove();
    }

    showToastNotification(message, isSuccess = true, duration = 3000) {
        try { console.log('[Toast] Request', { message, isSuccess, duration }); } catch(_) {}
        // Remove any existing scribe toast
        const existing = document.getElementById('scribe-toast');
        if (existing) existing.remove();

        // Container
        const toast = document.createElement('div');
        toast.id = 'scribe-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.maxWidth = '360px';
        toast.style.background = '#ffffff';
        toast.style.color = '#333';
        toast.style.borderRadius = '8px';
        toast.style.padding = '12px 14px';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
        toast.style.zIndex = '2147483647';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '10px';
        toast.style.borderLeft = `4px solid ${isSuccess ? '#22c55e' : '#ef4444'}`;

        // Icon (simple text to avoid asset issues)
        const icon = document.createElement('span');
        icon.textContent = isSuccess ? '✓' : '✕';
        icon.style.fontWeight = '700';
        icon.style.color = isSuccess ? '#22c55e' : '#ef4444';
        icon.style.fontSize = '18px';

        const text = document.createElement('span');
        text.textContent = message;
        text.style.flex = '1';
        text.style.fontSize = '14px';

        // Progress bar
        const track = document.createElement('div');
        track.style.position = 'absolute';
        track.style.bottom = '0';
        track.style.left = '0';
        track.style.width = '100%';
        track.style.height = '4px';
        track.style.background = 'rgba(0,0,0,0.1)';

        const bar = document.createElement('div');
        bar.style.width = '100%';
        bar.style.height = '100%';
        bar.style.background = isSuccess ? '#22c55e' : '#ef4444';
        bar.style.transition = `width ${duration}ms linear`;
        setTimeout(() => { bar.style.width = '0%'; }, 10);

        track.appendChild(bar);
        toast.appendChild(icon);
        toast.appendChild(text);
        toast.appendChild(track);

        document.body.appendChild(toast);
        try { console.log('[Toast] Mounted to DOM'); } catch(_) {}

        // Auto-dismiss
        const hide = () => {
            try { console.log('[Toast] Auto-dismiss'); } catch(_) {}
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 200ms ease';
            setTimeout(() => toast.remove(), 200);
        };
        setTimeout(hide, duration);

        // Click to dismiss
        toast.addEventListener('click', () => {
            try { console.log('[Toast] Click-dismiss'); } catch(_) {}
            hide();
        });
    }

    async handleKinestheticLearning() {
        try {
            const loader = document.createElement('div');
            loader.className = 'summary-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p>Preparing interactive quizzes...</p>
                <small>This may take a moment</small>
            `;
            document.body.appendChild(loader);
            const transcription = document.getElementById('transcriptionEditor').value;
            const lectureTitle = document.getElementById('lectureTitle').textContent;
            const response = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcription, lectureTitle })
            });
            if (!response.ok) throw new Error('Failed to generate quiz');
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to generate quiz');
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
        const existingQuiz = document.querySelector('.kinesthetic-section');
        if (existingQuiz) existingQuiz.remove();
        const quizSection = document.createElement('section');
        quizSection.className = 'kinesthetic-section';
        quizSection.style.backgroundColor = '#e0ebe6';
        quizSection.style.padding = '1.5rem';
        quizSection.style.borderRadius = '0.8rem';
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
        const contentGrid = document.querySelector('.content-grid');
        contentGrid.appendChild(quizSection);
        this.createCategorizationQuiz(quizContent.categorization, document.getElementById('categorizationQuiz'));
        this.createMultipleChoiceQuiz(quizContent.multipleChoice, document.getElementById('multipleChoiceQuiz'));
        const modeButtons = quizSection.querySelectorAll('.mode-btn');
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                modeButtons.forEach(btn => { btn.classList.remove('active'); btn.style.backgroundColor = '#7e9ebf'; });
                button.classList.add('active');
                button.style.backgroundColor = '#6b88a7';
                const mode = button.dataset.mode;
                document.getElementById('categorizationQuiz').classList.toggle('active', mode === 'categorization');
                document.getElementById('multipleChoiceQuiz').classList.toggle('active', mode === 'multipleChoice');
            });
        });
        this.initializeCategorizationDragDrop();
    }

    createCategorizationQuiz(quizContent, container) {
        const shuffledItems = [...quizContent.items].sort(() => Math.random() - 0.5);
        const quizHTML = `
            <h3>Drag & Drop Categorization Quiz</h3>
            <p class="quiz-instructions">Drag each item to its correct category.</p>
            <div class="categorization-quiz">
                <div class="categories-container">
                    ${quizContent.categories.map(category => `
                        <div class="category-column">
                            <div class="category-header"><h3 class="category-title">${category}</h3></div>
                            <div class="category-items" data-category="${category}">Drop items here</div>
                        </div>
                    `).join('')}
                </div>
                <div class="items-pool">
                    ${shuffledItems.map(item => `
                        <div class="item" draggable="true" data-category="${item.category}">${item.text}</div>
                    `).join('')}
                </div>
            </div>
            <div class="quiz-controls">
                <button class="check-answers-btn" id="checkCategorization">Check Categories</button>
                <button class="reset-quiz-btn" id="resetCategorization">Reset Quiz</button>
            </div>
        `;
        container.innerHTML = quizHTML;
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
                                        <input type="radio" id="q${qIndex}_option${oIndex}" name="question${qIndex}" value="${oIndex}" data-correct="${oIndex === q.correctAnswer}">
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
        this.setupMultipleChoiceNavigation(container, quizContent.questions.length);
        const checkButton = container.querySelector('.check-answers-btn');
        checkButton.addEventListener('click', () => {
            if (!checkButton.disabled) {
                this.checkMultipleChoiceAnswers();
            } else {
                checkButton.dataset.attempted = 'true';
                this.updateCheckButtonState();
            }
        });
        container.querySelector('.reset-quiz-btn').addEventListener('click', () => this.resetMultipleChoiceQuiz());
        const radios = container.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => this.updateCheckButtonState());
        });
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
            if (!answered) { allAnswered = false; unansweredCount++; }
        });
        checkButton.disabled = !allAnswered;
        if (allAnswered) {
            checkButton.style.opacity = '1';
            checkButton.style.backgroundColor = 'var(--button-color)';
            checkButton.style.cursor = 'pointer';
        } else {
            checkButton.style.opacity = '0.5';
            checkButton.style.backgroundColor = '#cccccc';
            checkButton.style.cursor = 'not-allowed';
        }
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
        const updateQuestionVisibility = () => {
            container.querySelectorAll('.question').forEach((question, index) => {
                question.style.display = index === currentQuestionIndex ? 'block' : 'none';
            });
            currentQuestionSpan.textContent = currentQuestionIndex + 1;
            prevButton.disabled = currentQuestionIndex === 0;
            nextButton.disabled = currentQuestionIndex === totalQuestions - 1;
        };
        prevButton.addEventListener('click', () => { if (currentQuestionIndex > 0) { currentQuestionIndex--; updateQuestionVisibility(); } });
        nextButton.addEventListener('click', () => { if (currentQuestionIndex < totalQuestions - 1) { currentQuestionIndex++; updateQuestionVisibility(); } });
        updateQuestionVisibility();
    }

    checkMultipleChoiceAnswers() {
        const questions = document.querySelectorAll('.question');
        let correctCount = 0;
        const totalQuestions = questions.length;
        questions.forEach(question => {
            const questionIndex = question.dataset.question;
            const selectedOption = question.querySelector('input[type="radio"]:checked');
            const feedbackArea = document.getElementById(`feedback_${questionIndex}`);
            const explanationArea = document.getElementById(`explanation_${questionIndex}`);
            if (!selectedOption) return;
            const isCorrect = selectedOption.dataset.correct === 'true';
            if (isCorrect) {
                correctCount++;
                this.showQuizFeedback('Correct!', true, feedbackArea);
            } else {
                const correctOption = question.querySelector('input[data-correct="true"]');
                const correctLabel = correctOption ? correctOption.nextElementSibling.textContent : '';
                this.showQuizFeedback(`Incorrect. The correct answer is: ${correctLabel}`, false, feedbackArea);
            }
            if (explanationArea) explanationArea.style.display = 'block';
        });
        const quizContainer = document.querySelector('.multiple-choice-quiz');
        let scoreDisplay = quizContainer.querySelector('.quiz-score');
        if (!scoreDisplay) {
            scoreDisplay = document.createElement('div');
            scoreDisplay.className = 'quiz-score';
            quizContainer.querySelector('.quiz-controls').insertAdjacentElement('beforebegin', scoreDisplay);
        }
        const percentage = Math.round((correctCount / totalQuestions) * 100);
        scoreDisplay.innerHTML = `<div class="score-display"><h4>Your Score: ${correctCount}/${totalQuestions} (${percentage}%)</h4><p>Nice work! Take a moment to review your answers and keep learning.</p></div>`;
        const checkButton = document.getElementById('checkMultipleChoice');
        if (checkButton) checkButton.disabled = true;
    }

    resetMultipleChoiceQuiz() {
        const quiz = document.querySelector('.multiple-choice-quiz');
        if (!quiz) return;
        quiz.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        quiz.querySelectorAll('.feedback-area').forEach(f => f.innerHTML = '');
        quiz.querySelectorAll('.explanation-area').forEach(e => e.style.display = 'none');
        const checkButton = document.getElementById('checkMultipleChoice');
        if (checkButton) checkButton.disabled = true;
    }

    showQuizFeedback(message, isCorrect, container) {
        container.innerHTML = '';
        const feedback = document.createElement('div');
        feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        feedback.innerHTML = `<i class="bi ${isCorrect ? 'bi-check-circle' : 'bi-x-circle'}"></i><span>${message}</span>`;
        container.appendChild(feedback);
        if (container.classList.contains('quiz-feedback-area')) {
            setTimeout(() => { feedback.classList.add('fade-out'); setTimeout(() => feedback.remove(), 3000); }, 3000);
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
                if (!isCorrect) allCorrect = false;
            });
        });
        return allCorrect;
    }

    resetCategorizationQuiz() {
        const pool = document.querySelector('.items-pool');
        const items = document.querySelectorAll('.item');
        items.forEach(item => { if (pool) pool.appendChild(item); });
        document.querySelectorAll('.category-items').forEach(container => {
            if (!container.querySelector('.item')) container.innerHTML = 'Drop items here';
        });
    }

    initializeCategorizationDragDrop() {
        const items = document.querySelectorAll('.item');
        const categoryContainers = document.querySelectorAll('.category-items');
        const itemsPool = document.querySelector('.items-pool');
        items.forEach(item => {
            item.addEventListener('dragstart', () => { item.classList.add('dragging'); setTimeout(() => { item.style.opacity = '0.4'; }, 0); });
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); item.style.opacity = '1'; });
        });
        categoryContainers.forEach(container => {
            container.addEventListener('dragover', e => { e.preventDefault(); container.classList.add('drag-over'); });
            container.addEventListener('dragleave', () => { container.classList.remove('drag-over'); });
            container.addEventListener('drop', e => { e.preventDefault(); const item = document.querySelector('.dragging'); if (!item) return; if (container.textContent.trim() === 'Drop items here') container.innerHTML = ''; container.appendChild(item); container.classList.remove('drag-over'); });
        });
        if (itemsPool) {
            itemsPool.addEventListener('dragover', e => { e.preventDefault(); itemsPool.classList.add('drag-over'); });
            itemsPool.addEventListener('dragleave', () => { itemsPool.classList.remove('drag-over'); });
            itemsPool.addEventListener('drop', e => { e.preventDefault(); const item = document.querySelector('.dragging'); if (!item) return; itemsPool.appendChild(item); itemsPool.classList.remove('drag-over'); item.classList.remove('correct', 'incorrect'); });
        }
        // Mobile touch support (optional)
        let touchDragItem = null; let touchDragClone = null; let lastTouchTarget = null;
        function getDropTarget(touch) {
            const x = touch.clientX; const y = touch.clientY;
            for (const container of categoryContainers) { const rect = container.getBoundingClientRect(); if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return container; }
            if (itemsPool) { const rect = itemsPool.getBoundingClientRect(); if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return itemsPool; }
            return null;
        }
        items.forEach(item => {
            item.addEventListener('touchstart', function(e){ if (e.touches.length > 1) return; const t=e.touches[0]; touchDragItem=item; touchDragClone=item.cloneNode(true); touchDragClone.style.position='fixed'; touchDragClone.style.left=t.clientX+'px'; touchDragClone.style.top=t.clientY+'px'; touchDragClone.style.width=item.offsetWidth+'px'; touchDragClone.style.pointerEvents='none'; touchDragClone.style.opacity='0.8'; touchDragClone.style.zIndex='9999'; touchDragClone.classList.add('dragging'); document.body.appendChild(touchDragClone); item.classList.add('dragging'); lastTouchTarget=null; e.preventDefault(); }, {passive:false});
            item.addEventListener('touchmove', function(e){ if (!touchDragClone||!touchDragItem) return; const t=e.touches[0]; touchDragClone.style.left=(t.clientX - touchDragClone.offsetWidth/2)+'px'; touchDragClone.style.top=(t.clientY - touchDragClone.offsetHeight/2)+'px'; const target=getDropTarget(t); if (lastTouchTarget && lastTouchTarget!==target) lastTouchTarget.classList.remove('drag-over'); if (target) target.classList.add('drag-over'); lastTouchTarget=target; e.preventDefault(); }, {passive:false});
            item.addEventListener('touchend', function(e){ if (!touchDragClone||!touchDragItem) return; const t=e.changedTouches[0]; const dropTarget=getDropTarget(t); document.body.removeChild(touchDragClone); touchDragClone=null; if (lastTouchTarget) lastTouchTarget.classList.remove('drag-over'); if (dropTarget){ if (dropTarget.classList.contains('category-items')){ if (dropTarget.textContent.trim()==='Drop items here') dropTarget.innerHTML=''; dropTarget.appendChild(touchDragItem);} else if (dropTarget===itemsPool){ itemsPool.appendChild(touchDragItem); touchDragItem.classList.remove('correct','incorrect'); } } touchDragItem.classList.remove('dragging'); touchDragItem=null; lastTouchTarget=null; e.preventDefault(); }, {passive:false});
        });
    }

    async handleFlashcards() {
        try {
            const loader = document.createElement('div');
            loader.className = 'summary-loader';
            loader.innerHTML = `
                <div class="loader-spinner"></div>
                <p>Generating flashcards...</p>
                <small>This may take a moment</small>
            `;
            document.body.appendChild(loader);
            const transcription = document.getElementById('transcriptionEditor').value;
            const lectureTitle = document.getElementById('lectureTitle').textContent;
            const response = await fetch('/api/generate-flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcription, lectureTitle })
            });
            if (!response.ok) throw new Error('Failed to generate flashcards');
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to generate flashcards');
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
        const existingSection = document.querySelector('.flashcards-section');
        if (existingSection) existingSection.remove();
        const section = document.createElement('section');
        section.className = 'flashcards-section';
        section.innerHTML = `
            <h2>Study Flashcards</h2>
            <div class="flashcards-controls">
                <div class="mode-selector">
                    <button class="mode-btn active" data-mode="read">Read Mode</button>
                    <button class="mode-btn" data-mode="practice">Practice Mode</button>
                    <div class="practice-progress"><i class="bi bi-stack"></i><span class="progress-count"></span></div>
                </div>
                <div class="mode-instructions">Read Mode: Flip through cards freely | Practice Mode: Test your knowledge</div>
                <div class="study-controls">
                    <button class="prev-card" disabled><i class="bi bi-chevron-left"></i></button>
                    <span class="card-counter">1/${flashcards.length}</span>
                    <button class="next-card"><i class="bi bi-chevron-right"></i></button>
                    <button class="shuffle-cards"><i class="bi bi-shuffle"></i></button>
                </div>
            </div>
            <div class="flashcards-container">
                ${flashcards.map((card, index) => `
                    <div class="flashcard ${index === 0 ? 'active' : ''}" data-category="${card.category}">
                        <div class="flashcard-inner">
                            <div class="flashcard-front">
                                <div class="card-content">${card.front}</div>
                                <div class="flip-hint"><i class="bi bi-arrow-repeat"></i>Click to reveal answer</div>
                            </div>
                            <div class="flashcard-back">
                                <div class="card-content">${card.back}</div>
                                <div class="practice-controls" style="display: none;">
                                    <div class="practice-feedback"></div>
                                    <div class="practice-buttons">
                                        <button class="remember-btn"><i class="bi bi-check-lg"></i>Got It Right</button>
                                        <button class="forgot-btn"><i class="bi bi-arrow-repeat"></i>Review Later</button>
                                    </div>
                                </div>
                                <div class="flip-hint read-mode"><i class="bi bi-arrow-repeat"></i>Click to flip back</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
                <div class="completion-message" style="display: none;">
                    <div class="completion-content"><i class="bi bi-trophy"></i><h3>Great Job!</h3><p>You've completed all the flashcards in this session.</p><div class="completion-buttons"><button class="restart-practice">Practice Again</button><button class="switch-to-read">Switch to Read Mode</button></div></div>
                </div>
            </div>
        `;
        const contentGrid = document.querySelector('.content-grid');
        contentGrid.appendChild(section);
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
        let currentIndex = 0; let visibleCards = [...cards]; let forgottenCards = []; let currentMode = 'read'; let rememberedCards = new Set();
        cards.forEach(card => {
            card.addEventListener('click', () => { if (currentMode === 'read' || !card.classList.contains('flipped')) card.classList.toggle('flipped'); });
            const rememberBtn = card.querySelector('.remember-btn');
            const forgotBtn = card.querySelector('.forgot-btn');
            if (rememberBtn) rememberBtn.addEventListener('click', (e) => { e.stopPropagation(); handleRemembered(card); });
            if (forgotBtn) forgotBtn.addEventListener('click', (e) => { e.stopPropagation(); handleForgotten(card); });
        });
        modeButtons.forEach(button => {
            button.addEventListener('click', () => { const newMode = button.dataset.mode; if (newMode === currentMode) return; modeButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); currentMode = newMode; resetPracticeSession(); studyControls.style.display = currentMode === 'read' ? 'flex' : 'none'; });
        });
        prevButton.addEventListener('click', () => { if (currentMode === 'read' && currentIndex > 0) { currentIndex--; updateCardVisibility(); updateCounter(); } });
        nextButton.addEventListener('click', () => { if (currentMode === 'read' && currentIndex < visibleCards.length - 1) { currentIndex++; updateCardVisibility(); updateCounter(); } });
        shuffleButton.addEventListener('click', () => { if (currentMode === 'read') { resetCards(); visibleCards = [...cards].sort(() => Math.random() - 0.5); currentIndex = 0; updateCardVisibility(); updateCounter(); shuffleButton.classList.add('rotating'); setTimeout(() => shuffleButton.classList.remove('rotating'), 500); } });
        function handleRemembered(card) { if (currentMode !== 'practice') return; const feedback = card.querySelector('.practice-feedback'); rememberedCards.add(card); feedback.textContent = 'Great job!'; feedback.classList.add('show'); setTimeout(() => { if (rememberedCards.size === cards.length) { completionMessage.style.display = 'flex'; completionMessage.classList.add('show'); const restartButton = completionMessage.querySelector('.restart-practice'); const switchToReadButton = completionMessage.querySelector('.switch-to-read'); if (restartButton) restartButton.onclick = resetPracticeSession; if (switchToReadButton) switchToReadButton.onclick = () => { const readModeBtn = document.querySelector('.mode-btn[data-mode="read"]'); if (readModeBtn) readModeBtn.click(); }; cards.forEach(c => c.style.display = 'none'); } else if (currentIndex < visibleCards.length - 1) { feedback.textContent = 'Moving to next card...'; setTimeout(() => { currentIndex++; updateCardVisibility(); updateCounter(); }, 500); } updateProgressCount(); }, 500); }
        function handleForgotten(card) { if (currentMode !== 'practice') return; const feedback = card.querySelector('.practice-feedback'); rememberedCards.delete(card); forgottenCards.push(card); feedback.textContent = "No problem! We'll review this one later."; feedback.classList.add('show'); setTimeout(() => { if (currentIndex < visibleCards.length - 1) { currentIndex++; updateCardVisibility(); updateCounter(); } else { visibleCards = [...forgottenCards]; forgottenCards = []; visibleCards.sort(() => Math.random() - 0.5); currentIndex = 0; updateCardVisibility(); updateCounter(); } }, 1000); }
        function resetCards() { cards.forEach(card => { card.classList.remove('flipped'); card.style.display = ''; const feedback = card.querySelector('.practice-feedback'); if (feedback) feedback.classList.remove('show'); }); forgottenCards = []; rememberedCards.clear(); completionMessage.style.display = 'none'; completionMessage.classList.remove('show'); }
        function resetPracticeSession() { resetCards(); visibleCards = [...cards]; if (currentMode === 'practice') visibleCards.sort(() => Math.random() - 0.5); currentIndex = 0; cards.forEach(card => card.style.display = ''); completionMessage.style.display = 'none'; completionMessage.classList.remove('show'); updateCardVisibility(); updateCounter(); updatePracticeMode(); }
        function updatePracticeMode() { cards.forEach(card => { const practiceControls = card.querySelector('.practice-controls'); const readModeHint = card.querySelector('.flip-hint.read-mode'); if (currentMode === 'practice') { practiceControls.style.display = 'flex'; readModeHint.style.display = 'none'; document.querySelector('.practice-progress').classList.add('show'); } else { practiceControls.style.display = 'none'; readModeHint.style.display = 'block'; document.querySelector('.practice-progress').classList.remove('show'); } }); updateProgressCount(); }
        function updateProgressCount() { const progressCount = document.querySelector('.progress-count'); if (progressCount && currentMode === 'practice') { progressCount.textContent = `${rememberedCards.size}/${cards.length} Completed`; } }
        function updateCardVisibility() { cards.forEach(card => { card.classList.remove('active', 'flipped'); const feedback = card.querySelector('.practice-feedback'); if (feedback) feedback.classList.remove('show'); }); if (visibleCards[currentIndex]) { visibleCards[currentIndex].classList.add('active'); updateProgressCount(); } }
        function updateCounter() { counter.textContent = `${currentIndex + 1}/${visibleCards.length}`; prevButton.disabled = currentIndex === 0; nextButton.disabled = currentIndex === visibleCards.length - 1; }
        let touchStartX = 0; flashcardsContainer.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }); flashcardsContainer.addEventListener('touchend', e => { const touchEndX = e.changedTouches[0].screenX; const diff = touchStartX - touchEndX; const swipeThreshold = 50; if (Math.abs(diff) < swipeThreshold) return; if (diff > 0 && currentIndex < visibleCards.length - 1) { currentIndex++; } else if (diff < 0 && currentIndex > 0) { currentIndex--; } updateCardVisibility(); updateCounter(); });
        updatePracticeMode(); updateProgressCount();
    }

    toggleVisualEditing(enable) {
        const section = document.getElementById('visual-learning-section') || document.querySelector('.visual-learning-section');
        if (!section) return;
        const slides = section.querySelectorAll('.visual-slide-text h3, .visual-slide-text p');
        slides.forEach(el => {
            if (enable) {
                el.setAttribute('contenteditable', 'true');
                // seamless styles handled by CSS
            } else {
                el.removeAttribute('contenteditable');
                // reset handled by CSS
            }
        });
    }

    showEditingChip(anchorButton, text) {
        // Prevent duplicates
        const existing = anchorButton.parentElement?.querySelector('.editing-chip');
        if (existing) return;
        const chip = document.createElement('span');
        chip.className = 'editing-chip';
        chip.textContent = text;
        anchorButton.parentElement?.appendChild(chip);
        // Auto-hide after 5 seconds
        setTimeout(() => chip.remove(), 5000);
    }

    openImageLightbox(src, alt) {
        // Remove existing lightbox
        const existing = document.getElementById('image-lightbox');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'image-lightbox';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.75)';
        overlay.style.zIndex = '2147483647';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '24px';
        
        const imgWrap = document.createElement('div');
        imgWrap.style.width = '90vw';
        imgWrap.style.height = '90vh';
        imgWrap.style.display = 'flex';
        imgWrap.style.alignItems = 'center';
        imgWrap.style.justifyContent = 'center';
        imgWrap.style.position = 'relative';
        
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || 'Zoomed Image';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 12px 36px rgba(0,0,0,0.5)';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '8px';
        closeBtn.style.width = '32px';
        closeBtn.style.height = '32px';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.border = 'none';
        closeBtn.style.background = '#ffffff';
        closeBtn.style.color = '#111827';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        closeBtn.addEventListener('click', () => overlay.remove());
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        
        imgWrap.appendChild(img);
        imgWrap.appendChild(closeBtn);
        overlay.appendChild(imgWrap);
        document.body.appendChild(overlay);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TeacherLectureNotes();
}); 