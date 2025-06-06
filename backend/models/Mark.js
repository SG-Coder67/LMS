const mongoose = require("mongoose");

const markSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: false }, 
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: false }, 
    marks: { type: Number, required: true },
    totalMarks: { type: Number, required: false, default: 100 }, 
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    markedAt: { type: Date, default: Date.now }
});
markSchema.index({ student: 1, assignment: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("Mark", markSchema);