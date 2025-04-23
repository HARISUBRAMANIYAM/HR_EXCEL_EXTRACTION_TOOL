// export default PFUpload;
import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { FileProcessResult } from "../../types";

const PFUpload: React.FC = () => {
  const { token } = useAuth();
  const [folderPath, setFolderPath] = useState("");
  const [uploadDate, setUploadDate] = useState("");
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

    if (!uploadDate) {
      toast.error("Upload date is required");
      setError("Upload date is required");
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
      const formData = new FormData();
      formData.append("folder_path", folderPath);
      formData.append("upload_date", uploadDate);

      const response = await api.post<FileProcessResult>(
        "/process_folder_pf",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(response.data);
      toast.success("PF files processed successfully!");
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for the default value
  const today = new Date().toISOString().split("T")[0];

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
            <label htmlFor="uploadDate">
              Upload Date
              <span className="required">*</span>
            </label>
            <input
              id="uploadDate"
              type="date"
              name="uploadDate"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              required
              disabled={processing}
              max={today}
            />
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
            />
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={processing || !folderPath.trim() || !uploadDate}
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
              {result.upload_date && (
                <p>
                  <strong>Upload Date:</strong>{" "}
                  {new Date(result.upload_date).toLocaleDateString()}
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
