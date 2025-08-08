# Army Project - XML Processing System

A comprehensive system for managing army records with XML file processing, validation, Excel conversion, and MongoDB integration.

## 🚀 **Features Implemented**

### ✅ **Core Functionality**
- **XML File Upload & Processing**: Drag-and-drop interface with validation
- **XSD-like Validation**: Custom validation rules for army records
- **Excel Conversion**: Automatic conversion of invalid records to Excel format
- **Re-upload System**: Upload corrected Excel files for reprocessing
- **MongoDB Integration**: Store and manage soldier records in database
- **Processing Logs**: Track all file processing activities
- **Real-time Dashboard**: Live statistics and record management

### ✅ **API Endpoints**
- `POST /api/upload-xml` - Upload and process XML files
- `GET /api/download-invalid/:filename` - Download invalid Excel files
- `POST /api/reupload-corrected` - Re-upload corrected Excel files
- `GET /api/records` - Get all records summary with MongoDB stats
- `GET /api/logs` - Get processing logs
- `GET /api/soldiers` - Get soldiers from MongoDB with pagination

### ✅ **Frontend Features**
- **Tabbed Interface**: Organized sections for different functionalities
- **Drag & Drop**: Modern file upload experience
- **Real-time Updates**: Live statistics and processing status
- **Excel Downloads**: One-click download of invalid records
- **Responsive Design**: Works on desktop and mobile devices

## 📁 **Project Structure**

```
army-project1/
├── client/                    # React frontend
│   ├── src/
│   │   ├── App.js            # Main React component with tabs
│   │   └── App.css           # Modern styling with tabs
│   ├── public/
│   └── package.json
├── server/                    # Node.js backend
│   ├── server.js             # Enhanced Express server
│   ├── army_schema.xsd       # XSD schema for validation
│   ├── uploads/              # Temporary file uploads
│   ├── validated_records/    # Successfully processed records
│   ├── invalid_records/      # Records that failed validation
│   ├── corrected/            # Records that were corrected
│   ├── excel_exports/        # Generated Excel files
│   └── package.json
├── sample.xml                # Sample valid XML file
├── invalid_sample.xml        # Sample invalid XML file
├── .env                      # Environment variables
└── README.md                 # This file
```

## 🛠️ **Setup Instructions**

### **Prerequisites**
- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### **Step 1: Clone and Install Dependencies**

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### **Step 2: Configure Environment Variables**

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/army-project
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/army-project

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./server/uploads
VALIDATED_PATH=./server/validated_records
INVALID_PATH=./server/invalid_records
CORRECTED_PATH=./server/corrected
EXCEL_EXPORTS_PATH=./server/excel_exports

# Security
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# API Configuration
API_BASE_URL=http://localhost:5000/api
```

### **Step 3: Start MongoDB**

**Local MongoDB:**
```bash
# Start MongoDB service
mongod
```

**MongoDB Atlas:**
- Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
- Get your connection string and update `MONGODB_URI` in `.env`

### **Step 4: Start the Application**

```bash
# Start backend server (Terminal 1)
cd server
npm start

# Start frontend (Terminal 2)
cd client
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 📋 **Usage Guide**

### **1. Upload XML Files**
- Go to the "Upload XML" tab
- Drag and drop XML files or click to select
- Files are automatically validated and processed
- Valid records are saved to MongoDB
- Invalid records are exported to Excel

### **2. Download Invalid Records**
- Go to the "Records" tab
- Find Excel exports in the "Excel Exports" section
- Click "Download" to get the Excel file with invalid records

### **3. Re-upload Corrected Excel**
- Go to the "Re-upload Excel" tab
- Select the corrected Excel file
- System converts Excel to XML and validates again
- Valid records are saved to MongoDB

### **4. View Records and Logs**
- **Records Tab**: View file processing statistics and MongoDB data
- **Logs Tab**: View detailed processing logs with errors
- **Soldiers DB Tab**: View all soldiers stored in MongoDB

## 🔧 **XML Format Requirements**

Your XML files must follow this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<army_records>
  <soldier>
    <id>001</id>
    <name>John Smith</name>
    <rank>Sergeant</rank>
    <unit>Alpha Company</unit>
    <service_date>2020-01-15</service_date>
    <status>Active</status>
  </soldier>
  <!-- More soldiers... -->
</army_records>
```

### **Validation Rules**
- Root element must be `<army_records>`
- Each soldier must have: `id`, `name`, `rank`, `unit`, `service_date`, `status`
- Status must be one of: `Active`, `Retired`, `Deceased`
- Service date must be in YYYY-MM-DD format

## 📊 **Excel Export Format**

Invalid records are exported to Excel with these columns:
- ID
- Name
- Rank
- Unit
- Service Date
- Status
- Remarks (error details)

## 🚀 **API Documentation**

### **Upload XML File**
```bash
POST /api/upload-xml
Content-Type: multipart/form-data

Form Data:
- xmlFile: XML file
```

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully",
  "filename": "file-123.xml",
  "status": "validated",
  "valid_count": 3,
  "invalid_count": 0
}
```

### **Download Invalid Excel**
```bash
GET /api/download-invalid/:filename
```

### **Re-upload Corrected Excel**
```bash
POST /api/reupload-corrected
Content-Type: multipart/form-data

Form Data:
- excelFile: Excel file
```

### **Get Records Summary**
```bash
GET /api/records
```

**Response:**
```json
{
  "validated": ["file1.xml", "file2.xml"],
  "invalid": ["file3.xml"],
  "corrected": ["file4.xlsx"],
  "excel_exports": ["file3_invalid.xlsx"],
  "total": 4,
  "mongo_stats": {
    "total_soldiers": 15,
    "active_soldiers": 12
  }
}
```

## 🛡️ **Error Handling**

The system handles various error scenarios:
- **Invalid XML**: Files are moved to invalid_records and Excel export is created
- **Missing Fields**: Validation errors are logged with specific details
- **Database Errors**: Individual record errors are logged without stopping processing
- **File Size Limits**: Configurable maximum file size (default: 10MB)

## 🔄 **Processing Flow**

1. **Upload XML** → Validate → Save to MongoDB (if valid) or Export to Excel (if invalid)
2. **Download Excel** → Correct data → Re-upload Excel → Convert to XML → Validate → Save to MongoDB
3. **View Records** → Check processing status and download files
4. **Monitor Logs** → Track all processing activities and errors

## 🎯 **Testing**

Use the provided sample files:
- `sample.xml` - Valid army records for testing
- `invalid_sample.xml` - Invalid records to test error handling

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License.

## 🆘 **Troubleshooting**

### **MongoDB Connection Issues**
- Ensure MongoDB is running locally or Atlas connection string is correct
- Check firewall settings for Atlas connections
- Verify network connectivity

### **File Upload Issues**
- Check file size limits in `.env`
- Ensure file is valid XML format
- Check server logs for detailed error messages

### **Excel Download Issues**
- Ensure Excel files are generated in `excel_exports` directory
- Check file permissions
- Verify API endpoint is accessible

---

**🎉 Your Army Project is now ready with full XML processing capabilities!** 