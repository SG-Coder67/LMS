const mongoose = require("mongoose");
const courseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});
const Course = mongoose.model("Course", courseSchema);
module.exports = Course;