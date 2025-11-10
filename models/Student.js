const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseName: String,
  minsWatched: String,
  currentStatus: String,
  lastActive: String,
});

const studentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  rollNumber: String,
  parentName: String,
  academicYear: String,
  stream: String,
  udemyTracker: {
    courses: [courseSchema],
  },
});

module.exports = mongoose.model("udemycourses", studentSchema);