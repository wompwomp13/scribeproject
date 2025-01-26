document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const micButton = document.getElementById('micButton');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const startRecordingBtn = document.getElementById('startRecordingBtn');
    const classSelect = document.getElementById('classSelect');
    const courseManager = new CourseManager();

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

    // Load courses only once through the CourseManager
    async function initializeCourses() {
        try {
            const response = await fetch('/api/courses?instructor=current');
            const data = await response.json();
            
            if (data.success) {
                // Get recordings count for each course
                const coursesWithRecordings = await Promise.all(data.courses.map(async course => {
                    const recordingsResponse = await fetch(`/api/courses/${course._id}/recordings`);
                    const recordingsData = await recordingsResponse.json();
                    return {
                        ...course,
                        recordingsCount: recordingsData.success ? recordingsData.recordings.length : 0
                    };
                }));

                // Update course manager with the courses
                courseManager.updateCourses(coursesWithRecordings);

                // Update recording sidebar dropdown
                coursesWithRecordings.forEach(course => {
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

    initializeCourses();
});

function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    
    // Safely format course code and name
    const courseCode = course.code ? course.code.replace(/'/g, '') : '';
    const courseName = course.name || 'Untitled Course';
    const instructorName = course.instructor?.name || course.instructor || 'No Instructor';
    
    card.innerHTML = `
        <div class="course-info">
            <p class="course-code">${courseName} ${courseCode}</p>
            <h3 class="course-description">${course.description || 'No description available'}</h3>
            <div class="course-meta">
                <span class="students">
                    <i class="bi bi-person"></i>
                    ${course.studentCount || 0} students
                </span>
                <span class="recordings">
                    <i class="bi bi-mic"></i>
                    ${course.recordingsCount || 0} lectures
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

class CourseManager {
    constructor() {
        this.searchInput = document.getElementById('courseSearch');
        this.sortSelect = document.getElementById('sortCourses');
        this.coursesGrid = document.querySelector('.courses-grid');
        this.courses = [];

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', () => this.filterCourses());
        this.sortSelect.addEventListener('change', () => this.filterCourses());
    }

    // Call this when courses are loaded
    updateCourses(courses) {
        this.courses = courses;
        this.filterCourses();
    }

    filterCourses() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const sortOption = this.sortSelect.value;

        let filteredCourses = this.courses.filter(course => {
            // Safely handle potentially undefined values
            const courseName = (course.name || '').toLowerCase();
            const courseCode = (course.code || '').toLowerCase();
            const instructorName = (course.instructor && typeof course.instructor === 'string' ? 
                course.instructor : course.instructor?.name || '').toLowerCase();
            const description = (course.description || '').toLowerCase();
            
            return courseName.includes(searchTerm) || 
                   courseCode.includes(searchTerm) || 
                   instructorName.includes(searchTerm) ||
                   description.includes(searchTerm);
        });

        // Sort courses
        filteredCourses.sort((a, b) => {
            switch(sortOption) {
                case 'name-asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'name-desc':
                    return (b.name || '').localeCompare(a.name || '');
                case 'date-new':
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                case 'date-old':
                    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case 'students':
                    return (b.studentCount || 0) - (a.studentCount || 0);
                default:
                    return 0;
            }
        });

        this.renderCourses(filteredCourses);
    }

    renderCourses(courses) {
        this.coursesGrid.innerHTML = '';
        
        if (courses.length === 0) {
            this.coursesGrid.innerHTML = `
                <div class="no-results">
                    <i class="bi bi-search"></i>
                    <p>No courses found</p>
                </div>
            `;
            return;
        }

        courses.forEach(course => {
            // Use your existing course card creation logic here
            const courseCard = this.createCourseCard(course);
            this.coursesGrid.appendChild(courseCard);
        });
    }

    createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        // Safely format course code and name
        const courseCode = course.code ? course.code.replace(/'/g, '') : '';
        const courseName = course.name || 'Untitled Course';
        const instructorName = course.instructor?.name || course.instructor || 'No Instructor';
        
        card.innerHTML = `
            <div class="course-info">
                <p class="course-code">${courseName} ${courseCode}</p>
                <h3 class="course-description">${course.description || 'No description available'}</h3>
                <div class="course-meta">
                    <span class="students">
                        <i class="bi bi-person"></i>
                        ${course.studentCount || 0} students
                    </span>
                    <span class="recordings">
                        <i class="bi bi-mic"></i>
                        ${course.recordingsCount || 0} lectures
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
} 