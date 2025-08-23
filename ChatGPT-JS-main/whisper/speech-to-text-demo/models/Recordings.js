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
        required: false
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: false
    },
    audioFile: {
        filename: String,
        path: String,
        isDropbox: {
            type: Boolean,
            default: false
        },
        gridFSId: mongoose.Schema.Types.ObjectId
    },
    transcription: {
        text: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    finalized: {
        formattedTranscript: { type: String }, // HTML of cleaned transcript approved by teacher
        summary: { type: mongoose.Schema.Types.Mixed }, // structured summary object
        visualSections: [{
            term: String,
            explanation: String,
            context: String,
            imageUrl: String
        }],
        updatedAt: Date,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
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
    timestamps: true,
    collection: 'Lecture Recordings'
});

module.exports = mongoose.model('Recording', RecordingSchema);