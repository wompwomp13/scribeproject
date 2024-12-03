const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    courseCode: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lectures: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recording'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Class', ClassSchema); 