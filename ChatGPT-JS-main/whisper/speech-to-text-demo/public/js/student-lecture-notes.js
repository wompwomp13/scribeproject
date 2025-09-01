class StudentLectureNotes {
    constructor() {
        this.lectureId = new URLSearchParams(window.location.search).get('id');
        this.courseId = new URLSearchParams(window.location.search).get('courseId');
        this.quill = null; // Initialize Quill reference
        this.finalized = null; // Teacher-approved content
        
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

        // Global zoom handler
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.zoom-image-btn');
            if (btn) {
                const src = btn.dataset.src || '';
                const alt = btn.dataset.alt || 'Image';
                if (src) this.openImageLightbox(src, alt);
            }
        });
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
            // Fetch teacher-finalized content in parallel
            await this.fetchFinalizedContent();
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

    async updateUI(lecture) {
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
                
                console.log('[AudioSource] Candidate network URL:', audioUrl);
                // Try to load local cached copy first (if previously saved by the student)
                await this.tryLoadLocalAudioOrOfferDownload({
                    audioEl: audio,
                    lectureId: this.lectureId,
                    filename: lecture.audioFile.filename || (new URL(audioUrl, window.location.origin).pathname.split('/').pop()),
                    networkUrl: audioUrl
                });
                
                // Add detailed error logging
                audio.onerror = async (e) => {
                    console.error('Error loading audio:', e);
                    console.error('Audio error code:', audio.error ? audio.error.code : 'unknown');
                    console.error('Audio error message:', audio.error ? audio.error.message : 'unknown');
                    console.error('Audio src that failed:', audio.src);

                    // Network failed? Try local fallback if available
                    try {
                        const blobUrl = await this.getLocalAudioBlobUrl(this.lectureId);
                        if (blobUrl) {
                            console.log('Falling back to local cached audio');
                            audio.src = blobUrl;
                            audio.dataset.source = 'local';
                            this.renderOfflineStatus('Playing from your device');
                            return;
                        }
                    } catch (_) {}
                    
                    // Display error message below audio player
                    const audioSection = document.querySelector('.audio-section');
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'alert alert-danger mt-2';
                    errorMsg.innerHTML = `<strong>Error:</strong> Could not load audio file. <br>
                        Please contact your teacher or try again later.`;
                    audioSection.appendChild(errorMsg);

                    // If we have a cached copy, offer a button to play from cache (no permissions needed)
                    try {
                        const cachedUrl = await this.getCachedAudioBlobUrl(audio.dataset.networkUrl || '');
                        if (cachedUrl) {
                            this.renderPlayLocalButton(async () => {
                                audio.src = cachedUrl;
                                audio.dataset.source = 'cache';
                                this.renderOfflineStatus('Playing from this device');
                            });
                        }
                    } catch (_) {}

                    // If we have a known local mapping, offer a button to play from device (requests permission via user gesture)
                    const mapping = await this.idbGet('files', this.lectureId).catch(() => null);
                    if (mapping && mapping.filename) {
                        this.renderPlayLocalButton(async () => {
                            try {
                                const handle = await this.ensureStudentAudioDirHandle();
                                if (!handle) return;
                                const fileHandle = await handle.getFileHandle(mapping.filename, { create: false });
                                const file = await fileHandle.getFile();
                                const url = URL.createObjectURL(file);
                                audio.src = url;
                                audio.dataset.source = 'local';
                                audio.dataset.localFilename = mapping.filename;
                                this.renderOfflineStatus('Playing from your device');
                            } catch (err) {
                                console.error('Play local failed:', err);
                                if (window.toast && window.toast.error) window.toast.error('Could not open local copy.');
                            }
                        });
                    }

                    // Always offer a button to grant folder access again (user gesture)
                    this.renderGrantAccessButton(async () => {
                        try {
                            const handle = await this.ensureStudentAudioDirHandle();
                            if (!handle) return;
                            // After permission, try to play from cache first, then local FS
                            const cachedUrl2 = await this.getCachedAudioBlobUrl(audio.dataset.networkUrl || '');
                            if (cachedUrl2) {
                                audio.src = cachedUrl2;
                                audio.dataset.source = 'cache';
                                this.renderOfflineStatus('Playing from this device');
                                return;
                            }
                            await this.tryPlayFromLocalIfAvailable(audio);
                        } catch (err) {
                            console.error('Grant access failed:', err);
                            if (window.toast && window.toast.error) window.toast.error('Folder access denied.');
                        }
                    });
                };
                
                audio.onloadeddata = () => {
                    console.log('[AudioSource] Loaded OK', {
                        source: audio.dataset.source || 'unknown',
                        url: audio.src,
                        lectureId: this.lectureId,
                        localFilename: audio.dataset.localFilename || null,
                        networkUrl: audio.dataset.networkUrl || null
                    });
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
            
            // Prefer teacher-finalized cleaned transcript when available
            if (this.finalized && this.finalized.formattedTranscript) {
                transcriptionElement.innerHTML = this.finalized.formattedTranscript;
            } else {
                // Fallback: format the transcription with Groq
                this.formatTranscript(lecture.transcription.text);
            }
            
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

    // ===== Student-side local audio caching (File System Access API + IndexedDB) =====
    async tryLoadLocalAudioOrOfferDownload({ audioEl, lectureId, filename, networkUrl }) {
        // If local copy exists, load it; otherwise set network and show a "Make available offline" button
        // Try IndexedDB blob first (no special permissions)
        const idbUrl = await this.idbGetAudioBlobUrl(lectureId);
        if (idbUrl) {
            console.log('[AudioSource] Using IDB blob', { lectureId, url: idbUrl });
            audioEl.src = idbUrl;
            audioEl.dataset.source = 'idb';
            audioEl.dataset.networkUrl = networkUrl;
            this.renderOfflineStatus('Playing from this device');
            this.removeSaveOfflineButton();
            return;
        }

        // Then Cache Storage
        const cachedUrl = await this.getCachedAudioBlobUrl(networkUrl);
        if (cachedUrl) {
            console.log('[AudioSource] Using CACHED blob (Cache Storage)', { lectureId, url: cachedUrl, key: networkUrl });
            audioEl.src = cachedUrl;
            audioEl.dataset.source = 'cache';
            audioEl.dataset.networkUrl = networkUrl;
            this.renderOfflineStatus('Playing from this device');
            this.removeSaveOfflineButton();
            return;
        }

        const localInfo = await this.getLocalAudioInfo(lectureId);
        if (localInfo) {
            console.log('[AudioSource] Using LOCAL file', { lectureId, filename: localInfo.filename, url: localInfo.url });
            audioEl.src = localInfo.url;
            audioEl.dataset.source = 'local';
            audioEl.dataset.localFilename = localInfo.filename || '';
            this.renderOfflineStatus('Playing from this device');
            return;
        }

        // Use network source and add an action to save for offline
        audioEl.src = networkUrl;
        audioEl.dataset.source = 'network';
        audioEl.dataset.networkUrl = networkUrl;
        console.log('[AudioSource] Using NETWORK url', { lectureId, url: networkUrl });
        this.renderSaveOfflineButton(async () => {
            try {
                // Try IndexedDB first
                const ok = await this.saveAudioToIdb(lectureId, networkUrl);
                if (ok) {
                    console.log('[AudioSource] Saved to IndexedDB', { lectureId });
                    this.renderOfflineStatus('Saved for offline listening');
                    this.removeSaveOfflineButton();
                    return;
                }
                // Fallback: Cache Storage
                const saved = await this.saveAudioToCache(networkUrl);
                if (saved) {
                    console.log('[AudioSource] Saved to Cache Storage', { lectureId, key: networkUrl });
                    this.renderOfflineStatus('Saved for offline listening');
                    this.removeSaveOfflineButton();
                    return;
                }
            } catch (err) {
                console.error('Save offline failed:', err);
                if (window.toast && window.toast.error) window.toast.error('Failed to save for offline: ' + err.message);
            }
        });
    }

    renderSaveOfflineButton(onClick) {
        const audioSection = document.querySelector('.audio-section');
        if (!audioSection) return;
        let btn = audioSection.querySelector('#saveOfflineBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'saveOfflineBtn';
            btn.textContent = 'Make available offline';
            btn.style.marginLeft = '10px';
            btn.className = 'btn btn-sm btn-outline-secondary';
            const h2 = audioSection.querySelector('h2');
            if (h2) {
                const wrap = document.createElement('span');
                wrap.style.marginLeft = '10px';
                wrap.appendChild(btn);
                h2.appendChild(wrap);
            } else {
                audioSection.appendChild(btn);
            }
        }
        btn.onclick = onClick;
    }

    removeSaveOfflineButton() {
        const audioSection = document.querySelector('.audio-section');
        if (!audioSection) return;
        const btn = audioSection.querySelector('#saveOfflineBtn');
        if (btn && btn.parentElement) btn.remove();
    }

    renderPlayLocalButton(onClick) {
        const audioSection = document.querySelector('.audio-section');
        if (!audioSection) return;
        let btn = audioSection.querySelector('#playLocalBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'playLocalBtn';
            btn.textContent = 'Play from my device';
            btn.style.marginLeft = '10px';
            btn.className = 'btn btn-sm btn-outline-primary';
            const h2 = audioSection.querySelector('h2');
            if (h2) {
                const wrap = document.createElement('span');
                wrap.style.marginLeft = '10px';
                wrap.appendChild(btn);
                h2.appendChild(wrap);
            } else {
                audioSection.appendChild(btn);
            }
        }
        btn.onclick = onClick;
    }

    renderGrantAccessButton(onClick) {
        const audioSection = document.querySelector('.audio-section');
        if (!audioSection) return;
        let btn = audioSection.querySelector('#grantAccessBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'grantAccessBtn';
            btn.textContent = 'Grant folder access';
            btn.style.marginLeft = '10px';
            btn.className = 'btn btn-sm btn-outline-dark';
            const h2 = audioSection.querySelector('h2');
            if (h2) {
                const wrap = document.createElement('span');
                wrap.style.marginLeft = '10px';
                wrap.appendChild(btn);
                h2.appendChild(wrap);
            } else {
                audioSection.appendChild(btn);
            }
        }
        btn.onclick = onClick;
    }

    async tryPlayFromLocalIfAvailable(audioEl) {
        const info = await this.getLocalAudioInfo(this.lectureId);
        if (info) {
            audioEl.src = info.url;
            audioEl.dataset.source = 'local';
            audioEl.dataset.localFilename = info.filename;
            this.renderOfflineStatus('Playing from your device');
            console.log('[AudioSource] Using LOCAL file (after access granted)', { lectureId: this.lectureId, filename: info.filename, url: info.url });
            return true;
        }
        return false;
    }

    renderOfflineStatus(text) {
        const audioSection = document.querySelector('.audio-section');
        if (!audioSection) return;
        let badge = audioSection.querySelector('#offlineStatus');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'offlineStatus';
            badge.className = 'badge bg-secondary';
            badge.style.marginLeft = '10px';
            const h2 = audioSection.querySelector('h2');
            if (h2) h2.appendChild(badge);
            else audioSection.appendChild(badge);
        }
        badge.textContent = text;
        // Auto hide status after a short delay to keep UI clean
        setTimeout(() => { if (badge && badge.parentElement) badge.remove(); }, 4000);
    }

    async getLocalAudioBlobUrl(lectureId) {
        const info = await this.getLocalAudioInfo(lectureId);
        return info ? info.url : null;
    }

    async getLocalAudioInfo(lectureId) {
        // Return { url, filename } if a local file is available and permitted
        const handle = await this.idbGet('handles', 'studentAudioDir');
        const mapping = await this.idbGet('files', lectureId);
        if (!handle || !mapping || !mapping.filename) return null;
        // Avoid requestPermission here (requires user gesture). Only proceed if already granted.
        const permQuery = await handle.queryPermission?.({ mode: 'read' });
        if (permQuery && permQuery !== 'granted') return null;
        try {
            const fileHandle = await handle.getFileHandle(mapping.filename, { create: false });
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);
            return { url, filename: mapping.filename };
        } catch (e) {
            return null;
        }
    }

    // ===== Cache Storage helpers =====
    async idbGetAudioBlobUrl(lectureId) {
        try {
            const db = await this.openStudentDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('files', 'readonly');
                const st = tx.objectStore('files');
                const rq = st.get('blob:' + lectureId);
                rq.onsuccess = () => {
                    const val = rq.result;
                    if (!val || !(val instanceof Blob)) return resolve(null);
                    resolve(URL.createObjectURL(val));
                };
                rq.onerror = () => reject(rq.error);
            });
        } catch (_) {
            return null;
        }
    }

    async saveAudioToIdb(lectureId, networkUrl) {
        try {
            const resp = await fetch(networkUrl, { cache: 'no-store' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            const db = await this.openStudentDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('files', 'readwrite');
                const st = tx.objectStore('files');
                const rq = st.put(blob, 'blob:' + lectureId);
                rq.onsuccess = () => resolve();
                rq.onerror = () => reject(rq.error);
            });
            return true;
        } catch (e) {
            console.warn('IDB save failed:', e);
            return false;
        }
    }
    async getCachedAudioBlobUrl(networkUrl) {
        try {
            if (!('caches' in window) || !networkUrl) return null;
            const cache = await caches.open('scribe-audio-v1');
            const res = await cache.match(networkUrl);
            if (!res) return null;
            const blob = await res.blob();
            return URL.createObjectURL(blob);
        } catch (_) {
            return null;
        }
    }

    async saveAudioToCache(networkUrl) {
        try {
            if (!('caches' in window) || !networkUrl) return false;
            const resp = await fetch(networkUrl, { cache: 'no-store' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const cache = await caches.open('scribe-audio-v1');
            await cache.put(networkUrl, resp.clone());
            if (navigator.storage && navigator.storage.persist) {
                try { await navigator.storage.persist(); } catch (_) {}
            }
            return true;
        } catch (e) {
            console.warn('Cache save failed:', e);
            return false;
        }
    }

    async ensureStudentAudioDirHandle() {
        // Open or pick the directory to store student audio
        let handle = await this.idbGet('handles', 'studentAudioDir');
        if (!handle) {
            if (!('showDirectoryPicker' in window)) {
                if (window.toast && window.toast.warn) window.toast.warn('Your browser does not support saving offline audio.');
                return null;
            }
            const picked = await window.showDirectoryPicker();
            await this.idbSet('handles', 'studentAudioDir', picked);
            handle = picked;
        }
        // Request permission only within user gesture (button click invokes this method)
        const permQuery = await handle.queryPermission?.({ mode: 'readwrite' });
        if (permQuery !== 'granted') {
            const perm = await handle.requestPermission?.({ mode: 'readwrite' });
            if (perm && perm !== 'granted') return null;
        }
        return handle;
    }

    async writeFileToDir(dirHandle, fileName, blob) {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    // ===== Minimal IndexedDB helpers (shared within this file) =====
    openStudentDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('scribe-student-audio', 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
                if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async idbGet(store, key) {
        const db = await this.openStudentDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readonly');
            const st = tx.objectStore(store);
            const rq = st.get(key);
            rq.onsuccess = () => resolve(rq.result);
            rq.onerror = () => reject(rq.error);
        });
    }

    async idbSet(store, key, value) {
        const db = await this.openStudentDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, 'readwrite');
            const st = tx.objectStore(store);
            const rq = st.put(value, key);
            rq.onsuccess = () => resolve();
            rq.onerror = () => reject(rq.error);
        });
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

    async fetchFinalizedContent() {
        try {
            const res = await fetch(`/api/recordings/${this.lectureId}/finalized`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                this.finalized = data.finalized;
            }
        } catch (e) {
            console.error('Failed to fetch finalized content:', e);
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

        // Handle summarization (student view: load teacher-finalized)
        if (preferences.summarization) {
            if (this.finalized && this.finalized.summary) {
                this.updateSummaryContent(this.finalized.summary);
                document.querySelector('.summary-section').style.display = 'block';
            } else {
                document.querySelector('.summary-section').style.display = 'block';
                document.querySelector('.summary-title').textContent = 'Summary (Awaiting Teacher Finalization)';
                document.getElementById('mainThesis').textContent = '';
                document.getElementById('context').textContent = '';
                document.getElementById('significance').textContent = '';
                document.getElementById('keyPoints').innerHTML = '<p>No summary published by teacher yet.</p>';
                document.getElementById('applications').innerHTML = '';
            }
        }

        // Handle flashcards if selected
        if (preferences.flashcards) {
            await this.handleFlashcards();
        }

        // Handle visual learning (student view: load teacher-finalized)
        if (preferences.visual) {
            if (this.finalized && Array.isArray(this.finalized.visualSections) && this.finalized.visualSections.length) {
                await this.updateVisualLearningFromFinalized(this.finalized.visualSections);
                this.showToastNotification('Visual learning loaded');
            } else {
                const section = document.getElementById('visual-learning-section') || document.querySelector('.visual-learning-section');
                if (section) {
                    section.style.display = 'block';
                    section.innerHTML = '<h2>Visual Learning</h2><p class="error">No teacher-published visual content yet.</p>';
                }
            }
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
        document.querySelector('.summary-title').textContent = summary.title || 'Lecture Summary';
        document.getElementById('mainThesis').textContent = summary.overview?.mainThesis || '';
        document.getElementById('context').textContent = summary.overview?.context || '';
        document.getElementById('significance').textContent = summary.overview?.significance || '';

        // Update key points
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

        // Update practical applications
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

    // Lightbox for student visual learning
    openImageLightbox(src, alt) {
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
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        imgWrap.appendChild(img);
        imgWrap.appendChild(closeBtn);
        overlay.appendChild(imgWrap);
        document.body.appendChild(overlay);
    }

    // Render finalized visual content from teacher without scraping
    async updateVisualLearningFromFinalized(sections) {
        const visualLearningSection = document.getElementById('visual-learning-section') || document.querySelector('.visual-learning-section');
        if (!visualLearningSection) return;
        visualLearningSection.innerHTML = '<h2>Visual Learning</h2>';
        visualLearningSection.style.display = 'block';
        if (!sections.length) {
            visualLearningSection.innerHTML += '<p class="no-results">No visual learning items available.</p>';
            return;
        }
        const slideContainer = document.createElement('div');
        slideContainer.className = 'visual-slideshow-container';
        for (const section of sections) {
            const slide = document.createElement('div');
            slide.className = 'visual-slide';
            slide.innerHTML = `
                <div class="visual-slide-content">
                    <div class="visual-slide-image" style="position:relative;">
                        <img src="${section.imageUrl || ''}" alt="${section.term || ''}" onerror="this.style.display='none'">
                        <button class="zoom-image-btn" data-src="${section.imageUrl || ''}" data-alt="${section.term || ''}"
                            style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;" title="Expand">
                            <i class="bi bi-arrows-fullscreen"></i>
                        </button>
                    </div>
                    <div class="visual-slide-text">
                        <h3>${section.term || ''}</h3>
                        <p>${section.explanation || ''}</p>
                    </div>
                </div>
            `;
            slideContainer.appendChild(slide);
        }
        if (slideContainer.children.length === 0) {
            visualLearningSection.innerHTML += '<p class="no-results">No visual learning items available.</p>';
            return;
        }
        slideContainer.querySelector('.visual-slide').style.display = 'block';
        const navigation = document.createElement('div');
        navigation.className = 'visual-slide-navigation';
        navigation.innerHTML = `
            <button class="slide-btn prev-slide" disabled><i class="bi bi-chevron-left"></i> Previous</button>
            <span class="slide-counter">1/${slideContainer.children.length}</span>
            <button class="slide-btn next-slide" ${slideContainer.children.length > 1 ? '' : 'disabled'}>Next <i class="bi bi-chevron-right"></i></button>
        `;
        visualLearningSection.appendChild(slideContainer);
        visualLearningSection.appendChild(navigation);
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
            const lectureTitle = document.getElementById('lectureTitle').textContent;
            console.log('Lecture Title:', lectureTitle);
            const response = await fetch('/api/search-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `educational concept illustration about ${term} in the context of ${lectureTitle}`,
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
                    body: JSON.stringify({ query: `${term} in the context of ${lectureTitle}` }),
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
        // Render inside existing placeholder section to preserve position
        let quizSection = document.getElementById('kinesthetic-section') || document.querySelector('.kinesthetic-section');
        if (!quizSection) {
            quizSection = document.createElement('section');
            quizSection.className = 'kinesthetic-section';
            quizSection.id = 'kinesthetic-section';
            const contentGrid = document.querySelector('.content-grid');
            contentGrid.appendChild(quizSection);
        }

        // Apply styles
        quizSection.style.backgroundColor = '#e0ebe6';
        quizSection.style.padding = '1.5rem';
        quizSection.style.borderRadius = '0.8rem';
        quizSection.style.display = 'block';

        // Initial HTML with quiz mode selection
        quizSection.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <h2>Interactive Quizzes</h2>
                <button class="regen-quiz btn btn-sm btn-outline-secondary" type="button" title="Regenerate quizzes">
                    <i class="bi bi-arrow-clockwise"></i> Regenerate
                </button>
            </div>
            <div class="mode-selector">
                <button class="mode-btn active" data-mode="categorization" style="background-color: #7e9ebf; color: white;">Drag & Drop Quiz</button>
                <button class="mode-btn" data-mode="multipleChoice" style="background-color: #7e9ebf; color: white;">Multiple Choice Quiz</button>
            </div>
            <div class="quiz-container">
                <div class="categorization-mode active" id="categorizationQuiz"></div>
                <div class="multiple-choice-mode" id="multipleChoiceQuiz"></div>
            </div>
        `;

        // Create both quiz types
        this.createCategorizationQuiz(quizContent.categorization, document.getElementById('categorizationQuiz'));
        this.createMultipleChoiceQuiz(quizContent.multipleChoice, document.getElementById('multipleChoiceQuiz'));

        // Regenerate quizzes
        const regenQuizBtn = quizSection.querySelector('.regen-quiz');
        if (regenQuizBtn) {
            regenQuizBtn.addEventListener('click', async () => {
                await this.handleKinestheticLearning();
            });
        }

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
        const itemsPool = document.querySelector('.items-pool');

        // Set up draggable items (desktop)
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

        // Set up drop zones (desktop)
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
                if (container.textContent.trim() === 'Drop items here') {
                    container.innerHTML = '';
                }
                container.appendChild(item);
                container.classList.remove('drag-over');
            });
        });
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
                item.classList.remove('correct', 'incorrect');
            });
        }

        // --- Mobile Touch Support ---
        let touchDragItem = null;
        let touchDragClone = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let lastTouchTarget = null;

        function getDropTarget(touch) {
            // Check all drop zones under the touch point
            const x = touch.clientX;
            const y = touch.clientY;
            // Try categories first
            for (const container of categoryContainers) {
                const rect = container.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return container;
                }
            }
            // Then pool
            if (itemsPool) {
                const rect = itemsPool.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return itemsPool;
                }
            }
            return null;
        }

        items.forEach(item => {
            // Touch start
            item.addEventListener('touchstart', function(e) {
                if (e.touches.length > 1) return; // Ignore multi-touch
                touchDragItem = item;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                // Create a visual clone
                touchDragClone = item.cloneNode(true);
                touchDragClone.style.position = 'fixed';
                touchDragClone.style.left = touchStartX + 'px';
                touchDragClone.style.top = touchStartY + 'px';
                touchDragClone.style.width = item.offsetWidth + 'px';
                touchDragClone.style.pointerEvents = 'none';
                touchDragClone.style.opacity = '0.8';
                touchDragClone.style.zIndex = '9999';
                touchDragClone.classList.add('dragging');
                document.body.appendChild(touchDragClone);
                item.classList.add('dragging');
                lastTouchTarget = null;
                e.preventDefault();
            }, { passive: false });

            // Touch move
            item.addEventListener('touchmove', function(e) {
                if (!touchDragClone || !touchDragItem) return;
                const touch = e.touches[0];
                touchDragClone.style.left = (touch.clientX - touchDragClone.offsetWidth / 2) + 'px';
                touchDragClone.style.top = (touch.clientY - touchDragClone.offsetHeight / 2) + 'px';
                // Highlight drop zone under finger
                const target = getDropTarget(touch);
                if (lastTouchTarget && lastTouchTarget !== target) {
                    lastTouchTarget.classList.remove('drag-over');
                }
                if (target) {
                    target.classList.add('drag-over');
                }
                lastTouchTarget = target;
                e.preventDefault();
            }, { passive: false });

            // Touch end
            item.addEventListener('touchend', function(e) {
                if (!touchDragClone || !touchDragItem) return;
                const touch = e.changedTouches[0];
                const dropTarget = getDropTarget(touch);
                // Remove visual clone
                document.body.removeChild(touchDragClone);
                touchDragClone = null;
                // Remove highlight
                if (lastTouchTarget) lastTouchTarget.classList.remove('drag-over');
                // Move item to drop zone
                if (dropTarget) {
                    if (dropTarget.classList.contains('category-items')) {
                        if (dropTarget.textContent.trim() === 'Drop items here') {
                            dropTarget.innerHTML = '';
                        }
                        dropTarget.appendChild(touchDragItem);
                    } else if (dropTarget === itemsPool) {
                        itemsPool.appendChild(touchDragItem);
                        touchDragItem.classList.remove('correct', 'incorrect');
                    }
                }
                touchDragItem.classList.remove('dragging');
                touchDragItem = null;
                lastTouchTarget = null;
                e.preventDefault();
            }, { passive: false });
        });
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
        // Use existing flashcards section placeholder to preserve position
        let section = document.getElementById('flashcards-section') || document.querySelector('.flashcards-section');
        if (!section) {
            section = document.createElement('section');
            section.className = 'flashcards-section';
            section.id = 'flashcards-section';
            const contentGrid = document.querySelector('.content-grid');
            contentGrid.appendChild(section);
        }
        section.style.display = 'block';

        section.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <h2>Study Flashcards</h2>
                <button class="regen-flashcards btn btn-sm btn-outline-secondary" type="button" title="Regenerate flashcards">
                    <i class="bi bi-arrow-clockwise"></i> Regenerate
                </button>
            </div>
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

        // Initialize flashcards functionality
        this.initializeFlashcards();

        // Regenerate flashcards
        const regenBtn = section.querySelector('.regen-flashcards');
        if (regenBtn) {
            regenBtn.addEventListener('click', async () => {
                await this.handleFlashcards();
            });
        }
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

