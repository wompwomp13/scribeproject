document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
});

async function loadDashboardStats() {
    try {
        // Fetch courses count
        const coursesResponse = await fetch('/api/courses');
        const coursesData = await coursesResponse.json();
        if (coursesData.success) {
            const activeCourses = coursesData.courses.filter(course => course.status === 'active');
            document.getElementById('courseCount').textContent = activeCourses.length;
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