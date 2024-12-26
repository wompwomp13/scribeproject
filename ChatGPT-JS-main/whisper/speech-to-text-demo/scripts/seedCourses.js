const mongoose = require('mongoose');
const Course = require('../models/Course');
require('dotenv').config();

async function seedCourses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Create some test courses
        const courses = [
            {
                name: 'Physics 101',
                code: 'PHY101',
                instructor: '65c1234567890123456789ab', // Replace with a valid user ID
                description: 'Introduction to Physics',
                status: 'active'
            },
            {
                name: 'Chemistry 101',
                code: 'CHEM101',
                instructor: '65c1234567890123456789ab', // Replace with a valid user ID
                description: 'Introduction to Chemistry',
                status: 'active'
            }
        ];

        await Course.insertMany(courses);
        console.log('Test courses added successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding courses:', error);
        process.exit(1);
    }
}

seedCourses(); 