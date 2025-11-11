// Test script for DELETE course endpoint
// Run with: node testDeleteCourse.js

const BASE_URL = "http://localhost:3000/api/students";

async function testDeleteCourse(email, courseId) {
  try {
    console.log(`Testing DELETE: ${BASE_URL}/${email}/course/${courseId}`);
    
    const response = await fetch(`${BASE_URL}/${email}/course/${courseId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log("✓ Course deleted successfully!");
    } else {
      console.log("✗ Failed to delete course");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Replace with actual email and courseId from your database
const testEmail = "student@example.com";
const testCourseId = "YOUR_COURSE_ID_HERE";

testDeleteCourse(testEmail, testCourseId);
