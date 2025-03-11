class UserManager {
    constructor() {
        this.users = [];
        this.courses = [];
        this.selectedCourses = new Set();
        this.selectedAvailableCourses = new Set();
        this.selectedAssignedCourses = new Set();
        this.currentUserId = null;
        this.setupEventListeners();
        this.loadUsers();
        this.loadCourses();
        
        // Initialize toast
        this.saveToast = new bootstrap.Toast(document.getElementById('saveToast'), {
            delay: 3000
        });
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

        // Add course search event listeners
        document.getElementById('assignedCourseSearch').addEventListener('input', (e) => {
            this.handleCourseSearch(e.target.value, 'assigned');
        });

        document.getElementById('availableCourseSearch').addEventListener('input', (e) => {
            this.handleCourseSearch(e.target.value, 'available');
        });

        // Add role change event listener
        document.getElementById('userRole').addEventListener('change', (e) => {
            this.selectedCourses.clear();
            this.selectedAvailableCourses.clear();
            this.selectedAssignedCourses.clear();
            this.updateAssignedCoursesList();
            this.updateAvailableCoursesList();
        });

        // Add keyboard event listeners for course selection
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (this.selectedAvailableCourses.size > 0 || this.selectedAssignedCourses.size > 0)) {
                if (this.selectedAvailableCourses.size > 0) {
                    this.assignSelectedCourses();
                } else {
                    this.unassignSelectedCourses();
                }
            }
        });
    }

    handleCourseSearch(query, type) {
        const listId = type === 'assigned' ? 'assignedCoursesList' : 'availableCoursesList';
        const items = document.querySelectorAll(`#${listId} .course-item`);
        const searchTerm = query.toLowerCase();
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    updateCourseLists() {
        this.updateAssignedCoursesList();
        this.updateAvailableCoursesList();
    }

    updateAssignedCoursesList() {
        const container = document.getElementById('assignedCoursesList');
        const assignedCourses = this.courses.filter(course => this.selectedCourses.has(course._id));
        
        if (assignedCourses.length === 0) {
            container.innerHTML = '<p class="no-courses-message">No courses assigned yet</p>';
            return;
        }

        container.innerHTML = assignedCourses.map(course => `
            <div class="course-item" onclick="userManager.toggleCourse('${course._id}')">
                <div class="course-item-details">
                    <span class="course-code">${course.code}</span>
                    <span class="course-name">${course.name}</span>
                </div>
            </div>
        `).join('');
    }

    updateAvailableCoursesList() {
        const container = document.getElementById('availableCoursesList');
        const availableCourses = this.courses.filter(course => !this.selectedCourses.has(course._id));
        
        if (availableCourses.length === 0) {
            container.innerHTML = '<p class="no-courses-message">No courses available</p>';
            return;
        }

        container.innerHTML = availableCourses.map(course => `
            <div class="course-item" onclick="userManager.toggleCourse('${course._id}')">
                <div class="course-item-details">
                    <span class="course-code">${course.code}</span>
                    <span class="course-name">${course.name}</span>
                </div>
            </div>
        `).join('');
    }

    toggleCourse(courseId) {
        if (this.selectedCourses.has(courseId)) {
            this.selectedCourses.delete(courseId);
        } else {
            this.selectedCourses.add(courseId);
        }
        this.updateCourseLists();
    }

    async loadCourses() {
        try {
            const response = await fetch('/api/courses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.success) {
                this.courses = data.courses;
                this.updateCourseLists();
            }
        } catch (error) {
            console.error('Error loading courses:', error);
        }
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
                <td style="width: 30%;">
                    <div class="user-info">
                        <div class="user-avatar">${initials}</div>
                        <div class="user-details">
                            <span class="user-name">${user.name}</span>
                            <span class="user-id">${user.schoolId || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td style="width: 25%;">${user.email}</td>
                <td style="width: 15%;">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                <td style="width: 15%;">
                    <div class="d-flex justify-content-start">
                        ${user.isVerified ? 
                            '<span class="verification-badge"><i class="bi bi-check-circle-fill"></i> Verified</span>' : 
                            '<span class="verification-badge unverified"><i class="bi bi-x-circle-fill"></i> Not Verified</span>'
                        }
                    </div>
                </td>
                <td style="width: 15%; text-align: center;">
                    <div class="action-buttons">
                        ${!user.isVerified ? `
                            <button class="action-btn verify-btn" onclick="userManager.handleVerifyUser('${user._id}')">
                                <i class="bi bi-check-circle"></i>
                            </button>
                        ` : ''}
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
        const searchTerm = query.toLowerCase();
        const filteredUsers = this.users.filter(user => {
            const searchStr = `${user.name} ${user.email} ${user.schoolId}`.toLowerCase();
            return searchStr.includes(searchTerm);
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
        this.selectedCourses.clear();
        this.selectedAvailableCourses.clear();
        this.selectedAssignedCourses.clear();
        this.updateAssignedCoursesList();
        this.updateAvailableCoursesList();
        document.querySelector('#userModal .modal-title').textContent = 'Add User';
        this.userModal.show();
    }

    async handleVerifyUser(userId) {
        if (!confirm('Are you sure you want to verify this user?')) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${userId}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to verify user');
            }

            const data = await response.json();

            if (data.success) {
                // Update the user in the local array
                const userIndex = this.users.findIndex(u => u._id === userId);
                if (userIndex !== -1) {
                    this.users[userIndex] = {
                        ...this.users[userIndex],
                        isVerified: true,
                        status: 'active'
                    };
                }

                // Refresh the display
                this.renderUsers(this.users);
                alert('User verified successfully!');
            } else {
                throw new Error(data.message || 'Failed to verify user');
            }
        } catch (error) {
            console.error('Error verifying user:', error);
            alert('Failed to verify user: ' + error.message);
        }
    }

    async handleEditUser(userId) {
        const user = this.users.find(u => u._id === userId);
        if (!user) return;

        this.currentUserId = userId;
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userRole').value = user.role;

        // Set selected courses
        this.selectedCourses.clear();
        if (user.courses) {
            const courseIds = Array.isArray(user.courses) 
                ? user.courses.map(c => typeof c === 'object' ? c._id : c)
                : [user.courses];
            courseIds.forEach(id => this.selectedCourses.add(id));
        }
        
        this.updateCourseLists();
        document.querySelector('#userModal .modal-title').textContent = 'Edit User';
        this.userModal.show();
    }

    async handleSaveUser() {
        const form = document.getElementById('userForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // For updates, only send fields that should be updated
        const userData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value,
            courses: Array.from(this.selectedCourses)
        };

        // Only include status in new user creation
        if (!this.currentUserId) {
            userData.status = 'active';
        }

        try {
            const url = this.currentUserId ? 
                `/api/users/${this.currentUserId}` : 
                '/api/users';
            
            const response = await fetch(url, {
                method: this.currentUserId ? 'PUT' : 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                // Update course instructors if this is a teacher
                if (userData.role === 'teacher') {
                    // First, remove this teacher from all courses
                    const allCourses = await this.loadAllCourses();
                    const coursesWithThisTeacher = allCourses.filter(
                        course => course.instructor === this.currentUserId
                    );
                    
                    // Remove teacher from courses they're no longer assigned to
                    for (const course of coursesWithThisTeacher) {
                        if (!userData.courses.includes(course._id)) {
                            await this.updateCourseInstructor(course._id, null);
                        }
                    }
                    
                    // Assign teacher to new courses
                    for (const courseId of userData.courses) {
                        await this.updateCourseInstructor(courseId, this.currentUserId);
                    }
                }

                await this.loadUsers();
                this.userModal.hide();
                this.selectedCourses.clear();
                this.selectedAvailableCourses.clear();
                this.selectedAssignedCourses.clear();
                
                // Show success toast
                this.saveToast.show();
            } else {
                throw new Error(data.error || 'Failed to save user');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Failed to save user: ' + error.message);
        }
    }

    async loadAllCourses() {
        try {
            const response = await fetch('/api/courses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.success ? data.courses : [];
        } catch (error) {
            console.error('Error loading all courses:', error);
            return [];
        }
    }

    async updateCourseInstructor(courseId, teacherId) {
        try {
            const response = await fetch(`/api/courses/${courseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    instructor: teacherId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update course instructor');
            }

            // Refresh courses list
            await this.loadCourses();
        } catch (error) {
            console.error('Error updating course instructor:', error);
            throw error;
        }
    }

    async handleDeleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadUsers();
                alert('User deleted successfully!');
            } else {
                throw new Error(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user: ' + error.message);
        }
    }
}

// Initialize the user manager
const userManager = new UserManager(); 