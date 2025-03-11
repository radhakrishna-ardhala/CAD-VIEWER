const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { STLLoader } = require('three/examples/jsm/loaders/STLLoader');
const { OBJLoader } = require('three/examples/jsm/loaders/OBJLoader');
const THREE = require('three');

const app = express();
const port = 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from React frontend
}));
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('File uploaded:', req.file);
    res.status(200).json({ message: 'File uploaded successfully', filename: req.file.filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Server error during upload' });
  }
});

// Export endpoint
app.post('/api/export', upload.single('file'), (req, res) => {
  try {
    const { fromFormat, toFormat } = req.body;
    if (!req.file || !fromFormat || !toFormat) {
      return res.status(400).json({ error: 'Missing file or format parameters' });
    }

    console.log(`Converting from ${fromFormat} to ${toFormat}`);

    // Simple pass-through for demonstration (no real conversion yet)
    const fileBuffer = require('fs').readFileSync(req.file.path);
    res.setHeader('Content-Disposition', `attachment; filename=model.${toFormat}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer);

    // Clean up uploaded file
    require('fs').unlinkSync(req.file.path);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Server error during export' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});