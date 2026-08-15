/**
 * Bulk Upload Utilities
 * Helper functions for Excel file handling and validation
 */
import * as XLSX from 'xlsx';

export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function validateExcelFile(file) {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ];
  
  const validExtensions = ['.xlsx', '.xls'];
  
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }
  
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExtensions.includes(extension)) {
    return { valid: false, error: 'Only Excel files (.xlsx, .xls) are allowed' };
  }
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }
  
  return { valid: true };
}

export function formatValidationError(error) {
  // Format validation errors for display
  if (typeof error === 'string') {
    return error;
  }
  if (Array.isArray(error)) {
    return error.join(', ');
  }
  return String(error);
}

export function downloadErrorReport(errors, moduleName) {
  // Create a simple CSV error report
  const headers = ['Row', 'Error', 'Data'];
  const rows = errors.map(err => [
    err.row,
    Array.isArray(err.errors) ? err.errors.join('; ') : err.errors,
    JSON.stringify(err.data)
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { 
    type: 'text/csv;charset=utf-8;' 
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${moduleName}_errors.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}