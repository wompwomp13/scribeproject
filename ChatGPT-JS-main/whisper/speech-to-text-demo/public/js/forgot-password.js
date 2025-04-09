document.addEventListener('DOMContentLoaded', () => {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    
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

const handleForgotPassword = async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;

    try {
        const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            // Store email in session storage for the reset page
            sessionStorage.setItem('resetEmail', email);
            
            // Show success message
            showToast('Email verified. Redirecting to reset password page...', 'success');
            
            // Redirect to reset password page after a brief delay
            setTimeout(() => {
                window.location.href = 'reset-password.html';
            }, 1500);
        } else {
            showToast(data.message || 'Email not found. Please check and try again.', 'error');
        }
    } catch (error) {
        console.error('Verification error:', error);
        showToast('Failed to verify email. Please try again.', 'error');
    }
}; 