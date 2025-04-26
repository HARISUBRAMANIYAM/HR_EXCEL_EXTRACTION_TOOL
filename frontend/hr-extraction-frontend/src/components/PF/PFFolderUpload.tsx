import React, { useCallback, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { FileProcessResult } from "../../types";

const PFUpload: React.FC = () => {
  const { token } = useAuth();
  const [folderName, setFolderName] = useState("");
  const [uploadMonth, setUploadMonth] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<FileProcessResult | null>(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const droppedItems = e.dataTransfer.items;
      const newFiles: File[] = [];

      if (droppedItems) {
        // Handle folder drop
        for (let i = 0; i < droppedItems.length; i++) {
          const item = droppedItems[i];
          if (item.kind === "file") {
            const entry = item.webkitGetAsEntry();
            if (entry && entry.isDirectory) {
              // Get the folder name
              setFolderName(entry.name);
            } else if (entry && entry.isFile) {
              const file = item.getAsFile();
              if (file) newFiles.push(file);
            }
          }
        }
      } else {
        // Fallback for browsers that don't support DataTransferItem
        const droppedFiles = e.dataTransfer.files;
        for (let i = 0; i < droppedFiles.length; i++) {
          newFiles.push(droppedFiles[i]);
        }
        if (newFiles.length > 0) {
          setFolderName(newFiles[0].webkitRelativePath.split("/")[0]);
        }
      }

      if (newFiles.length > 0) {
        setFiles(newFiles);
        toast.info(
          `Selected ${newFiles.length} files from folder: ${folderName}`
        );
      }
    },
    [folderName]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const newFiles = Array.from(selectedFiles);
      setFiles(newFiles);
      setFolderName(newFiles[0].webkitRelativePath.split("/")[0]);
      toast.info(
        `Selected ${newFiles.length} files from folder: ${folderName}`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      toast.error("Please select a folder with PF files");
      setError("Please select a folder with PF files");
      return;
    }

    if (!uploadMonth) {
      toast.error("Upload month is required");
      setError("Upload month is required");
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
      // Add all files
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("folder_name", folderName);
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

      let errorMessage = "An unexpected error occurred";

      if (err.response && err.response.data) {
        if (typeof err.response.data === "string") {
          errorMessage = err.response.data;
        } else if (Array.isArray(err.response.data)) {
          errorMessage = err.response.data
            .map(
              (error: { loc: any[]; msg: any }) =>
                `Field '${error.loc.slice(1).join(".")}': ${error.msg}`
            )
            .join(", ");
        } else if (err.response.data.detail) {
          errorMessage =
            typeof err.response.data.detail === "string"
              ? err.response.data.detail
              : JSON.stringify(err.response.data.detail);
        } else {
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
            <label>
              PF Remittance Folder
              <span className="required">*</span>
            </label>
            <div
              className={`drop-zone ${isDragOver ? "drag-over" : ""}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="drop-zone-content">
                <p>Drag and drop your PF folder here</p>
                <p>or</p>
                <label htmlFor="fileInput" className="browse-button">
                  Browse Files
                  <input
                    id="fileInput"
                    type="file"
                    // @ts-ignore - webkitdirectory is not in the standard yet
                    webkitdirectory="true"
                    directory="true"
                    mozdirectory="true"
                    onChange={handleFileInput}
                    disabled={processing}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
            {folderName && (
              <div className="selected-folder">
                <strong>Selected Folder:</strong> {folderName}
                <br />
                <strong>Files:</strong> {files.length}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={processing || files.length === 0 || !uploadMonth}
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
                <strong>Files Processed:</strong> {files.length}
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
                  <strong>UAN No</strong> (12 digit Universal Account Number)
                </li>
                <li>
                  <strong>Employee Name</strong>
                </li>
                <li>
                  <strong>Gross Wages</strong> (Total Salary or Gross Salary)
                </li>
                <li>
                  <strong>PF Gross</strong> (EPF Gross or PF Gross)
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
