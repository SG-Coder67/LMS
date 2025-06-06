const mongoose = require("mongoose");
const attendanceSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['Present', 'Absent'], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } 
});
attendanceSchema.index({ student: 1, course: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);