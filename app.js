// Required dependencies
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
const port = 3000;
const cors = require('cors');
app.use(cors());

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});


mongoose.connect('mongodb://localhost:27017/file-upload-service', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});


const FileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  size: Number,
  mimetype: String,
  uploadDate: { type: Date, default: Date.now },
  path: String,
  s3Key: String,
  isPublic: { type: Boolean, default: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [String],
  description: String,
  downloads: { type: Number, default: 0 }
});


FileSchema.index({ originalName: 'text', description: 'text', tags: 'text' });

const User = mongoose.model('User', UserSchema);
const File = mongoose.model('File', FileSchema);


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});


const s3Storage = multer.memoryStorage();


const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and PDF files are allowed.'), false);
  }
};


const upload = multer({
  storage: process.env.STORAGE_TYPE === 's3' ? s3Storage : storage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: fileFilter
});


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};


app.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      password: hashedPassword,
      email
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: `Error registering user : ${error}` });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});


app.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let fileData = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user.userId,
      description: req.body.description || '',
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      isPublic: req.body.isPublic === 'true'
    };

    if (process.env.STORAGE_TYPE === 's3') {
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `uploads/${Date.now()}-${req.file.originalname}`,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      };

      const s3Upload = await s3.upload(s3Params).promise();
      fileData.s3Key = s3Upload.Key;
      fileData.path = s3Upload.Location;
    } else {
      fileData.filename = req.file.filename;
      fileData.path = req.file.path;
    }

    const fileMetadata = new File(fileData);
    await fileMetadata.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      file: fileMetadata
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error uploading file'
    });
  }
});

app.get('/download/:id', async (req, res) => {
  try {
    console.log(req.user)
    const file = await File.findById(req.params.id).populate('uploadedBy', 'username');
    console.log(file)
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!file.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (process.env.STORAGE_TYPE === 's3') {
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: file.s3Key
      };

      const s3Object = await s3.getObject(s3Params).promise();
      res.set('Content-Type', file.mimetype);
      res.set('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.send(s3Object.Body);
    } else {
      res.download(file.path, file.originalName);
    }

    file.downloads += 1;
    await file.save();
  } catch (error) {
    res.status(500).json({
      error: `Error downloading file : ${error}`
    });
  }
});


app.delete('/delete/:id', authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (process.env.STORAGE_TYPE === 's3') {
      const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: file.s3Key
      };

      await s3.deleteObject(s3Params).promise();
    } else {
      fs.unlinkSync(file.path);
    }

    await File.findByIdAndDelete(req.params.id);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Error deleting file'
    });
  }
});

app.get('/files', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const tag = req.query.tag;
    const type = req.query.type;
    const sortBy = req.query.sortBy || 'uploadDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {
      $or: [
        { uploadedBy: req.user.userId },
        { isPublic: true }
      ]
    };

    if (search) {
      query.$text = { $search: search };
    }

    if (tag) {
      query.tags = tag;
    }

    if (type) {
      query.mimetype = type;
    }

    const sort = { [sortBy]: sortOrder };

    const files = await File.find(query)
      .populate('uploadedBy', 'username')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await File.countDocuments(query);

    res.json({
      files,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalFiles: total
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error listing files'
    });
  }
});

app.patch('/files/:id', authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allowedUpdates = ['description', 'tags', 'isPublic'];
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    Object.assign(file, updates);
    await file.save();

    res.json({ message: 'File updated successfully', file });
  } catch (error) {
    res.status(500).json({
      error: 'Error updating file'
    });
  }
});


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File size too large. Maximum size is 5MB.'
      });
    }
  }
  console.error(err);
  res.status(500).json({
    error: err.message
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});