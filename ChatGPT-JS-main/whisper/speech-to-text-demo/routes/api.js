const express = require('express');
const router = express.Router();
const Recording = require('../models/Recordings');

// Get recent recordings for a course
router.get('/courses/:courseId/recordings', async (req, res) => {
    try {
        const { courseId } = req.params;
        const { limit = 10, skip = 0 } = req.query;
        
        // Get recordings from the last week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const recordings = await Recording.find({
            courseId,
            createdAt: { $gte: weekAgo }
        })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .select('title duration createdAt audioFile.url transcription');

        const total = await Recording.countDocuments({
            courseId,
            createdAt: { $gte: weekAgo }
        });

        res.json({
            success: true,
            recordings,
            total,
            hasMore: total > (parseInt(skip) + recordings.length)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get single recording details
router.get('/recordings/:id', async (req, res) => {
    try {
        const recording = await Recording.findById(req.params.id)
            .select('title duration createdAt audioFile transcription');
        
        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found'
            });
        }

        res.json({
            success: true,
            recording
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 