import React, { useState, useRef } from "react";
import { Upload, Download, X, CheckCircle, AlertCircle, FileText, Loader2 } from "lucide-react";
import API from "../services/api";
import { validateExcelFile, downloadErrorReport } from "../utils/bulkUploadUtils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

function BulkUploadModal({ module, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Template, 2: Upload, 3: Processing, 4: Results
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const moduleNames = {
    customers: "Customers",
    employees: "Employees", 
    services: "Services",
    products: "Products"
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_BASE}/bulk-upload/template/${module}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${module}_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setStep(2);
    } catch (err) {
      setError("Failed to download template. Please try again.");
    }
  };

  const handleFileSelect = (file) => {
    setError(null);
    const validation = validateExcelFile(file);
    
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    setUploading(true);
    setError(null);
    setStep(3);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await API.post(`/bulk-upload/${module}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const resData = response?.data || response;
      setResults(resData);
      setStep(4);
      
      if (resData && resData.successful > 0) {
        onSuccess && onSuccess();
      }
    } catch (err) {
      console.error("[BulkUploadModal] Upload Error:", err);
      const errMsg = err?.message || err?.response?.data?.message || err?.error || "Upload failed. Please check file formatting and try again.";
      setError(errMsg);
      setStep(2);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (results && results.validation_errors) {
      downloadErrorReport(results.validation_errors, module);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResults(null);
    setError(null);
    setStep(1);
  };

  const handleClose = () => {
    onClose();
    handleReset();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Bulk Upload {moduleNames[module]}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="py-6 space-y-6">
              <div className="bg-pink-50/60 border border-pink-100 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Download className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  Need an Excel Template?
                </h3>
                <p className="text-xs text-gray-600 mb-4 max-w-md mx-auto">
                  Download the template file pre-formatted with clean column titles and validation guidelines.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-5 py-2.5 bg-white border border-pink-300 text-pink-700 rounded-xl font-bold text-xs hover:bg-pink-100/50 transition flex items-center gap-2 mx-auto shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-xs font-extrabold text-gray-400 uppercase tracking-wider">OR</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-gray-700" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  Already Have a Filled Template?
                </h3>
                <p className="text-xs text-gray-600 mb-4 max-w-md mx-auto">
                  If you have already downloaded and filled your Excel file, proceed directly to upload.
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-pink-600 text-white rounded-xl font-bold text-xs hover:bg-pink-700 transition flex items-center gap-2 mx-auto shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload Excel File
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Excel File
                </h3>
                <p className="text-gray-600 text-sm">
                  Upload the filled template file. Only .xlsx and .xls files are accepted.
                </p>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  selectedFile ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-pink-400'
                }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                {!selectedFile ? (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Drag & drop your Excel file here, or click to browse
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      Select File
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-pink-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-2 hover:bg-gray-200 rounded-full transition"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="flex-1 px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Import
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-pink-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Processing Your File
              </h3>
              <p className="text-gray-600">
                Validating and importing your data. This may take a moment...
              </p>
            </div>
          )}

          {step === 4 && results && (
            <div>
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  results.failed === 0 ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {results.failed === 0 ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-yellow-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Import {results.failed === 0 ? 'Completed' : 'Completed with Errors'}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{results.total_rows}</p>
                  <p className="text-sm text-gray-600">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{results.successful}</p>
                  <p className="text-sm text-green-700">Successful</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-sm text-red-700">Failed</p>
                </div>
              </div>

              {results.validation_errors && results.validation_errors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Failed Rows</h4>
                    <button
                      onClick={handleDownloadErrorReport}
                      className="text-sm text-pink-600 hover:text-pink-700 flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Download Error Report
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Row</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.validation_errors.slice(0, 10).map((err, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="px-4 py-2 text-gray-900">{err.row}</td>
                            <td className="px-4 py-2 text-red-600">
                              {Array.isArray(err.errors) ? err.errors.join(', ') : err.errors}
                            </td>
                          </tr>
                        ))}
                        {results.validation_errors.length > 10 && (
                          <tr className="border-t border-gray-200">
                            <td colSpan="2" className="px-4 py-2 text-center text-gray-600">
                              ... and {results.validation_errors.length - 10} more errors
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Upload Another File
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkUploadModal;