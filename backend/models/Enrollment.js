const mongoose = require("mongoose");
const enrollmentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    enrolledAt: { type: Date, default: Date.now }
});
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
module.exports = mongoose.model("Enrollment", enrollmentSchema);