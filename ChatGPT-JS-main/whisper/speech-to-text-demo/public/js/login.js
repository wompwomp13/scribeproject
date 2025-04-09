document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
    checkRememberedUser();
    
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

const handleLogin = async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Always store email in localStorage for current session
            localStorage.setItem('currentUserEmail', email);
            
            // Store email in localStorage for future sessions if remember is checked
            if (remember) {
                localStorage.setItem('rememberedEmail', email);
            }

            // Set email as a cookie
            document.cookie = `userEmail=${email}; path=/`;

            // Redirect based on role and verification status
            if (data.user.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else if (data.user.role === 'teacher' && data.user.isVerified) {
                window.location.href = 'dashboard.html';
            } else if (data.user.role === 'student' && data.user.isVerified) {
                window.location.href = 'studentdashboard.html';
            } else {
                showToast('Your account is pending verification. Please wait for admin approval.', 'warning');
            }
        } else {
            showToast(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Failed to login. Please try again.', 'error');
    }
};

async function handleSignup() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const schoolId = document.getElementById('signupSchoolId').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                schoolId,
                password,
                role: 'student' // Default role for new registrations
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Registration successful! Please wait for admin verification.', 'success');
            document.querySelector('#signupModal .btn-close').click();
            document.getElementById('signupForm').reset();
        } else {
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Failed to register. Please try again.', 'error');
    }
}

// Check for remembered email on page load
const checkRememberedUser = () => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('remember').checked = true;
    }
}; 