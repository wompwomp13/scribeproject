class CourseManager {
    constructor() {
        this.searchInput = document.getElementById('courseSearch');
        this.sortSelect = document.getElementById('sortCourses');
        this.coursesGrid = document.querySelector('.courses-grid');
        this.courses = [];

        this.setupEventListeners();
        this.loadCourses();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', () => this.filterCourses());
        this.sortSelect.addEventListener('change', () => this.filterCourses());
    }

    async loadCourses() {
        try {
            const response = await fetch('/api/courses');
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

                this.courses = coursesWithRecordings;
                this.filterCourses();
            }
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    filterCourses() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const sortOption = this.sortSelect.value;

        let filteredCourses = this.courses.filter(course => {
            const courseName = (course.name || '').toLowerCase();
            const courseCode = (course.code || '').toLowerCase();
            const description = (course.description || '').toLowerCase();
            
            return courseName.includes(searchTerm) || 
                   courseCode.includes(searchTerm) || 
                   description.includes(searchTerm);
        });

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
                default:
                    return 0;
            }
        });

        this.renderCourses(filteredCourses);
    }

    renderCourses(courses) {
        this.coursesGrid.innerHTML = '';
        
        if (courses.length === 0) {
            this.coursesGrid.innerHTML += `
                <div class="no-results">
                    <i class="bi bi-search"></i>
                    <p>No courses found</p>
                </div>
            `;
            return;
        }

        courses.forEach(course => {
            const courseCard = this.createCourseCard(course);
            this.coursesGrid.appendChild(courseCard);
        });
    }

    createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        
        const courseCode = course.code ? course.code.replace(/'/g, '') : '';
        const courseName = course.name || 'Untitled Course';
        
        card.innerHTML = `
            <a href="/scourse.html?id=${course._id}" style="text-decoration: none; color: inherit; display: block;">
                <div class="course-info">
                    <p class="course-code">${courseName} ${courseCode}</p>
                    <h3>${course.description || 'No description available'}</h3>
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
            </a>
        `;

        return card;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CourseManager();
});
