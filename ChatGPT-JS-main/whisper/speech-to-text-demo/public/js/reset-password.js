document.addEventListener('DOMContentLoaded', () => {
    // Check if we have an email in sessionStorage
    const email = sessionStorage.getItem('resetEmail');
    if (!email) {
        // If no email is found, redirect to forgot-password page
        window.location.href = 'forgot-password.html';
        return;
    }

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    resetPasswordForm.addEventListener('submit', handleResetPassword);
    
    // Initialize toast
    window.notificationToast = new bootstrap.Toast(document.getElementById('notificationToast'));
});

// Helper function to show toast notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Clear previous classes
    toast.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info');
    
    // Add the appropriate toast color class
    toast.classList.add(`toast-${type}`);
    
    // Set icon based on type
    const iconElement = toast.querySelector('.bi');
    iconElement.className = 'bi';
    
    switch (type) {
        case 'success': iconElement.classList.add('bi-check-circle'); break;
        case 'error': iconElement.classList.add('bi-exclamation-circle'); break;
        case 'warning': iconElement.classList.add('bi-exclamation-triangle'); break;
        case 'info': iconElement.classList.add('bi-info-circle'); break;
    }
    
    // Set message text
    toastMessage.textContent = message;
    
    // Show the toast
    window.notificationToast.show();
}

const handleResetPassword = async (event) => {
    event.preventDefault();

    const email = sessionStorage.getItem('resetEmail');
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate passwords match
    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Clear the email from session storage
            sessionStorage.removeItem('resetEmail');
            
            // Show success message with toast
            showToast('Password has been reset successfully!', 'success');
            
            // Redirect to login page after brief delay to show toast
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showToast(data.message || 'Failed to reset password. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        alert('Failed to reset password. Please try again.');
    }
}; 