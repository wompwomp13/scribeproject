document.addEventListener('DOMContentLoaded', function() {
    loadCourses();
});

async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        const data = await response.json();

        const coursesGrid = document.querySelector('.courses-grid');
        coursesGrid.innerHTML = ''; // Clear existing content

        // Add the hard-coded Physics 101 card first
        const physicsCard = `
            <div class="course-card">
                <a href="course1.html" style="text-decoration: none; color: inherit; display: block;">
                    <div class="course-info">
                        <p class="course-code">Physics 101</p>
                        <h3>Introduction to Physics</h3>
                        <div class="course-meta">
                            <span class="students">
                                <i class="bi bi-person"></i>
                                30 students
                            </span>
                            <span class="time">
                                <i class="bi bi-clock"></i>
                                1d ago
                            </span>
                        </div>
                    </div>
                </a>
            </div>
        `;
        coursesGrid.innerHTML = physicsCard;

        if (!data.courses || data.courses.length === 0) {
            console.warn('No courses found.');
            return;
        }

        // Load other courses dynamically
        for (const course of data.courses) {
            if (course.code !== 'PHY101') {
                try {
                    const recordingsResponse = await fetch(`/api/courses/${course._id}/recordings`);
                    const recordingsData = await recordingsResponse.json();
                    const recordingsCount = recordingsData.success ? recordingsData.recordings.length : 0;

                    const card = document.createElement('div');
                    card.className = 'course-card';
                    card.setAttribute('data-code', course.code);

                    card.innerHTML = `
                        <div class="course-info">
                            <p class="course-code">${course.name} ${course.code}</p>
                            <h3 class="course-description">${course.description || 'No description available'}</h3>
                            <div class="course-meta">
                                <span class="students">
                                    <i class="bi bi-person"></i>
                                    30 students
                                </span>
                                <span class="recordings">
                                    <i class="bi bi-mic"></i>
                                    ${recordingsCount} lectures
                                </span>
                            </div>
                        </div>
                    `;

                    card.addEventListener('click', () => {
                        window.location.href = `/scourse.html?id=${course._id}`;
                    });

                    coursesGrid.appendChild(card);
                } catch (error) {
                    console.error(`Error loading recordings for course ${course._id}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}
