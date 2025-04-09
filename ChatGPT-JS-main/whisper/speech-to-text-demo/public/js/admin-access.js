// This file provides admin access control for all admin pages

// Add specific admin email - change this to your actual admin email
const ADMIN_EMAIL = "admin@scribe.edu";

// Function to verify the user is an admin
async function checkAdminAccess() {
    try {
        // Get the current user email from localStorage
        const currentUserEmail = localStorage.getItem('currentUserEmail');
        
        // Simple check if this email matches the admin email
        if (!currentUserEmail || currentUserEmail !== ADMIN_EMAIL) {
            // Additional API check to verify role in the database
            try {
                const response = await fetch(`/api/auth/current-user?userEmail=${currentUserEmail}`);
                const data = await response.json();
                
                if (!data.success || data.user.role !== 'admin') {
                    // Not an admin, redirect back to appropriate dashboard
                    redirectToAppropriateScreen(data.user?.role);
                    return false;
                }
                return true;
            } catch (error) {
                console.error('Error verifying admin role:', error);
                redirectToLogin();
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Error checking admin access:', error);
        redirectToLogin();
        return false;
    }
}

function redirectToAppropriateScreen(role) {
    if (role === 'teacher') {
        window.location.href = 'dashboard.html';
    } else if (role === 'student') {
        window.location.href = 'studentdashboard.html';
    } else {
        redirectToLogin();
    }
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

// Run this check when the script loads
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
}); 