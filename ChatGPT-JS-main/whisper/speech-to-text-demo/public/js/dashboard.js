document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const micButton = document.getElementById('micButton');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const startRecordingBtn = document.getElementById('startRecordingBtn');
    const classSelect = document.getElementById('classSelect');

    // Handle microphone button click
    const handleMicButtonClick = () => {
        sidebar.classList.add('active');
    };

    // Handle sidebar close
    const handleSidebarClose = () => {
        sidebar.classList.remove('active');
    };

    // Handle recording start
    const handleStartRecording = () => {
        const selectedClass = classSelect.value;
        if (!selectedClass) {
            alert('Please select a class before starting the recording');
            return;
        }
        
        // Redirect to index.html
        window.location.href = 'index.html';
    };

    // Event listeners
    micButton.addEventListener('click', handleMicButtonClick);
    closeSidebarBtn.addEventListener('click', handleSidebarClose);
    startRecordingBtn.addEventListener('click', handleStartRecording);

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !micButton.contains(e.target) && sidebar.classList.contains('active')) {
            handleSidebarClose();
        }
    });
}); 