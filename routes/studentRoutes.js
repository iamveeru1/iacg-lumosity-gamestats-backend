const express = require("express");
const {
  getAllStudents,
  getStudentByEmail,
  addStudent,
  addCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/studentController.js");

const router = express.Router();

router.get("/", getAllStudents); // GET all students
router.get("/:email", getStudentByEmail); // GET single student
router.post("/", addStudent); // POST new student
router.put("/:email/course", addCourse); // PUT new course
router.put("/:email/course/:courseName", updateCourse); // PUT update course
router.delete("/:email/course/:courseId", deleteCourse); // DELETE course

module.exports = router;