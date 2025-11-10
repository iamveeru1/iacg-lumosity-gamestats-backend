const Student = require("../models/Student.js");

/**
 * @desc Get all students
 * @route GET /api/students
 */
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Get one student by email
 * @route GET /api/students/:email
 */
exports.getStudentByEmail = async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.params.email });
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Add new student
 * @route POST /api/students
 */
exports.addStudent = async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * @desc Add new course to a student
 * @route PUT /api/students/:email/course
 */
exports.addCourse = async (req, res) => {
  try {
    const { email } = req.params;
    const course = req.body;

    const student = await Student.findOneAndUpdate(
      { email },
      { $push: { "udemyTracker.courses": course } },
      { new: true }
    );

    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Update a specific course
 * @route PUT /api/students/:email/course/:courseName
 */
exports.updateCourse = async (req, res) => {
  try {
    const { email, courseName } = req.params;
    const updates = req.body;

    const student = await Student.findOneAndUpdate(
      { email, "udemyTracker.courses.courseName": courseName },
      { $set: { "udemyTracker.courses.$": { ...updates } } },
      { new: true }
    );

    if (!student) return res.status(404).json({ message: "Course not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc Delete a specific course
 * @route DELETE /api/students/:email/course/:courseId
 */
exports.deleteCourse = async (req, res) => {
  try {
    const { email, courseId } = req.params;
    console.log(`Deleting course with ID: ${courseId}`);

    const student = await Student.findOneAndUpdate(
      { email },
      { $pull: { "udemyTracker.courses": { _id: courseId } } },
      { new: true }
    );

    console.log(student);

    if (!student)
      return res
        .status(404)
        .json({ message: "Student not found or course not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
