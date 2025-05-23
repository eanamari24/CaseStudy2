const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const mongoose = require('mongoose');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());


// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/barangay', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Mongoose schemas and models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
});

const studentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  Fullname: { type: String, required: true },
  DateofBirth: { type: String, required: true },
  sex: { type: String, required: true },
  age: { type: String, required: true },
  purok: { type: String, required: true },
  CivilStatus: { type: String, required: true },
  citizenship: { type: String, required: true },
  religion: { type: String, required: true },
  phone: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { username, password, role, secretPasskey } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  if (role === 'admin' && secretPasskey !== 'admin123') {
    return res.status(403).json({ message: 'Invalid secret passkey for admin role' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({ username, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'User already exists' });
    } else {
      res.status(500).json({ message: 'Failed to register user' });
    }
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.status(200).json({ username: user.username, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Failed to login' });
  }
});

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify admin role' });
  }
};

// CRUD Operations

// Route to save student data
app.post('/students', async (req, res) => {
  const { id, Fullname, DateofBirth, sex, age, purok, CivilStatus, citizenship, religion, phone } = req.body;

  if (!id || !Fullname || !DateofBirth || !sex || !age || !purok || !CivilStatus || !citizenship || !religion || !phone) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newStudent = new Student({ id, Fullname, DateofBirth, sex, age, purok, CivilStatus, citizenship, religion, phone });
    await newStudent.save();
    res.status(201).json({ message: 'Student saved successfully' });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Student with this ID already exists' });
    } else {
      res.status(500).json({ message: 'Failed to save student' });
    }
  }
});

// Read (R)
app.get('/students/:id', async (req, res) => {
  try {
    const student = await Student.findOne({ id: req.params.id });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student' });
  }
});

// Read all students
app.get('/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// Update (U)
app.put('/students/:id', async (req, res) => {
  try {
    const updatedStudent = await Student.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json({ message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update student' });
  }
});

// Delete Student (Admin Only)
app.delete('/students/:id', isAdmin, async (req, res) => {
  try {
    const deletedStudent = await Student.findOneAndDelete({ id: req.params.id });
    if (!deletedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete student' });
  }
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.post('/students/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', async () => {
      try {
        let skippedRecords = 0;
        let addedRecords = 0;

        for (const student of results) {
          const { id, Fullname, DateofBirth, sex, age, purok, CivilStatus, citizenship, religion, phone } = student;

          if (!id || !Fullname || !DateofBirth || !sex || !age || !purok || !CivilStatus || !citizenship || !religion || !phone) {
            skippedRecords++;
            continue;
          }

          const existingStudent = await Student.findOne({ id });
          if (existingStudent) {
            skippedRecords++;
            continue;
          }

          const newStudent = new Student({ id, Fullname, DateofBirth, sex, age, purok, CivilStatus, citizenship, religion, phone });
          await newStudent.save();
          addedRecords++;
        }

        fs.unlinkSync(req.file.path);

        res.status(201).json({
          message: 'CSV data imported successfully',
          addedRecords,
          skippedRecords,
        });
      } catch (error) {
        res.status(500).json({ message: 'Failed to import CSV data' });
      }
    });
});

// Export as CSV
app.get('/students/export/csv', async (req, res) => {
  try {
    const students = await Student.find().lean();
    let csv = 'ID,Fullname,DateofBirth,Sex,Age,Purok,CivilStatus,Citizenship,Religion,Phone\n';
    
    students.forEach(student => {
      csv += `"${student.id}","${student.Fullname}","${student.DateofBirth}","${student.sex}",` +
             `"${student.age}","${student.purok}","${student.CivilStatus}",` +
             `"${student.citizenship}","${student.religion}","${student.phone}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('residents.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Failed to export CSV' });
  }
});

// Export as PDF
app.get('/students/export/pdf', async (req, res) => {
  try {
    const students = await Student.find().lean();
    const pdfDoc = require('pdfkit');
    const doc = new pdfDoc();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=residents.pdf');
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add title
    doc.fontSize(20).text('Barangay Tibanga Residents', { align: 'center' });
    doc.moveDown();
    
    // Create table
    const table = {
      headers: ['ID', 'Name', 'Birth Date', 'Sex', 'Age', 'Purok', 'Status', 'Citizenship', 'Religion', 'Phone'],
      rows: students.map(s => [
        s.id, s.Fullname, s.DateofBirth, s.sex, s.age, 
        s.purok, s.CivilStatus, s.citizenship, s.religion, s.phone
      ])
    };
    
    // Draw table
    doc.font('Helvetica-Bold');
    doc.fontSize(12);
    doc.text(table.headers.join(' | '));
    doc.moveDown();
    
    doc.font('Helvetica');
    table.rows.forEach(row => {
      doc.text(row.join(' | '));
      doc.moveDown();
    });
    
    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to export PDF' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});