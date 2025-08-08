const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { XMLParser } = require('fast-xml-parser');
const xml2js = require('xml2js');
const ExcelJS = require('exceljs');
const js2xmlparser = require('js2xmlparser');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/army-project';

// Initialize database connection status
const initializeDbConnection = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    updateDbStatus();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    updateDbStatus();
  }
};

// Soldier Schema
const soldierSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rank: { type: String, required: true },
  unit: { type: String, required: true },
  service_date: { type: Date, required: true },
  status: { type: String, required: true, enum: ['Active', 'Retired', 'Deceased'] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Soldier = mongoose.model('Soldier', soldierSchema);

// Processing Log Schema
const processingLogSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  status: { type: String, required: true, enum: ['validated', 'invalid', 'corrected'] },
  valid_count: { type: Number, default: 0 },
  invalid_count: { type: Number, default: 0 },
  errors: [String],
  processed_at: { type: Date, default: Date.now }
});

const ProcessingLog = mongoose.model('ProcessingLog', processingLogSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection status tracking
let dbConnectionStatus = {
  connected: false,
  lastChecked: null,
  error: null
};

// Update database connection status
const updateDbStatus = async () => {
  try {
    // Check if mongoose is connected first
    if (mongoose.connection.readyState !== 1) {
      dbConnectionStatus.connected = false;
      dbConnectionStatus.error = 'Mongoose not connected';
      dbConnectionStatus.lastChecked = new Date();
      return;
    }

    // Actually test the connection by running a simple query
    try {
      await mongoose.connection.db.admin().ping();
      dbConnectionStatus.connected = true;
      dbConnectionStatus.error = null;
    } catch (pingError) {
      // If ping fails, try a simple find operation
      try {
        await Soldier.findOne().limit(1);
        dbConnectionStatus.connected = true;
        dbConnectionStatus.error = null;
      } catch (findError) {
        dbConnectionStatus.connected = false;
        dbConnectionStatus.error = 'Database connection test failed';
      }
    }
  } catch (error) {
    dbConnectionStatus.connected = false;
    dbConnectionStatus.error = error.message;
  }
  dbConnectionStatus.lastChecked = new Date();
  console.log('Database status updated:', dbConnectionStatus.connected, dbConnectionStatus.error);
};



// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    // Test 1: Check mongoose readyState
    const readyState = mongoose.connection.readyState;
    console.log('Mongoose readyState:', readyState);
    
    if (readyState !== 1) {
      return res.json({ 
        connected: false, 
        error: `Mongoose not ready. State: ${readyState}`,
        readyState: readyState
      });
    }
    
    // Test 2: Try to ping the database
    try {
      await mongoose.connection.db.admin().ping();
      console.log('Database ping successful');
    } catch (pingError) {
      console.log('Database ping failed:', pingError.message);
      return res.json({ 
        connected: false, 
        error: `Database ping failed: ${pingError.message}`,
        readyState: readyState
      });
    }
    
    // Test 3: Try a simple query
    try {
      const count = await Soldier.countDocuments();
      console.log('Database query successful, count:', count);
    } catch (queryError) {
      console.log('Database query failed:', queryError.message);
      return res.json({ 
        connected: false, 
        error: `Database query failed: ${queryError.message}`,
        readyState: readyState
      });
    }
    
    res.json({ 
      connected: true, 
      error: null,
      readyState: readyState
    });
    
  } catch (error) {
    console.error('Test DB error:', error);
    res.json({ 
      connected: false, 
      error: error.message,
      readyState: mongoose.connection.readyState
    });
  }
});

// Check database connection status
app.get('/api/db-status', async (req, res) => {
  await updateDbStatus();
  res.json({
    connected: dbConnectionStatus.connected,
    lastChecked: dbConnectionStatus.lastChecked,
    error: dbConnectionStatus.error
  });
});

// Connect to database
app.post('/api/db-connect', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      return res.json({ success: true, message: 'Database already connected' });
    }
    
    await mongoose.connect(MONGODB_URI);
    await updateDbStatus();
    res.json({ success: true, message: 'Database connected successfully' });
  } catch (error) {
    await updateDbStatus();
    res.status(500).json({ success: false, message: 'Failed to connect to database', error: error.message });
  }
});

// Disconnect from database
app.post('/api/db-disconnect', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 0) {
      return res.json({ success: true, message: 'Database already disconnected' });
    }
    
    await mongoose.disconnect();
    await updateDbStatus();
    res.json({ success: true, message: 'Database disconnected successfully' });
  } catch (error) {
    await updateDbStatus();
    res.status(500).json({ success: false, message: 'Failed to disconnect from database', error: error.message });
  }
});

// Export database to Excel
app.get('/api/export-excel', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Database not connected' });
    }

    const soldiers = await Soldier.find({});
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Army Data');
    
    // Add headers
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Rank', key: 'rank', width: 15 },
      { header: 'Unit', key: 'unit', width: 20 },
      { header: 'Service Date', key: 'service_date', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 }
    ];
    
    // Add data
    soldiers.forEach(soldier => {
      worksheet.addRow({
        id: soldier.id,
        name: soldier.name,
        rank: soldier.rank,
        unit: soldier.unit,
        service_date: soldier.service_date.toISOString().split('T')[0],
        status: soldier.status,
        created_at: soldier.created_at.toISOString().split('T')[0]
      });
    });
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=army_data.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({ success: false, message: 'Failed to export data to Excel', error: error.message });
  }
});

// Convert Excel to XML
app.post('/api/excel-to-xml', async (req, res) => {
  try {
    // This endpoint would handle Excel to XML conversion
    // For now, return a success message
    res.json({ success: true, message: 'Excel to XML conversion endpoint ready' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to convert Excel to XML', error: error.message });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/xml' || file.mimetype === 'text/xml' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only XML and Excel files are allowed!'), false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Ensure directories exist
const ensureDirectories = async () => {
  const dirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'validated_records'),
    path.join(__dirname, 'invalid_records'),
    path.join(__dirname, 'corrected'),
    path.join(__dirname, 'excel_exports')
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
};

// XSD Schema Validation Rules
const validateAgainstXSD = (xmlData) => {
  const validationErrors = [];
  const soldiers = Array.isArray(xmlData.army_records?.soldier) 
    ? xmlData.army_records.soldier 
    : xmlData.army_records?.soldier ? [xmlData.army_records.soldier] : [];

  // Root element validation
  if (!xmlData.army_records) {
    validationErrors.push('XSD VIOLATION: Root element must be "army_records"');
    return { isValid: false, errors: validationErrors, soldiers: [] };
  }

  if (!soldiers.length) {
    validationErrors.push('XSD VIOLATION: At least one soldier record is required');
    return { isValid: false, errors: validationErrors, soldiers: [] };
  }

  // Validate each soldier against XSD schema
  soldiers.forEach((soldier, index) => {
    const soldierIndex = index + 1;
    
    // Required fields validation
    if (!soldier.id) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Missing required field: ID`);
    } else if (typeof soldier.id !== 'string') {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - ID must be a string`);
    }

    if (!soldier.name) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Missing required field: Name`);
    } else if (typeof soldier.name !== 'string') {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Name must be a string`);
    }

    if (!soldier.rank) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Missing required field: Rank`);
    } else if (typeof soldier.rank !== 'string') {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Rank must be a string`);
    }

    if (!soldier.unit) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Missing required field: Unit`);
    } else if (typeof soldier.unit !== 'string') {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Unit must be a string`);
    }

    if (!soldier.service_date) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Missing required field: Service Date`);
    } else {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(soldier.service_date)) {
        validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Service Date must be in YYYY-MM-DD format`);
      } else {
        // Validate if it's a valid date
        const date = new Date(soldier.service_date);
        if (isNaN(date.getTime())) {
          validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Invalid date: ${soldier.service_date}`);
        }
      }
    }

    if (!soldier.status) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Missing required field: Status`);
    } else if (!['Active', 'Retired', 'Deceased'].includes(soldier.status)) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Status must be one of: Active, Retired, Deceased (got: ${soldier.status})`);
    }

    // Additional business rules
    if (soldier.id && soldier.id.length > 50) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - ID length exceeds maximum (50 characters)`);
    }

    if (soldier.name && soldier.name.length > 100) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Name length exceeds maximum (100 characters)`);
    }

    if (soldier.rank && soldier.rank.length > 50) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Rank length exceeds maximum (50 characters)`);
    }

    if (soldier.unit && soldier.unit.length > 100) {
      validationErrors.push(`XSD VIOLATION: Soldier ${soldierIndex} - Unit length exceeds maximum (100 characters)`);
    }
  });

  return {
    isValid: validationErrors.length === 0,
    errors: validationErrors,
    soldiers: soldiers
  };
};

// XML validation function with XSD schema validation
const validateXML = (xmlContent) => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
    const result = parser.parse(xmlContent);
    
    // Validate against XSD schema
    const validation = validateAgainstXSD(result);
    
    return { 
      isValid: validation.isValid, 
      data: result, 
      errors: validation.errors,
      soldiers: validation.soldiers
    };
  } catch (error) {
    return { 
      isValid: false, 
      data: null, 
      errors: [`XML PARSE ERROR: ${error.message}`],
      soldiers: []
    };
  }
};

// Convert invalid records to Excel with detailed schema violation remarks
const createInvalidExcel = async (invalidRecords, filename, validationErrors) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Schema Validation Errors');
  
  // Add headers
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 15 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Rank', key: 'rank', width: 20 },
    { header: 'Unit', key: 'unit', width: 25 },
    { header: 'Service Date', key: 'service_date', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Schema Violations', key: 'remarks', width: 50 }
  ];
  
  // Add data with specific schema violation details
  invalidRecords.forEach((record, index) => {
    // Find errors specific to this soldier
    const soldierErrors = validationErrors.filter(error => 
      error.includes(`Soldier ${index + 1}`) || 
      (error.includes('Root element') && index === 0) ||
      (error.includes('At least one soldier') && index === 0)
    );
    
    const remarks = soldierErrors.length > 0 
      ? soldierErrors.join('; ')
      : 'General validation error';
    
    worksheet.addRow({
      id: record.id || '',
      name: record.name || '',
      rank: record.rank || '',
      unit: record.unit || '',
      service_date: record.service_date || '',
      status: record.status || '',
      remarks: remarks
    });
  });
  
  // Add summary of all validation errors
  if (validationErrors.length > 0) {
    worksheet.addRow([]); // Empty row
    worksheet.addRow(['', '', '', '', '', '', 'ALL SCHEMA VIOLATIONS:']);
    validationErrors.forEach(error => {
      worksheet.addRow(['', '', '', '', '', '', error]);
    });
  }
  
  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Style error rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && row.getCell(7).value) { // If has remarks
      row.getCell(7).font = { color: { argb: 'FFFF0000' }, bold: true };
    }
  });
  
  const excelPath = path.join(__dirname, 'excel_exports', `${filename}_schema_errors.xlsx`);
  await workbook.xlsx.writeFile(excelPath);
  return excelPath;
};

// Parse Excel and convert to XML
const parseExcelToXML = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet(1);
  const records = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip header row
      const record = {
        id: row.getCell(1).value?.toString() || '',
        name: row.getCell(2).value?.toString() || '',
        rank: row.getCell(3).value?.toString() || '',
        unit: row.getCell(4).value?.toString() || '',
        service_date: row.getCell(5).value?.toString() || '',
        status: row.getCell(6).value?.toString() || ''
      };
      
      if (record.id && record.name) { // Only add if has basic info
        records.push(record);
      }
    }
  });
  
  // Convert to XML
  const xmlData = {
    army_records: {
      soldier: records
    }
  };
  
  const xml = js2xmlparser.parse('army_records', xmlData);
  return xml;
};

// Save valid records to MongoDB
const saveToMongoDB = async (validRecords) => {
  const soldiers = Array.isArray(validRecords) ? validRecords : [validRecords];
  const savedRecords = [];
  
  for (const soldier of soldiers) {
    try {
      const existingSoldier = await Soldier.findOne({ id: soldier.id });
      if (existingSoldier) {
        // Update existing record
        Object.assign(existingSoldier, soldier);
        existingSoldier.updated_at = new Date();
        await existingSoldier.save();
        savedRecords.push(existingSoldier);
      } else {
        // Create new record
        const newSoldier = new Soldier(soldier);
        await newSoldier.save();
        savedRecords.push(newSoldier);
      }
    } catch (error) {
      console.error(`Error saving soldier ${soldier.id}:`, error);
    }
  }
  
  return savedRecords;
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Army Project XML Processing Server with XSD Schema Validation' });
});

// Upload and process XML file with XSD validation
app.post('/api/upload-xml', upload.single('xmlFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const xmlContent = await fs.readFile(filePath, 'utf8');
    
    // Validate XML against XSD schema
    const validation = validateXML(xmlContent);
    
    if (validation.isValid) {
      // Save to MongoDB
      const savedRecords = await saveToMongoDB(validation.soldiers);
      
      // Move to corrected records (schema validated)
      const correctedPath = path.join(__dirname, 'corrected', req.file.filename);
      await fs.move(filePath, correctedPath);
      
      // Log processing
      await ProcessingLog.create({
        filename: req.file.originalname,
        status: 'corrected',
        valid_count: savedRecords.length,
        invalid_count: 0
      });
      
      res.json({
        success: true,
        message: 'File validated against XSD schema successfully',
        filename: req.file.filename,
        status: 'corrected',
        valid_count: savedRecords.length,
        invalid_count: 0
      });
    } else {
      // Create Excel file with detailed schema violation remarks
      const excelPath = await createInvalidExcel(
        validation.soldiers, 
        req.file.filename, 
        validation.errors
      );
      
      // Move to invalid records
      const invalidPath = path.join(__dirname, 'invalid_records', req.file.filename);
      await fs.move(filePath, invalidPath);
      
      // Log processing
      await ProcessingLog.create({
        filename: req.file.originalname,
        status: 'invalid',
        valid_count: 0,
        invalid_count: validation.soldiers.length,
        errors: validation.errors
      });
      
      res.status(400).json({
        success: false,
        message: 'XSD Schema validation failed',
        filename: req.file.filename,
        status: 'invalid',
        valid_count: 0,
        invalid_count: validation.soldiers.length,
        errors: validation.errors,
        excel_file: path.basename(excelPath)
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download invalid Excel file
app.get('/api/download-invalid/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'excel_exports', filename);
    
    if (await fs.pathExists(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error downloading file' });
  }
});

// Re-upload corrected Excel file
app.post('/api/reupload-corrected', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    
    // Convert Excel to XML
    const xmlContent = await parseExcelToXML(filePath);
    
    // Validate the converted XML against XSD schema
    const validation = validateXML(xmlContent);
    
    if (validation.isValid) {
      // Save to MongoDB
      const savedRecords = await saveToMongoDB(validation.soldiers);
      
      // Move to corrected records
      const correctedPath = path.join(__dirname, 'corrected', req.file.filename);
      await fs.move(filePath, correctedPath);
      
      // Log processing
      await ProcessingLog.create({
        filename: req.file.originalname,
        status: 'corrected',
        valid_count: savedRecords.length,
        invalid_count: 0
      });
      
      res.json({
        success: true,
        message: 'Corrected file validated against XSD schema successfully',
        filename: req.file.filename,
        status: 'corrected',
        valid_count: savedRecords.length,
        invalid_count: 0
      });
    } else {
      // Create new Excel with remaining errors
      const excelPath = await createInvalidExcel(
        validation.soldiers, 
        req.file.filename, 
        validation.errors
      );
      
      // Move to invalid records
      const invalidPath = path.join(__dirname, 'invalid_records', req.file.filename);
      await fs.move(filePath, invalidPath);
      
      res.status(400).json({
        success: false,
        message: 'Corrected file still has XSD schema violations',
        filename: req.file.filename,
        status: 'invalid',
        errors: validation.errors,
        excel_file: path.basename(excelPath)
      });
    }
  } catch (error) {
    console.error('Re-upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all records
app.get('/api/records', async (req, res) => {
  try {
    const validatedFiles = await fs.readdir(path.join(__dirname, 'validated_records'));
    const invalidFiles = await fs.readdir(path.join(__dirname, 'invalid_records'));
    const correctedFiles = await fs.readdir(path.join(__dirname, 'corrected'));
    const excelFiles = await fs.readdir(path.join(__dirname, 'excel_exports'));
    
    // Get MongoDB counts
    const totalSoldiers = await Soldier.countDocuments();
    const activeSoldiers = await Soldier.countDocuments({ status: 'Active' });
    
    res.json({
      validated: validatedFiles,
      invalid: invalidFiles,
      corrected: correctedFiles,
      excel_exports: excelFiles,
      total: validatedFiles.length + invalidFiles.length + correctedFiles.length,
      mongo_stats: {
        total_soldiers: totalSoldiers,
        active_soldiers: activeSoldiers
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error reading records' });
  }
});

// Get processing logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await ProcessingLog.find().sort({ processed_at: -1 }).limit(50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Error reading logs' });
  }
});

// Get soldiers from MongoDB
app.get('/api/soldiers', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, unit } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (unit) query.unit = { $regex: unit, $options: 'i' };
    
    const soldiers = await Soldier.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ created_at: -1 });
    
    const total = await Soldier.countDocuments(query);
    
    res.json({
      soldiers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching soldiers' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
  try {
    await ensureDirectories();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Upload directory: ${path.join(__dirname, 'uploads')}`);
      console.log('XSD Schema validation enabled');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize database connection
initializeDbConnection();

startServer(); 