
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { AiOutlineSearch, AiOutlineUpload, AiOutlineSortAscending, AiOutlineSortDescending, AiOutlineDownload,  AiOutlineQrcode  } from 'react-icons/ai';
import { QRCodeSVG } from 'qrcode.react'; // Updated import
import { saveAs } from 'file-saver';
import { Menu, MenuButton, MenuList, MenuItem, Button } from '@chakra-ui/react';
import { QRCode } from 'react-qr-code';

const ListResidents = ({
  students,
  fetchStudents,
  user,
  handleDelete,
  searchTerm,
  handleSearchChange,
}) => {
  const [file, setFile] = useState(null);
  const [editingId, setEditingId] = useState(null); // Track which row is being edited
  const [editingData, setEditingData] = useState({}); // Store temporary edited data
  const [sortAttribute, setSortAttribute] = useState('id'); // Attribute to sort by
  const [sortOrder, setSortOrder] = useState('asc'); // Sort order (asc or desc)
  const [showExportOptions, setShowExportOptions] = useState(false);
  const fileInputRef = useRef(null);
   const [qrCodeData, setQrCodeData] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const qrCodeRef = useRef(null);


  // Handle file input change
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5000/students/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success(response.data.message);
      fetchStudents();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error('Error uploading file');
    }
  };

   // Handle export
  const handleExport = async (format) => {
    try {
      const response = await axios.get(`http://localhost:5000/students/export/${format}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `residents.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    }
  };

  // Generate QR Code for a resident with formatted text
  const generateQRCode = (resident) => {
    // Format the data as plain text with labels
    const formattedData = `
ID: ${resident.id}
Fullname: ${resident.Fullname}
Date of Birth: ${resident.DateofBirth}
Sex: ${resident.sex}
Age: ${resident.age}
Purok: ${resident.purok}
Civil Status: ${resident.CivilStatus}
Citizenship: ${resident.citizenship}
Religion: ${resident.religion}
Phone: ${resident.phone}
Timestamp: ${new Date().toISOString()}
    `.trim(); // trim() removes any extra whitespace
    
    setQrCodeData({
      text: formattedData,
      residentId: resident.id
    });
    setShowQrModal(true);
  };

  // Download QR Code as PNG (updated to handle formatted text)
  const downloadQRCode = () => {
    if (!qrCodeRef.current) {
      toast.error('QR Code element not found');
      return;
    }
    
    try {
      const svg = qrCodeRef.current.querySelector('svg');
      if (!svg) {
        throw new Error('SVG element not found');
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          saveAs(blob, `resident-${qrCodeData.residentId}-qrcode.png`);
          toast.success('QR Code downloaded successfully!');
        }, 'image/png');
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
      toast.error(`Failed to download QR code: ${error.message}`);
    }
  };

  // Enable edit mode for a row
  const handleEdit = (resident) => {
    setEditingId(resident.id);
    setEditingData({ ...resident }); // Initialize editingData with the current resident data
  };

  // Handle input changes during editing
  const handleEditChange = (e, field) => {
    setEditingData({
      ...editingData,
      [field]: e.target.value,
    });
  };

  // Save edited data
  const handleSave = async () => {
    try {
      await axios.put(`http://localhost:5000/students/${editingId}`, editingData);
      toast.success('Resident updated successfully!');
      fetchStudents(); // Refresh the list
      setEditingId(null); // Exit edit mode
    } catch (error) {
      toast.error('Error updating resident');
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingId(null); // Exit edit mode
  };

  // Function to extract month name from a date string
  const getMonthNameFromDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return ''; // Return empty string if the date is invalid
    }
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[date.getMonth()]; // Get the month name
  };

  // Filter students based on search term and selected sort attribute
  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();

    // If search term is empty, return all students
    if (searchTerm === '') {
      return true;
    }

    // If "All" is selected, search across all fields
    if (sortAttribute === 'all') {
      const monthName = getMonthNameFromDate(student.DateofBirth).toLowerCase(); // Get month name from DateofBirth
      return (
        student.id.toString() === searchLower || // Exact match for ID
        student.Fullname.toLowerCase().includes(searchLower) ||
        student.sex.toLowerCase() === searchLower || // Exact match for sex
        student.age.toString() === searchLower || // Exact match for age
        student.purok.toLowerCase() === searchLower || // Exact match for purok
        student.CivilStatus.toLowerCase().includes(searchLower) ||
        student.citizenship.toLowerCase().includes(searchLower) ||
        student.religion.toLowerCase().includes(searchLower) ||
        student.DateofBirth.toLowerCase().includes(searchLower) || // Search for exact date
        student.DateofBirth.includes(searchLower) || // Search for month number (e.g., "01")
        monthName.includes(searchLower) // Search for month name (e.g., "January")
      );
    }

    // If "ID" is selected, search for exact match
    if (sortAttribute === 'id') {
      return student.id.toString() === searchLower; // Exact match for ID
    }

    // If "sex" is selected, search for exact match
    if (sortAttribute === 'sex') {
      return student.sex.toLowerCase() === searchLower; // Exact match for sex
    }

    // If "age" is selected, search for exact match
    if (sortAttribute === 'age') {
      return student.age.toString() === searchLower; // Exact match for age
    }

    // If "purok" is selected, search for exact match
    if (sortAttribute === 'purok') {
      return student.purok.toLowerCase() === searchLower; // Exact match for purok
    }

    // If "DateofBirth" is selected, search by exact day, month, or year
    if (sortAttribute === 'DateofBirth') {
      const dateParts = student.DateofBirth.split('-'); // Split date into parts (assuming YYYY-MM-DD format)
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      const monthName = getMonthNameFromDate(student.DateofBirth).toLowerCase(); // Get month name from DateofBirth

      return (
        day === searchLower || // Exact match for day
        month === searchLower || // Exact match for month number
        year === searchLower || // Exact match for year
        monthName.includes(searchLower) // Search for month name (e.g., "January")
      );
    }

    // Otherwise, search only in the selected attribute
    const fieldValue = student[sortAttribute]?.toString().toLowerCase() || '';
    return fieldValue.includes(searchLower);
  });

  // Sort filtered students by ID (ascending) numerically
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    // Convert IDs to numbers for numerical sorting
    const idA = Number(a.id);
    const idB = Number(b.id);

    if (idA < idB) return -1;
    if (idA > idB) return 1;
    return 0;
  });

  return (
    <div className="main-content">
      <h2>LIST OF RESIDENTS</h2>
      {/* Flex container for CSV upload, sorting, and search */}
      <div className="action-container">
        {/* Compact CSV Upload Section */}
        <div className="csv-upload-container">
          <label htmlFor="csv-upload" className="file-upload-label">
            <AiOutlineUpload className="upload-icon" />
            <span>Add File</span>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
          </label>
          <button className="file-upload-button" onClick={handleFileUpload}>
            <AiOutlineUpload className="upload-icon" />
            <span>Upload CSV</span>
          </button>
          {file && (
            <div className="file-upload-status">
              <strong>Selected file:</strong> {file.name}
            </div>
          )}
        </div>

 {/* Export Section */}
       <div className="export-container">
  <button 
    className="export-button"
    onClick={() => setShowExportOptions(!showExportOptions)}
  >
    <AiOutlineDownload className="icon" />
    Export Residents
  </button>
  
  {showExportOptions && (
    <div className="export-options">
      <div 
        className="export-option"
        onClick={() => {
          handleExport('csv');
          setShowExportOptions(false);
        }}
      >
        Export as CSV
      </div>
      <div 
        className="export-option"
        onClick={() => {
          handleExport('pdf');
          setShowExportOptions(false);
        }}
      >
        Export as PDF
      </div>
    </div>
  )}
</div>

        {/* Sorting Section */}
        <div className="sort-container">
          <select
            value={sortAttribute}
            onChange={(e) => {
              setSortAttribute(e.target.value);
              // If "ID" is selected, force ascending order
              if (e.target.value === 'id') setSortOrder('asc');
            }}
            className="sort-select"
          >
            <option value="all">All</option>
            <option value="id">ID</option>
            <option value="Fullname">Full Name</option>
            <option value="DateofBirth">Date of Birth</option>
            <option value="sex">Sex</option>
            <option value="age">Age</option>
            <option value="purok">Purok</option>
            <option value="CivilStatus">Civil Status</option>
            <option value="citizenship">Citizenship</option>
            <option value="religion">Religion</option>
          </select>
          {/* Hide sort order button if "All" or "ID" is selected */}
          {sortAttribute !== 'all' && sortAttribute !== 'id' && (
            <button
              className="sort-order-button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <AiOutlineSortAscending /> : <AiOutlineSortDescending />}
            </button>
          )}
        </div>
        {/* Search Section */}
        <div className="search-container">
          <AiOutlineSearch className="search-icon" />
          <input
            type="text"
            placeholder={
              sortAttribute === 'all'
                ? 'Search by ID (exact match), Name, Date of Birth (e.g., 24, 01, 2024, or January), Sex (exact match), Age (exact match), Purok (exact match), Civil Status, Citizenship, or Religion...'
                : `Search by ${sortAttribute}...`
            }
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Full Name</th>
            <th>Date of Birth</th>
            <th>Sex</th>
            <th>Age</th>
            <th>Purok</th>
            <th>Civil Status</th>
            <th>Citizenship</th>
            <th>Religion</th>
            <th>Phone</th>
            {user.role === 'admin' && <th>Actions</th> || user.role === 'user' && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sortedStudents.length > 0 ? (
            sortedStudents.map((resident) => (
              <tr key={resident.id}>
                <td>{resident.id}</td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.Fullname || ''}
                      onChange={(e) => handleEditChange(e, 'Fullname')}
                    />
                  ) : (
                    resident.Fullname
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.DateofBirth || ''}
                      onChange={(e) => handleEditChange(e, 'DateofBirth')}
                    />
                  ) : (
                    resident.DateofBirth
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.sex || ''}
                      onChange={(e) => handleEditChange(e, 'sex')}
                    />
                  ) : (
                    resident.sex
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="number"
                      className="edit-input"
                      value={editingData.age || ''}
                      onChange={(e) => handleEditChange(e, 'age')}
                    />
                  ) : (
                    resident.age
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.purok || ''}
                      onChange={(e) => handleEditChange(e, 'purok')}
                    />
                  ) : (
                    resident.purok
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.CivilStatus || ''}
                      onChange={(e) => handleEditChange(e, 'CivilStatus')}
                    />
                  ) : (
                    resident.CivilStatus
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.citizenship || ''}
                      onChange={(e) => handleEditChange(e, 'citizenship')}
                    />
                  ) : (
                    resident.citizenship
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.religion || ''}
                      onChange={(e) => handleEditChange(e, 'religion')}
                    />
                  ) : (
                    resident.religion
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <input
                      type="text"
                      className="edit-input"
                      value={editingData.phone || ''}
                      onChange={(e) => handleEditChange(e, 'phone')}
                    />
                  ) : (
                    resident.phone
                  )}
                </td>
                <td>
                  {editingId === resident.id ? (
                    <>
                      <button className="save" onClick={handleSave}>
                        Save
                      </button>
                      <button className="cancel" onClick={handleCancel}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="edit" onClick={() => handleEdit(resident)}>
                        Edit
                      </button>

                      <button 
                        className="qr-code" 
                        onClick={() => generateQRCode(resident)}
                        style={{ background: '#4CAF50', margin: '5px' }}
                      >
                        <AiOutlineQrcode /> QR
                      </button>

                      {user.role === 'admin' && (
                        <button className="delete" onClick={() => handleDelete(resident.id)}>
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={user.role === 'admin' ? 11 : 10} style={{ textAlign: 'center' }}>
                No residents found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

            {/* QR Code Modal */}
      {showQrModal && qrCodeData && (
        <div className="qr-modal">
          <div className="qr-modal-content" ref={qrCodeRef}>
            <h3>QR Code for Resident ID: {qrCodeData.residentId}</h3>
            <QRCode 
  value={qrCodeData.text}
  size={256}
  level="H"
  includeMargin={true}
/>
            <div className="qr-modal-actions">
              <button onClick={downloadQRCode}>Download QR Code</button>
              <button onClick={() => setShowQrModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListResidents;