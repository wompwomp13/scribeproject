document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
    checkRememberedUser();
});

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
                alert('Your account is pending verification. Please wait for admin approval.');
            }
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to login. Please try again.');
    }
};

async function handleSignup() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const schoolId = document.getElementById('signupSchoolId').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
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
            alert('Registration successful! Please wait for admin verification.');
            document.querySelector('#signupModal .btn-close').click();
            document.getElementById('signupForm').reset();
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Failed to register. Please try again.');
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