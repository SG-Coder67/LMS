// models/Course.js (or equivalent definition)
const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    // --- Add this line ---
    status: { type: String, enum: ['active', 'completed'], default: 'active' }
    // --------------------
});

module.exports = mongoose.model('Course', CourseSchema);