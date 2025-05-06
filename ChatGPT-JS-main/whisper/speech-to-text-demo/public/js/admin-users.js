class UserManager {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.searchText = '';
        this.filterOption = 'all';
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

        // Setup search and filter events
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchText = e.target.value.toLowerCase();
                this.filterAndSortUsers();
            });
        }

        const userRoleFilter = document.getElementById('userRoleFilter');
        if (userRoleFilter) {
            userRoleFilter.addEventListener('change', (e) => {
                this.filterOption = e.target.value;
                this.filterAndSortUsers();
            });
        }

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

    filterAndSortUsers() {
        // Filter users based on search text and selected filter
        this.filteredUsers = this.users.filter(user => {
            // Apply search filter
            const searchStr = `${user.name} ${user.email} ${user.schoolId || ''}`.toLowerCase();
            const matchesSearch = this.searchText === '' || searchStr.includes(this.searchText);
            
            // Apply role/verification filter
            let matchesFilter = true;
            if (this.filterOption === 'teacher') {
                matchesFilter = user.role === 'teacher';
            } else if (this.filterOption === 'student') {
                matchesFilter = user.role === 'student';
            } else if (this.filterOption === 'verified') {
                matchesFilter = user.isVerified === true;
            } else if (this.filterOption === 'unverified') {
                matchesFilter = user.isVerified === false;
            }
            
            return matchesSearch && matchesFilter;
        });
        
        // Sort users by name (can add more sort options later)
        this.filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
        
        // Render the filtered users
        this.renderFilteredUsers();
    }
    
    renderFilteredUsers() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        if (this.filteredUsers.length === 0) {
            // Create a no results row that spans all columns
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.setAttribute('colspan', '5');
            td.className = 'no-results';
            td.innerHTML = `
                <i class="bi bi-search"></i>
                <p>No users found matching "${this.searchText}"</p>
            `;
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        
        this.filteredUsers.forEach(user => {
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
                this.filteredUsers = [...this.users];
                this.filterAndSortUsers();
            }
        } catch (error) {
            console.error('Error loading users:', error);
            // Render whatever users we have
            this.filterAndSortUsers();
        }
    }

    renderUsers(users) {
        this.users = users;
        this.filterAndSortUsers();
    }

    handleSearch(query) {
        this.searchText = query.toLowerCase();
        this.filterAndSortUsers();
    }

    handleFilter(role) {
        this.filterOption = role;
        this.filterAndSortUsers();
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
        // Store the userId for later use when confirmed
        this.userToVerify = userId;
        
        // Show the confirmation modal
        const verifyModal = new bootstrap.Modal(document.getElementById('verifyConfirmModal'));
        verifyModal.show();
        
        // Set up the confirmation button
        const confirmBtn = document.getElementById('confirmVerifyBtn');
        
        // Remove any existing listeners to prevent duplicates
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Add click event to the new button
        newConfirmBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/users/${this.userToVerify}/verify`, {
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
                
                // Hide the modal
                verifyModal.hide();

                if (data.success) {
                    // Update the user in the local array
                    const userIndex = this.users.findIndex(u => u._id === this.userToVerify);
                    if (userIndex !== -1) {
                        this.users[userIndex] = {
                            ...this.users[userIndex],
                            isVerified: true,
                            status: 'active'
                        };
                    }

                    // Refresh the display
                    this.filterAndSortUsers();
                    this.showToast('User verified successfully!');
                } else {
                    throw new Error(data.message || 'Failed to verify user');
                }
            } catch (error) {
                console.error('Error verifying user:', error);
                this.showToast('Failed to verify user: ' + error.message, 'error');
                verifyModal.hide();
            }
        });
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
                // Close modal and reset selections - user was saved successfully
                this.userModal.hide();
                this.selectedCourses.clear();
                this.selectedAvailableCourses.clear();
                this.selectedAssignedCourses.clear();
                
                // Show success toast
                this.showToast('User saved successfully!');
                
                // Skip course-instructor synchronization as requested
                // Just reload users to reflect changes
                await this.loadUsers();
            } else {
                throw new Error(data.error || 'Failed to save user');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            this.showToast('Failed to save user: ' + error.message, 'error');
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
            // Use the regular course update endpoint since the specialized instructor endpoint doesn't exist
            const response = await fetch(`/api/courses/${courseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    instructor: teacherId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to update course instructor (Status: ${response.status})`);
            }

            // Refresh courses list
            await this.loadCourses();
        } catch (error) {
            console.error('Error updating course instructor:', error);
            this.showToast(`Failed to update course: ${error.message}`, 'error');
            throw error;
        }
    }

    async handleDeleteUser(userId) {
        // Store the userId for later use when confirmed
        this.userToDelete = userId;
        
        // Show the confirmation modal
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        deleteModal.show();
        
        // Set up the confirmation button
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        // Remove any existing listeners to prevent duplicates
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Add click event to the new button
        newConfirmBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/users/${this.userToDelete}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                // Hide the modal
                deleteModal.hide();
                
                if (data.success) {
                    await this.loadUsers();
                    this.showToast('User deleted successfully!');
                } else {
                    throw new Error(data.message || 'Failed to delete user');
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                this.showToast('Failed to delete user: ' + error.message, 'error');
                deleteModal.hide();
            }
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('saveToast');
        const toastBody = toast.querySelector('.toast-body');
        
        // Clear previous classes
        toast.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info');
        
        // Add the appropriate toast color class
        toast.classList.add(`toast-${type}`);
        
        // Update icon based on type
        let icon = 'check-circle';
        if (type === 'error') icon = 'x-circle';
        else if (type === 'warning') icon = 'exclamation-triangle';
        else if (type === 'info') icon = 'info-circle';
        
        // Update message and icon
        toastBody.innerHTML = `<i class="bi bi-${icon}"></i>${message}`;
        
        // Show the toast
        this.saveToast.show();
    }
}

// Initialize the user manager
const userManager = new UserManager(); 