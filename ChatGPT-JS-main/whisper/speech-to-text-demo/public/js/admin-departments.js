class DepartmentManager {
    constructor() {
        this.departments = [];
        this.currentDepartmentId = null;
        this.setupEventListeners();
        this.loadDepartments();
    }

    setupEventListeners() {
        // Initialize Bootstrap modals
        this.departmentModal = new bootstrap.Modal(document.getElementById('departmentModal'));
        this.courseModal = new bootstrap.Modal(document.getElementById('courseModal'));
    }

    async loadDepartments() {
        // In a real app, this would fetch from an API
        this.departments = [
            {
                id: 1,
                name: 'Computer Science',
                code: 'CS',
                head: 'Dr. John Smith',
                courses: [
                    { id: 1, name: 'Introduction to Programming', code: 'CS101', instructor: 'Prof. Jane Doe' },
                    { id: 2, name: 'Data Structures', code: 'CS201', instructor: 'Dr. Bob Wilson' }
                ]
            },
            // Add more sample departments
        ];

        this.renderDepartments();
    }

    renderDepartments() {
        const container = document.querySelector('.departments-grid');
        container.innerHTML = '';

        this.departments.forEach(dept => {
            const card = this.createDepartmentCard(dept);
            container.appendChild(card);
        });
    }

    createDepartmentCard(department) {
        const card = document.createElement('div');
        card.className = 'department-card';
        card.innerHTML = `
            <div class="department-header">
                <div class="department-info">
                    <h3>${department.name}</h3>
                    <div class="department-code">${department.code}</div>
                </div>
                <div class="department-actions">
                    <button class="action-btn" onclick="departmentManager.handleEditDepartment(${department.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="action-btn" onclick="departmentManager.handleDeleteDepartment(${department.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="department-stats">
                <div class="stat-item">
                    <i class="bi bi-book"></i>
                    <span>${department.courses.length} Courses</span>
                </div>
                <div class="stat-item">
                    <i class="bi bi-person"></i>
                    <span>${department.head}</span>
                </div>
            </div>
            <div class="courses-list">
                ${department.courses.map(course => `
                    <div class="course-item">
                        <div>
                            <div class="course-name">${course.name}</div>
                            <div class="course-instructor">${course.instructor}</div>
                        </div>
                        <button class="action-btn" onclick="departmentManager.handleEditCourse(${department.id}, ${course.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                `).join('')}
                <button class="add-btn mt-3 w-100" onclick="departmentManager.handleAddCourse(${department.id})">
                    <i class="bi bi-plus-lg"></i>
                    Add Course
                </button>
            </div>
        `;
        return card;
    }

    handleAddDepartment() {
        this.currentDepartmentId = null;
        document.getElementById('departmentForm').reset();
        document.querySelector('#departmentModal .modal-title').textContent = 'Add Department';
        this.departmentModal.show();
    }

    handleEditDepartment(departmentId) {
        const department = this.departments.find(d => d.id === departmentId);
        if (!department) return;

        this.currentDepartmentId = departmentId;
        document.getElementById('departmentName').value = department.name;
        document.getElementById('departmentCode').value = department.code;
        document.getElementById('departmentHead').value = department.head;
        document.querySelector('#departmentModal .modal-title').textContent = 'Edit Department';
        this.departmentModal.show();
    }

    async handleSaveDepartment() {
        const form = document.getElementById('departmentForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const departmentData = {
            name: document.getElementById('departmentName').value,
            code: document.getElementById('departmentCode').value,
            head: document.getElementById('departmentHead').value
        };

        // In a real app, this would be an API call
        if (this.currentDepartmentId) {
            // Update existing department
            const index = this.departments.findIndex(d => d.id === this.currentDepartmentId);
            if (index !== -1) {
                this.departments[index] = {
                    ...this.departments[index],
                    ...departmentData
                };
            }
        } else {
            // Add new department
            this.departments.push({
                id: Date.now(),
                ...departmentData,
                courses: []
            });
        }

        this.renderDepartments();
        this.departmentModal.hide();
    }

    handleDeleteDepartment(departmentId) {
        if (confirm('Are you sure you want to delete this department?')) {
            // In a real app, this would be an API call
            this.departments = this.departments.filter(d => d.id !== departmentId);
            this.renderDepartments();
        }
    }

    // Course management methods
    handleAddCourse(departmentId) {
        this.currentDepartmentId = departmentId;
        document.getElementById('courseForm').reset();
        document.querySelector('#courseModal .modal-title').textContent = 'Add Course';
        this.courseModal.show();
    }

    handleSaveCourse() {
        // Implementation for saving course
        // Would include API calls in a real application
    }
}

// Initialize the department manager
const departmentManager = new DepartmentManager();

// Global handlers
function handleAddDepartment() {
    departmentManager.handleAddDepartment();
}

function handleSaveDepartment() {
    departmentManager.handleSaveDepartment();
}

function handleSaveCourse() {
    departmentManager.handleSaveCourse();
} 