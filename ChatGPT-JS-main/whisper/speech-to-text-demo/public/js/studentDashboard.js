document.addEventListener('DOMContentLoaded', function() {
    loadCourses();
});

async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        const data = await response.json();

        const coursesGrid = document.querySelector('.courses-grid');

        // Keep the existing Physics 101 card
        const existingPhysics = coursesGrid.querySelector('.course-card[data-code="PHY101"]');
        coursesGrid.innerHTML = '';
        if (existingPhysics) {
            coursesGrid.appendChild(existingPhysics);
        }

        if (!data.courses || data.courses.length === 0) {
            console.warn('No courses found.');
            return;
        }

        // Load courses dynamically
        for (const course of data.courses) {
            if (course.code !== 'PHY101') {
                try {
                    // Fetch the recording count for the current course
                    const recordingsResponse = await fetch(`/api/courses/${course._id}/recordings`);
                    const recordingsData = await recordingsResponse.json();

                    // Set recording count or default to 0 if unavailable
                    const recordingsCount = recordingsData.success ? recordingsData.recordings.length : 0;

                    // Create the course card
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

                    // Add click event to navigate to the course page
                    card.addEventListener('click', () => {
                        window.location.href = `/scourse.html?id=${course._id}`;
                    });

                    // Append the card to the courses grid
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
