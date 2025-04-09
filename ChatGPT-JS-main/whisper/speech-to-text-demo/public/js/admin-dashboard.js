document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is admin, otherwise redirect
    checkAdminAccess();
    
    // Load dashboard data
    loadDashboardStats();
    
    // Listen for course changes
    window.addEventListener('courseChanged', () => {
        loadDashboardStats();
    });

    // Listen for course updates
    window.addEventListener('coursesUpdated', (event) => {
        updateCourseStats(event.detail.courses);
    });
});

// Function to verify the user is an admin
async function checkAdminAccess() {
    try {
        // Get the current user email from localStorage or cookie
        const currentUserEmail = localStorage.getItem('currentUserEmail');
        if (!currentUserEmail) {
            // No user is logged in, redirect to login
            window.location.href = 'login.html';
            return;
        }
        
        // Make a request to get the current user info
        const response = await fetch(`/api/auth/current-user?userEmail=${currentUserEmail}`);
        const data = await response.json();
        
        if (!data.success || data.user.role !== 'admin') {
            // User is not an admin, redirect to appropriate dashboard
            if (data.user.role === 'teacher') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'studentdashboard.html';
            }
        }
    } catch (error) {
        console.error('Error verifying admin access:', error);
        window.location.href = 'login.html';
    }
}

async function loadDashboardStats() {
    try {
        // Fetch courses count
        const coursesResponse = await fetch('/api/courses');
        const coursesData = await coursesResponse.json();
        if (coursesData.success) {
            updateCourseStats(coursesData.courses);
        }

        // Fetch users count
        const usersResponse = await fetch('/api/users');
        const usersData = await usersResponse.json();
        if (usersData.success) {
            const totalUsers = usersData.users.length;
            document.getElementById('userCount').textContent = totalUsers;

            // Count active users (users who logged in today)
            const today = new Date().toISOString().split('T')[0];
            const activeUsers = usersData.users.filter(user => {
                return user.lastLoginDate && user.lastLoginDate.startsWith(today);
            });
            document.getElementById('activeUsers').textContent = activeUsers.length;
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function updateCourseStats(courses) {
    // Count all courses that are either explicitly active or don't have a status (default to active)
    const activeCourses = courses.filter(course => 
        !course.status || course.status === 'active'
    );
    
    // Update the course count in the dashboard
    const courseCountElement = document.getElementById('courseCount');
    if (courseCountElement) {
        courseCountElement.textContent = activeCourses.length;
    }
    
    // Update recent courses list if the container exists
    updateRecentCourses(courses.slice(0, 5)); // Show 5 most recent courses
}

function updateRecentCourses(recentCourses) {
    const recentCoursesContainer = document.querySelector('.recent-courses');
    if (!recentCoursesContainer) return;

    recentCoursesContainer.innerHTML = recentCourses.map(course => {
        const instructorName = course.instructor && course.instructor.name 
            ? course.instructor.name 
            : 'No Instructor';
            
        return `
            <div class="recent-course-item">
                <div class="course-name">${course.name || 'Untitled Course'}</div>
                <div class="course-code">${course.code || 'No Code'}</div>
                <div class="instructor-name">${instructorName}</div>
                <div class="course-status ${course.status || 'active'}">${course.status || 'active'}</div>
            </div>
        `;
    }).join('');
} 