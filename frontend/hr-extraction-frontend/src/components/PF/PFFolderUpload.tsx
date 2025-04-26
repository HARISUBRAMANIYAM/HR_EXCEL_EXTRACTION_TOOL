import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { FileProcessResult } from "../../types";

const PFUpload: React.FC = () => {
  const { token } = useAuth();
  const [folderPath, setFolderPath] = useState("");
  const [uploadMonth, setUploadMonth] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<FileProcessResult | null>(null);
  const [error, setError] = useState("");

  const validatePath = (path: string): boolean => {
    // Basic validation for Windows paths
    return /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/.test(
      path
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folderPath.trim()) {
      toast.error("Folder path is required");
      setError("Folder path is required");
      return;
    }

    if (!uploadMonth) {
      toast.error("Upload month is required");
      setError("Upload month is required");
      return;
    }

    if (!validatePath(folderPath)) {
      const errorMsg =
        "Please enter a valid Windows folder path (e.g., C:\\folder\\subfolder)";
      toast.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);
    toast.info("Processing PF files...", { autoClose: false });
    
    try {
      // Convert from YYYY-MM format to MM-YYYY format
      const [year, month] = uploadMonth.split("-");
      const formattedMonth = `${month}-${year}`;

      const formData = new FormData();
      formData.append("folder_path", folderPath);
      // Changed the key from "upload_date" to "upload_month" to match the backend expectation
      formData.append("upload_month", formattedMonth);

      const response = await api.post("/process_folder_pf_new", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setResult(response.data);
      toast.success("PF files processed successfully!");
    } catch (err: any) {
      console.error("Error details:", err);
      
      // Handle error object properly
      let errorMessage = "An unexpected error occurred";
      
      if (err.response && err.response.data) {
        // Handle response data which might be an object
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (Array.isArray(err.response.data)) {
          // Handle FastAPI validation error array
          errorMessage = err.response.data.map((error: { loc: any[]; msg: any; }) => 
            `Field '${error.loc.slice(1).join('.')}': ${error.msg}`
          ).join(", ");
        } else if (err.response.data.detail) {
          // Handle FastAPI error format
          errorMessage = typeof err.response.data.detail === 'string' 
            ? err.response.data.detail 
            : JSON.stringify(err.response.data.detail);
        } else {
          // Generic object handling
          errorMessage = JSON.stringify(err.response.data);
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };
  
  // Get today's date in YYYY-MM format for the default value
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <div className="pf-upload-container">
        <h1>Upload PF Remittance</h1>

        <form onSubmit={handleSubmit} className="pf-upload-form">
          <div className="form-group">
            <label htmlFor="uploadMonth">
              Upload Month
              <span className="required">*</span>
            </label>
            <input
              id="uploadMonth"
              type="month"
              name="uploadMonth"
              value={uploadMonth}
              onChange={(e) => setUploadMonth(e.target.value)}
              required
              disabled={processing}
              max={currentMonth}
            />
            <small>
              Select month and year (will be sent as MM-YYYY format)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="pfFolderPath">
              PF Remittance Folder Path
              <span className="required">*</span>
            </label>
            <input
              id="pfFolderPath"
              type="text"
              name="folderPath"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="Example: C:\\HR\\PF_Monthly_Reports"
              required
              disabled={processing}
              title="Enter a valid Windows folder path"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={processing || !folderPath.trim() || !uploadMonth}
          >
            {processing ? (
              <>
                <span className="spinner"></span>
                Processing...
              </>
            ) : (
              "Process PF Files"
            )}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className={`result-message ${result.status}`}>
            <h3>Processing Result</h3>
            <div className="result-details">
              <p>
                <strong>Status:</strong>{" "}
                <span className="status">{result.status.toUpperCase()}</span>
              </p>
              <p>
                <strong>Message:</strong> {result.message}
              </p>
              <p>
                <strong>Files Processed:</strong> {result.file_path}
              </p>
              {result.upload_month && (
                <p>
                  <strong>Upload Month:</strong> {result.upload_month}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="instructions">
          <h3>PF Remittance Requirements</h3>
          <ul>
            <li>Excel files (.xlsx, .xls) containing PF data</li>
            <li>
              Required columns:
              <ul>
                <li>
                  <strong>UAN No</strong> (10-12 digit Universal Account Number)
                </li>
                <li>
                  <strong>Employee Name</strong>
                </li>
                <li>
                  <strong>Gross Wages</strong> (Total Salary/Gross Salary)
                </li>
                <li>
                  <strong>PF Gross</strong> (EPF Gross/PF Gross)
                </li>
                <li>
                  <strong>LOP Days</strong> (Loss of Pay days)
                </li>
              </ul>
            </li>
            <li>All Excel files should be in the specified folder</li>
            <li>Folder should contain only relevant PF Remittance</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default PFUpload;