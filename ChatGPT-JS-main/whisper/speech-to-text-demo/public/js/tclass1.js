class TeacherClass {
    constructor() {
        this.loadLectures();
        this.setupRecordingButton();
    }

    async loadLectures() {
        try {
            const response = await fetch('/api/recordings');
            const data = await response.json();
            
            if (data.success && data.recordings) {
                this.renderLectures(data.recordings);
                this.updateLectureCount(data.recordings.length);
            }
        } catch (error) {
            console.error('Error loading lectures:', error);
        }
    }

    renderLectures(lectures) {
        const container = document.querySelector('.lecture-list');
        container.innerHTML = ''; // Clear existing

        lectures.forEach(lecture => {
            const card = this.createLectureCard(lecture);
            container.appendChild(card);
        });
    }

    createLectureCard(lecture) {
        const date = new Date(lecture.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const card = document.createElement('div');
        card.className = 'lecture-card';
        card.innerHTML = `
            <div class="lecture-content">
                <div class="lecture-info">
                    <h3>${lecture.title}</h3>
                    <div class="lecture-meta">
                        <span class="date">
                            <i class="bi bi-calendar"></i>
                            ${date}
                        </span>
                    </div>
                </div>
                <div class="lecture-actions">
                    <a href="/teacher-lecture-notes.html?id=${lecture._id}" class="view-lecture">
                        View Notes
                    </a>
                    <button class="delete-lecture" data-id="${lecture._id}">
                        <i class="bi bi-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;

        // Add delete event listener
        const deleteBtn = card.querySelector('.delete-lecture');
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await (window.confirmDialog ? window.confirmDialog({
                title: 'Delete Lecture',
                message: 'Are you sure you want to delete this lecture? This action cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel'
            }) : Promise.resolve(confirm('Are you sure you want to delete this lecture? This action cannot be undone.')));
            if (ok) {
                try {
                    const lectureId = deleteBtn.getAttribute('data-id');
                    const response = await fetch(`/api/recordings/${lectureId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        if (window.toast?.success) window.toast.success('Lecture deleted');
                        // Attempt to delete local copy if present (optional)
                        try {
                            await this.tryDeleteLocalCopy(lectureId);
                        } catch (e) {
                            console.warn('Local delete skipped/failed:', e);
                        }
                        card.remove(); // Remove the card from the UI
                        const remainingLectures = document.querySelectorAll('.lecture-card').length;
                        this.updateLectureCount(remainingLectures);
                    } else {
                        throw new Error(data.error || 'Failed to delete lecture');
                    }
                } catch (error) {
                    console.error('Error deleting lecture:', error);
                    if (window.toast?.error) window.toast.error('Failed to delete lecture. Please try again.'); else alert('Failed to delete lecture. Please try again.');
                }
            }
        });

        return card;
    }

    // ===== Optional Local Delete Sync (Teacher's laptop) =====
    async tryDeleteLocalCopy(recordingId) {
        if (!('showDirectoryPicker' in window)) return; // not supported
        // Reuse IndexedDB from app.js namespace
        const DB_NAME = 'scribe-sync';
        const DB_VERSION = 1;
        const STORE_HANDLES = 'handles';
        const STORE_FILES = 'files';

        function openDb() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = function() {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES);
                    if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES);
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        function idbGet(db, storeName, key) {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        function idbSet(db, storeName, key, value) {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }

        function idbDelete(db, storeName, key) {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }

        const db = await openDb();
        let dirHandle = await idbGet(db, STORE_HANDLES, 'syncDir');

        // If no handle saved yet, prompt the teacher to pick the folder used for local sync
        if (!dirHandle) {
            const shouldLink = await (window.confirmDialog ? window.confirmDialog({
                title: 'Link Local Folder',
                message: 'To remove the local copy, link the folder where lectures were saved.',
                confirmText: 'Link Folder',
                cancelText: 'Skip'
            }) : Promise.resolve(confirm('Link the folder where lectures were saved to remove the local copy?')));
            if (!shouldLink) return;
            dirHandle = await window.showDirectoryPicker();
            await idbSet(db, STORE_HANDLES, 'syncDir', dirHandle);
        }

        // Check permission
        const perm = await dirHandle.requestPermission?.({ mode: 'readwrite' });
        if (perm && perm !== 'granted') return;

        // Try to find filename from mapping, otherwise derive from server record
        let mapping = await idbGet(db, STORE_FILES, recordingId);
        let filename = mapping && mapping.filename;
        if (!filename) {
            try {
                const resp = await fetch(`/api/recordings/${recordingId}`);
                if (resp.ok) {
                    const recData = await resp.json();
                    filename = recData?.recording?.audioFile?.filename || null;
                }
            } catch (e) {}
        }
        if (!filename) return; // nothing to delete locally

        try {
            await dirHandle.removeEntry(filename);
        } catch (e) {
            // If file doesn't exist, ignore
        }

        // Clear mapping if present
        try { await idbDelete(db, STORE_FILES, recordingId); } catch (e) {}
    }

    updateLectureCount(count) {
        const countElement = document.querySelector('.lecture-count');
        if (countElement) {
            countElement.textContent = `${count} lecture${count !== 1 ? 's' : ''} this week`;
        }
    }

    setupRecordingButton() {
        const recordingCircle = document.querySelector('.recording-circle');
        const startRecordingBtn = document.querySelector('.start-recording-btn');

        recordingCircle.addEventListener('click', () => this.startRecording());
        startRecordingBtn.addEventListener('click', () => this.startRecording());
    }

    startRecording() {
        window.location.href = '/index.html';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TeacherClass();
}); 