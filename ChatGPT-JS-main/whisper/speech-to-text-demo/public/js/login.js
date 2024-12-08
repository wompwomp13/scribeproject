document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', handleLogin);
});

const handleLogin = (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const remember = document.getElementById('remember').checked;

    // In a real application, you would validate credentials against a backend
    // For demo purposes, we'll just redirect based on role
    if (role === 'student') {
        window.location.href = 'studentdashboard.html';
    } else if (role === 'teacher') {
        window.location.href = 'dashboard.html';
    }

    // If remember me is checked, you could store the email in localStorage
    if (remember) {
        localStorage.setItem('userEmail', email);
    }
};

// Check for remembered email on page load
const checkRememberedUser = () => {
    const rememberedEmail = localStorage.getItem('userEmail');
    if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('remember').checked = true;
    }
};

// Call this function when the page loads
checkRememberedUser(); 