document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const micButton = document.getElementById('micButton');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const startRecordingBtn = document.getElementById('startRecordingBtn');
    const classSelect = document.getElementById('classSelect');

    // Handle microphone button click
    const handleMicButtonClick = () => {
        sidebar.classList.add('open');
    };

    // Handle sidebar close
    const handleSidebarClose = () => {
        sidebar.classList.remove('open');
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
        if (!sidebar.contains(e.target) && !micButton.contains(e.target) && sidebar.classList.contains('open')) {
            handleSidebarClose();
        }
    });

    // Load teacher's courses
    loadTeacherCourses();
});

// Add this function to load teacher's courses
async function loadTeacherCourses() {
    try {
        const response = await fetch('/api/courses?instructor=current');
        const data = await response.json();
        
        if (data.success) {
            const coursesContainer = document.querySelector('.courses-grid');
            
            // Add new courses from database
            data.courses.forEach(course => {
                const courseCard = createCourseCard(course);
                coursesContainer.appendChild(courseCard);
                
                // Also add to the class select dropdown in the recording sidebar
                const option = document.createElement('option');
                option.value = course._id;
                option.textContent = course.name;
                classSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.onclick = () => window.location.href = `/courses/${course._id}.html`;
    
    card.innerHTML = `
        <div class="course-info">
            <p class="course-code">${course.code}</p>
            <h3 class="course-description">${course.name}</h3>
            <div class="course-meta">
                <span class="students">
                    <i class="bi bi-person"></i>
                    25 students
                </span>
                <span class="recordings">
                    <i class="bi bi-mic"></i>
                    0 recordings
                </span>
            </div>
        </div>
    `;
    
    return card;
} 