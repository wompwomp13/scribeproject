class RecordingStudio {
    constructor(courseId, teacherId) {
        this.courseId = courseId;
        this.teacherId = teacherId;
        this.recorder = null;
        this.startTime = null;
        this.setupEventListeners();
        this.loadRecentRecordings();
    }

    setupEventListeners() {
        // Record button
        document.getElementById('recordButton').addEventListener('click', () => {
            if (!this.recorder) {
                this.startRecording();
            }
        });

        // Stop button
        document.getElementById('stopButton').addEventListener('click', () => {
            if (this.recorder) {
                this.stopRecording();
            }
        });
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.recorder = new MediaRecorder(stream);
            this.startTime = Date.now();
            
            const chunks = [];
            this.recorder.ondataavailable = (e) => chunks.push(e.data);
            
            this.recorder.onstop = async () => {
                const duration = Math.round((Date.now() - this.startTime) / 1000);
                const blob = new Blob(chunks, { type: 'audio/mp3' });
                await this.saveRecording(blob, duration);
            };
            
            this.recorder.start();
            this.updateUI('recording');
        } catch (error) {
            console.error('Recording error:', error);
            alert('Could not start recording: ' + error.message);
        }
    }

    async stopRecording() {
        if (this.recorder) {
            this.recorder.stop();
            this.recorder = null;
            this.updateUI('stopped');
        }
    }

    async saveRecording(blob, duration) {
        try {
            const formData = new FormData();
            formData.append('audio', blob);
            formData.append('title', document.getElementById('lectureTitle').value || 'Untitled Lecture');
            formData.append('courseId', this.courseId);
            formData.append('teacherId', this.teacherId);
            formData.append('duration', duration);

            const response = await fetch('/api/recordings', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                this.addRecordingToList(data.recording);
                this.updateUI('saved');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Could not save recording: ' + error.message);
        }
    }

    addRecordingToList(recording) {
        const template = document.getElementById('recording-card-template');
        const card = template.content.cloneNode(true);
        
        // Fill in card details
        card.querySelector('.recording-title').textContent = recording.title;
        card.querySelector('.recording-date').textContent = new Date(recording.createdAt).toLocaleDateString();
        card.querySelector('.recording-duration').textContent = this.formatDuration(recording.duration);
        
        // Add to list
        document.getElementById('recentRecordings').prepend(card);
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    async loadRecentRecordings() {
        try {
            const response = await fetch(`/api/courses/${this.courseId}/recordings`);
            const data = await response.json();
            
            if (data.success) {
                const container = document.getElementById('recentRecordings');
                container.innerHTML = ''; // Clear existing
                
                data.recordings.forEach(recording => {
                    this.addRecordingToList(recording);
                });
            }
        } catch (error) {
            console.error('Load error:', error);
        }
    }

    updateUI(state) {
        const recordButton = document.getElementById('recordButton');
        const stopButton = document.getElementById('stopButton');
        const status = document.getElementById('recordingStatus');
        
        switch (state) {
            case 'recording':
                recordButton.disabled = true;
                stopButton.disabled = false;
                status.textContent = 'Recording...';
                break;
            case 'stopped':
                recordButton.disabled = false;
                stopButton.disabled = true;
                status.textContent = 'Processing...';
                break;
            case 'saved':
                status.textContent = 'Ready';
                break;
        }
    }
} 