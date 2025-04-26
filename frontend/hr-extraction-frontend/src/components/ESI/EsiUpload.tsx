import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { FileProcessResult } from "../../types";

const EsiUpload: React.FC = () => {
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
    toast.info("Processing ESI files...", { autoClose: false });

    try {
      // Convert from YYYY-MM format to MM-YYYY format
      const [year, month] = uploadMonth.split("-");
      const formattedMonth = `${month}-${year}`;

      const formData = new FormData();
      formData.append("folder_path", folderPath);
      formData.append("upload_month", formattedMonth); // Changed parameter name to match backend

      const response = await api.post("/process_folder_esi_new", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setResult(response.data);
      toast.success("ESI files processed successfully!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  // Get today's date in YYYY-MM format for the default value
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="esi-upload-container">
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

      <h1>Process Folder For ESI</h1>
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="uploadMonth">Upload Month</label>
          <input
            id="uploadMonth"
            type="month"
            value={uploadMonth}
            onChange={(e) => setUploadMonth(e.target.value)}
            required
            disabled={processing}
            max={currentMonth}
          />
          <small>
            Select month and year (will be converted to MM-YYYY format)
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="folderPath">Folder Path for ESI</label>
          <input
            id="folderPath"
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="Example: C:\\HR\\ESI_Reports"
            required
            disabled={processing}
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
            "Process Folder"
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
          <h3>Result</h3>
          <p>
            <strong>Status:</strong>{" "}
            {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
          </p>
          <p>
            <strong>Message:</strong> {result.message}
          </p>
          <p>
            <strong>Folder Path:</strong> {result.file_path}
          </p>
          <p>
            <strong>Upload Month:</strong> {result.upload_month}
          </p>
        </div>
      )}

      <div className="instructions">
        <h3>Instructions</h3>
        <ol>
          <li>Select the upload month for the ESI data.</li>
          <li>
            Enter the full path to the folder containing Excel files with
            employee data.
          </li>
          <li>
            The Excel files should have the following columns:
            <ul>
              <li>ESI No (or ESI N0)</li>
              <li>Employee Name</li>
              <li>ESI Gross</li>
              <li>Worked Days (or Worked days)</li>
            </ul>
          </li>
          <li>
            Click "Process Folder" to start processing all Excel files in the
            folder.
          </li>
          <li>
            The system will generate ESI reports in both Excel and text formats.
          </li>
        </ol>
      </div>
    </div>
  );
};

export default EsiUpload;
