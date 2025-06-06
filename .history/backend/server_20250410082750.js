const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bodyParser = require("body-parser"); 
const path = require("path");
const User = require("./models/User");
const Course = require("./models/Course");
const Enrollment = require("./models/Enrollment");
const Assignment = require("./models/Assignment");
const Submission = require("./models/Submission");
const Attendance = require("./models/Attendance");
const Mark = require("./models/Mark");
const app = express();
const PORT = 5010;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: "your-very-secret-key-change-this",
    resave: false,
    saveUninitialized: true, 
    cookie: {
        secure: false, 
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 24 
    }
}));
const DB_URI = "mongodb://localhost:27017/lms";
mongoose.connect(DB_URI)
.then(() => console.log("MongoDB Connected successfully."))
.catch((err) => console.error("MongoDB connection error:", err));
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user && req.session.user.id) {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
             res.status(401).json({ msg: "Unauthorized: Please log in." });
        } else {
             console.log('Redirecting to login from:', req.originalUrl);
             res.redirect("/login.html");
        }
    }
}

function isTeacher(req, res, next) {
    if (req.session.user && req.session.user.role === "teacher") {
        next();
    } else {
        res.status(403).json({ msg: "Forbidden: Teacher access required." });
    }
}

function isStudent(req, res, next) {
    if (req.session.user && req.session.user.role === "student") {
        next();
    } else {
        res.status(403).json({ msg: "Forbidden: Student access required." });
    }
}

app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'teacher') {
            res.redirect("/teacher_dashboard.html");
        } else {
             res.redirect("/student_dashboard.html");
        }
    } else {
         res.sendFile(path.join(__dirname, "..", "login.html"));
    }
});

app.get("/register", (req, res) => {
     if (req.session && req.session.user) {
         return res.redirect('/');
     }
    res.sendFile(path.join(__dirname, "..", "register.html"));
});

app.get("/student_dashboard", isAuthenticated, isStudent, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "student_dashboard.html"));
});

app.get("/teacher_dashboard", isAuthenticated, isTeacher, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "teacher_dashboard.html"));
});

app.post("/api/auth/register", async (req, res) => {
    const { username, password, role, email } = req.body;

    if (!username || !password || !role || !email) {
        return res.status(400).json({ msg: "All fields are required" });
    }

    if (!["student", "teacher"].includes(role)) {
        return res.status(400).json({ msg: "Invalid role selected" });
    }

    if (username.length > 16) {
        return res.status(400).json({ msg: "Username must be 16 characters or less" });
    }

    const passwordRegex = /^.{8,16}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ msg: "Password must contain 8 to 16 characters" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ msg: "Username already taken" });
        }

        const newUser = new User({ username, password, role, email });
        await newUser.save();

        res.status(201).json({ msg: "Registration successful" });
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).json({ msg: "Registration failed" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ msg: "Please enter username and password" });
    try {
        const user = await User.findOne({ username: username, password: password }); 
        if (!user) return res.status(401).json({ msg: "Invalid username or password" });
        req.session.user = { id: user._id, username: user.username, role: user.role };
        res.json({ msg: "Login successful", role: user.role, username: user.username });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ msg: "Internal server error during login" });
    }
});
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Session destruction error:", err);
            return res.status(500).json({ msg: "Could not log out, please try again." });
        }
        res.json({ msg: "Logout successful" });
    });
});
app.get("/api/auth/session", isAuthenticated, (req, res) => {
    res.json({
        isLoggedIn: true,
        user: {
            id: req.session.user.id,
            username: req.session.user.username,
            role: req.session.user.role
        }
    });
});

app.post("/api/teacher/courses", isAuthenticated, isTeacher, async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) return res.status(400).json({ msg: "Please provide course name and description" });

    try {
        const course = new Course({ name, description, createdBy: req.session.user.id });
        await course.save();
        res.status(201).json({ msg: "Course created successfully", course: course });
    } catch (err) {
        console.error("Course creation error:", err);
        res.status(500).json({ msg: "Internal server error during course creation" });
    }
});

app.get("/api/courses", isAuthenticated, async (req, res) => {
    try {
        console.log("Attempting to fetch courses (simplified)..."); 

        const courses = await Course.find();
        console.log("Courses fetched (simplified):", courses ? courses.length : 0);
        res.json(courses);
    } catch (err) {
        console.error("Error fetching courses (simplified query):", err); 
        res.status(500).json({ msg: "Error fetching courses" });
    }
});

app.post("/api/courses/:courseId/enroll", isAuthenticated, isStudent, async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const studentId = req.session.user.id;

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ msg: "Course not found" });

        const existingEnrollment = await Enrollment.findOne({ student: studentId, course: courseId });
        if (existingEnrollment) return res.status(400).json({ msg: "Already enrolled in this course" });

        const enrollment = new Enrollment({ student: studentId, course: courseId });
        await enrollment.save();
        res.status(201).json({ msg: "Successfully enrolled", enrollment });
    } catch (err) {
        console.error("Enrollment error:", err);
        res.status(500).json({ msg: "Error enrolling in course" });
    }
});

app.get("/api/student/courses", isAuthenticated, isStudent, async (req, res) => {
    try {
      const username = req.session.username;
  
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      const courses = await Course.find({ registeredStudents: user._id })
        .populate("createdBy", "username name") 
        .lean();
  
      res.json(courses);
    } catch (err) {
      console.error("Error fetching registered courses:", err);
      res.status(500).json({ msg: "Error fetching registered courses" });
    }
  });
  

app.get("/api/teacher/courses", isAuthenticated, isTeacher, async (req, res) => {
    try {
        const teacherId = req.session.user.id;
        const courses = await Course.find({ createdBy: teacherId }).lean();
        res.json(courses);
    } catch (err) {
        console.error("Error fetching teacher courses:", err);
        res.status(500).json({ msg: "Error fetching teacher courses" });
    }
});
app.get("/api/teacher/courses/:courseId/students", isAuthenticated, isTeacher, async (req, res) => {
    const courseId = req.params.courseId;
    const teacherId = req.session.user.id;
    try {
        const course = await Course.findOne({ _id: courseId, createdBy: teacherId });
        if (!course) {
            return res.status(404).json({ msg: "Course not found or you are not the creator" });
        }
        const enrollments = await Enrollment.find({ course: courseId }).populate('student', 'username name').lean();
        const students = enrollments.map(en => en.student).filter(Boolean);
        res.json(students);
    } catch (err) {
         console.error("Error fetching enrolled students:", err);
        res.status(500).json({ msg: "Error fetching enrolled students" });
    }
});
app.post("/api/teacher/courses/:courseId/assignments", isAuthenticated, isTeacher, async (req, res) => {
    const { title, description, dueDate, totalMarks } = req.body;
    const courseId = req.params.courseId;
    const teacherId = req.session.user.id;
    if (!title || !description || !dueDate) return res.status(400).json({ msg: "Please provide title, description, and due date" });

    try {
        const course = await Course.findOne({ _id: courseId, createdBy: teacherId });
        if (!course) return res.status(404).json({ msg: "Course not found or you are not the creator" });
        const newAssignment = new Assignment({
            title, description, dueDate,
            totalMarks: totalMarks ? Number(totalMarks) : 100, 
            course: courseId, teacher: teacherId
        });
        await newAssignment.save();
        res.status(201).json({ msg: "Assignment created successfully", assignment: newAssignment });
    } catch (err) {
        console.error("Error creating assignment:", err);
        if (err.name === 'ValidationError') return res.status(400).json({ msg: err.message });
        res.status(500).json({ msg: "Error creating assignment" });
    }
});

app.get("/api/courses/:courseId/assignments", isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    try {
        if (userRole === 'student') {
            const isEnrolled = await Enrollment.findOne({ student: userId, course: courseId });
            if (!isEnrolled) return res.status(403).json({ msg: "Not enrolled in this course" });
        }
        const assignments = await Assignment.find({ course: courseId }).sort({ dueDate: 1 }).lean();
        res.json(assignments);
    } catch (err) {
        console.error("Error fetching assignments:", err);
        res.status(500).json({ msg: "Error fetching assignments" });
    }
});
app.post("/api/assignments/:assignmentId/submit", isAuthenticated, isStudent, async (req, res) => {
    const assignmentId = req.params.assignmentId;
    const studentId = req.session.user.id;
    const { content } = req.body;
    if (!content) return res.status(400).json({ msg: "Submission content cannot be empty" });

    try {
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ msg: "Assignment not found" });
        const isEnrolled = await Enrollment.findOne({ student: studentId, course: assignment.course });
        if (!isEnrolled) return res.status(403).json({ msg: "You are not enrolled in the course for this assignment." });
        if (new Date() > new Date(assignment.dueDate)) return res.status(400).json({ msg: "Cannot submit assignment: Due date has passed." });
        const existingSubmission = await Submission.findOne({ assignment: assignmentId, student: studentId });
        if (existingSubmission) return res.status(400).json({ msg: "You have already submitted this assignment." });
        const newSubmission = new Submission({
            assignment: assignmentId, student: studentId,
            course: assignment.course, content: content, submittedAt: new Date()
        });
        await newSubmission.save();
        res.status(201).json({ msg: "Assignment submitted successfully", submission: newSubmission });
    } catch (err) {
        console.error("Error submitting assignment:", err);
        res.status(500).json({ msg: "Error submitting assignment" });
    }
});
app.get("/api/teacher/assignments/:assignmentId/submissions", isAuthenticated, isTeacher, async (req, res) => {
    const assignmentId = req.params.assignmentId;
    const teacherId = req.session.user.id;
    try {
        const assignment = await Assignment.findOne({ _id: assignmentId, teacher: teacherId });
        if (!assignment) return res.status(404).json({ msg: "Assignment not found or not created by you." });
        const submissions = await Submission.find({ assignment: assignmentId })
            .populate('student', 'username name')
            .lean(); 
        const submissionIds = submissions.map(s => s._id);
        const marksData = await Mark.find({ submission: { $in: submissionIds } }).lean();
        const marksMap = marksData.reduce((map, mark) => {
             map[mark.submission.toString()] = mark;
             return map;
        }, {});
        const results = submissions.map(sub => ({
            ...sub,
            mark: marksMap[sub._id.toString()] || null 
        }));
        res.json(results);
    } catch (err) {
        console.error("Error fetching submissions:", err);
        res.status(500).json({ msg: "Error fetching submissions" });
    }
});
app.get("/api/student/submissions", isAuthenticated, isStudent, async (req, res) => {
    const studentId = req.session.user.id;
    try {
        const submissions = await Submission.find({ student: studentId })
            .populate({ path: 'assignment', select: 'title dueDate totalMarks' })
            .sort({ submittedAt: -1 })
            .lean();
         const submissionIds = submissions.map(s => s._id);
         const marksData = await Mark.find({ submission: { $in: submissionIds }, student: studentId }).lean();
         const marksMap = marksData.reduce((map, mark) => {
              map[mark.submission.toString()] = mark;
              return map;
         }, {});
         const results = submissions.map(sub => ({
             ...sub,
             mark: marksMap[sub._id.toString()] || null
         }));
        res.json(results);
    } catch (err) {
        console.error("Error fetching student submissions:", err);
        res.status(500).json({ msg: "Error fetching your submissions" });
    }
});

app.post("/api/teacher/submissions/:submissionId/mark", isAuthenticated, isTeacher, async (req, res) => {
    const submissionId = req.params.submissionId;
    const teacherId = req.session.user.id;
    const { marks } = req.body;

    if (marks === undefined || marks === null) return res.status(400).json({ msg: "Marks value is required." });
    const marksNumber = Number(marks);
    if (isNaN(marksNumber)) return res.status(400).json({ msg: "Marks must be a number." });

    try {
        const submission = await Submission.findById(submissionId).populate('assignment');
        if (!submission) return res.status(404).json({ msg: "Submission not found." });
        if (submission.assignment.teacher.toString() !== teacherId) return res.status(403).json({ msg: "You did not create the assignment for this submission." });
        const totalMarks = submission.assignment.totalMarks || 100;
        if (marksNumber < 0 || marksNumber > totalMarks) {
             return res.status(400).json({ msg: `Marks must be between 0 and ${totalMarks}.` });
        }
        const updatedMark = await Mark.findOneAndUpdate(
             { submission: submissionId, student: submission.student }, 
             { 
                 student: submission.student,
                 course: submission.course,
                 assignment: submission.assignment._id,
                 submission: submissionId,
                 marks: marksNumber,
                 totalMarks: totalMarks,
                 markedBy: teacherId,
                 markedAt: new Date()
             },
             {
                 new: true,
                 upsert: true, 
                 runValidators: true 
             }
         );

        res.json({ msg: "Mark saved successfully", mark: updatedMark });
    } catch (err) {
        console.error("Error saving mark:", err);
        if (err.name === 'ValidationError') return res.status(400).json({ msg: err.message });
        res.status(500).json({ msg: "Error saving mark" });
    }
});

app.get("/api/student/marks", isAuthenticated, isStudent, async (req, res) => {
    const studentId = req.session.user.id;
    try {
        const marks = await Mark.find({ student: studentId })
            .populate('course', 'name')
            .populate('assignment', 'title')
            .lean();
        res.json(marks);
    } catch (err) {
        console.error("Error fetching student marks:", err);
        res.status(500).json({ msg: "Error fetching your marks" });
    }
});

app.post("/api/teacher/courses/:courseId/attendance", isAuthenticated, isTeacher, async (req, res) => {
    const courseId = req.params.courseId;
    const teacherId = req.session.user.id;
    const { studentUsername, date, status } = req.body;

    if (!studentUsername || !date || !status) return res.status(400).json({ msg: "Student username, date, and status are required." });
    if (!['Present', 'Absent'].includes(status)) return res.status(400).json({ msg: "Invalid attendance status." });

    try {
        const student = await User.findOne({ username: studentUsername, role: 'student' });
        if (!student) return res.status(404).json({ msg: `Student with username '${studentUsername}' not found.` });

        const course = await Course.findOne({ _id: courseId, createdBy: teacherId });
        if (!course) return res.status(404).json({ msg: "Course not found or you are not the teacher." });

        const isEnrolled = await Enrollment.findOne({ student: student._id, course: courseId });
        if (!isEnrolled) return res.status(400).json({ msg: `Student '${studentUsername}' is not enrolled in this course.` });
        const attendanceDate = new Date(date);
        attendanceDate.setUTCHours(0, 0, 0, 0);
         const updatedAttendance = await Attendance.findOneAndUpdate(
             { student: student._id, course: courseId, date: attendanceDate },
             { 
                  status: status,
                  markedBy: teacherId
             },
             {
                  new: true, 
                  upsert: true,
                  runValidators: true
             }
         );

        res.status(updatedAttendance.isNew ? 201 : 200).json({
             msg: `Attendance ${updatedAttendance.isNew ? 'marked' : 'updated'} successfully`,
             attendance: updatedAttendance
         });

    } catch (err) {
        console.error("Error marking attendance:", err);
        if (err.name === 'ValidationError') return res.status(400).json({ msg: "Validation Error: " + err.message });
        res.status(500).json({ msg: "Error marking attendance" });
    }
});

app.get("/api/student/attendance", isAuthenticated, isStudent, async (req, res) => {
     const studentId = req.session.user.id;
     try {
        const attendanceRecords = await Attendance.find({ student: studentId })
            .populate('course', 'name')
            .sort({ date: -1 })
            .lean();
        const summary = {};
        attendanceRecords.forEach(record => {
            const courseName = record.course ? record.course.name : 'Unknown Course';
            if (!summary[courseName]) summary[courseName] = { present: 0, absent: 0, total: 0 };
            summary[courseName].total++;
            if (record.status === 'Present') summary[courseName].present++; else summary[courseName].absent++;
        });
        Object.keys(summary).forEach(courseName => {
            summary[courseName].percentage = summary[courseName].total > 0 ? Math.round((summary[courseName].present / summary[courseName].total) * 100) : 0;
        });
        res.json({ details: attendanceRecords, summary: summary });
     } catch (err) {
         console.error("Error fetching student attendance:", err);
         res.status(500).json({ msg: "Error fetching your attendance" });
     }
});
app.use('/api/*', (req, res) => {
    res.status(404).json({ msg: 'API endpoint not found.' });
});

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    res.status(err.status || 500).send({
         message: err.message || 'Something went wrong on the server!',
         error: err 
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});