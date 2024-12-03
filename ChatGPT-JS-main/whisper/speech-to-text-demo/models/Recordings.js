const mongoose = require('mongoose');

const RecordingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        default: 'Untitled Lecture'
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    audioFile: {
        filename: String,
        path: String
    },
    transcription: {
        text: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    notes: [{
        content: String,
        timestamp: Date,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Recording', RecordingSchema);