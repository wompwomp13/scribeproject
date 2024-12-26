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
            for (const course of data.courses) {
                // Get recordings count for this course
                const recordingsResponse = await fetch(`/api/courses/${course._id}/recordings`);
                const recordingsData = await recordingsResponse.json();
                course.recordingsCount = recordingsData.success ? recordingsData.recordings.length : 0;
                
                const courseCard = createCourseCard(course);
                coursesContainer.appendChild(courseCard);
                
                // Also add to the class select dropdown in the recording sidebar
                const option = document.createElement('option');
                option.value = course._id;
                option.textContent = course.name;
                classSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    
    // Format course code and name
    const courseCode = course.code ? course.code.replace(/'/g, '') : '';
    const courseName = course.name || 'Untitled Course';
    
    card.innerHTML = `
        <div class="course-info">
            <p class="course-code">${courseName} ${courseCode}</p>
            <h3 class="course-description">${course.description || 'No description available'}</h3>
            <div class="course-meta">
                <span class="students">
                    <i class="bi bi-person"></i>
                    30 students
                </span>
                <span class="recordings">
                    <i class="bi bi-mic"></i>
                    ${course.recordingsCount} lectures
                </span>
            </div>
        </div>
    `;

    // Add click event to navigate to course page
    card.addEventListener('click', () => {
        const courseUrl = course.code === 'PHY101' 
            ? '/tclass1.html' 
            : `/tcourse/${course._id}`;
        window.location.href = courseUrl;
    });

    return card;
} 