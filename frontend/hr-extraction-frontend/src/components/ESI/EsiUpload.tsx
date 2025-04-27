import { useCallback, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { FileProcessResult } from "../../types";

const EsiUpload: React.FC = () => {
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
      toast.error("Please select a folder with ESI files");
      setError("Please select a folder with ESI files");
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
    toast.info("Processing ESI files...", { autoClose: 1000 });

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

      const response = await api.post("/process_folder_esi_new", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setResult(response.data);
      toast.success("ESI files processed successfully!");
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
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <div className="esi-upload-container">
        <h1>Upload ESI Remittance</h1>

        <form onSubmit={handleSubmit} noValidate className="esi-upload-form">
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
              ESI Remittance Folder
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
                <label htmlFor="fileInput" className="browse-button">
                  Browse Files
                  <input
                    id="fileInput"
                    type="file"
                    //@ts-ignore - webkitdirectory is not in the standard yet
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
              "Process ESI Files"
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
              The system will generate ESI reports in both Excel and text
              formats.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
};

export default EsiUpload;
