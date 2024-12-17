class UserManager {
    constructor() {
        this.users = [];
        this.currentUserId = null;
        this.setupEventListeners();
        this.loadUsers();
    }

    setupEventListeners() {
        this.userModal = new bootstrap.Modal(document.getElementById('userModal'));

        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleFilter(btn.dataset.role);
                document.querySelector('.filter-btn.active').classList.remove('active');
                btn.classList.add('active');
            });
        });
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.success) {
                this.users = data.users;
                this.renderUsers(this.users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.renderUsers(this.users);
        }
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            const initials = user.name.split(' ').map(n => n[0]).join('');
            
            tr.innerHTML = `
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${initials}</div>
                        <span>${user.name}</span>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                <td>
                    <span class="user-status status-${user.status}">
                        ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" onclick="userManager.handleEditUser('${user._id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="userManager.handleDeleteUser('${user._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    handleSearch(query) {
        const filteredUsers = this.users.filter(user => {
            const searchStr = `${user.name} ${user.email} ${user.department}`.toLowerCase();
            return searchStr.includes(query.toLowerCase());
        });
        this.renderUsers(filteredUsers);
    }

    handleFilter(role) {
        const filteredUsers = role === 'all' 
            ? this.users 
            : this.users.filter(user => user.role === role);
        this.renderUsers(filteredUsers);
    }

    handleAddUser() {
        this.currentUserId = null;
        document.getElementById('userForm').reset();
        document.querySelector('#userModal .modal-title').textContent = 'Add User';
        this.userModal.show();
    }

    handleEditUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.currentUserId = userId;
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userRole').value = user.role;
        document.getElementById('userDepartment').value = user.department;
        document.querySelector('#userModal .modal-title').textContent = 'Edit User';
        this.userModal.show();
    }

    async handleSaveUser() {
        const form = document.getElementById('userForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const userData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value,
            status: 'active'
        };

        try {
            const url = this.currentUserId ? 
                `/api/users/${this.currentUserId}` : 
                '/api/users';
            
            const method = this.currentUserId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                await this.loadUsers();
                this.userModal.hide();

                if (userData.role === 'teacher') {
                    window.dispatchEvent(new CustomEvent('userAdded'));
                }
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error saving user:', error);
            this.users.push({
                id: Date.now(),
                ...userData
            });
            this.renderUsers(this.users);
            this.userModal.hide();
        }
    }

    async handleDeleteUser(userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            try {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    await this.loadUsers(); // Reload users from server
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Failed to delete user: ' + error.message);
            }
        }
    }
}

// Initialize the user manager
const userManager = new UserManager();

// Global handlers
function handleAddUser() {
    userManager.handleAddUser();
}

function handleSaveUser() {
    userManager.handleSaveUser();
} 