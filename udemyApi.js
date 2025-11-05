const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const udemyTrackingPath = path.join(__dirname, 'udemyTracking.json');

// Function to read Udemy tracking data
function readUdemyTrackingData() {
  try {
    const data = fs.readFileSync(udemyTrackingPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading udemyTracking.json:', error);
    return {};
  }
}

// Function to write Udemy tracking data
function writeUdemyTrackingData(data) {
  try {
    fs.writeFileSync(udemyTrackingPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to udemyTracking.json:', error);
  }
}

// GET all courses for all users
router.get('/courses', (req, res) => {
  const data = readUdemyTrackingData();
  res.json(data);
});

// CREATE a new course for a specific user
router.post('/courses/:email', (req, res) => {
  const data = readUdemyTrackingData();
  const user = data[req.params.email];
  if (user && user.udemyTracker && user.udemyTracker.courses) {
    const newCourse = req.body;
    user.udemyTracker.courses.push(newCourse);
    writeUdemyTrackingData(data);
    res.status(201).json(newCourse);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// UPDATE a course for a specific user
router.put('/courses/:email/:courseName', (req, res) => {
  const data = readUdemyTrackingData();
  const user = data[req.params.email];
  if (user && user.udemyTracker && user.udemyTracker.courses) {
    const courseIndex = user.udemyTracker.courses.findIndex((c) => c.courseName === req.params.courseName);
    if (courseIndex === -1) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const updatedCourse = { ...user.udemyTracker.courses[courseIndex], ...req.body };
    user.udemyTracker.courses[courseIndex] = updatedCourse;
    writeUdemyTrackingData(data);
    res.json(updatedCourse);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// DELETE a course for a specific user
router.delete('/courses/:email/:courseName', (req, res) => {
  const data = readUdemyTrackingData();
  const user = data[req.params.email];
  if (user && user.udemyTracker && user.udemyTracker.courses) {
    const courseIndex = user.udemyTracker.courses.findIndex((c) => c.courseName === req.params.courseName);
    if (courseIndex === -1) {
      return res.status(404).json({ message: 'Course not found' });
    }
    user.udemyTracker.courses.splice(courseIndex, 1);
    writeUdemyTrackingData(data);
    res.status(204).send();
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

module.exports = router;