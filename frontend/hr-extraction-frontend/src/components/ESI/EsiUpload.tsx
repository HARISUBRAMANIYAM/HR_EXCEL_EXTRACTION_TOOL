// // export default EsiUpload;
// import { useState } from "react";
// import { useAuth } from "../../context/AuthContext";
// import { FileProcessResult } from "../../types";

// const EsiUpload: React.FC = () => {
//   const { token } = useAuth();
//   const [folderPath, setFolderPath] = useState("");
//   const [uploadDate, setUploadDate] = useState("");
//   const [processing, setProcessing] = useState(false);
//   const [result, setResult] = useState<FileProcessResult | null>(null);
//   const [error, setError] = useState("");

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!folderPath.trim()) {
//       setError("Folder path is required");
//       return;
//     }
//     if (!uploadDate.trim()) {
//       setError("Upload date is required");
//       return;
//     }

//     setProcessing(true);
//     setError("");
//     setResult(null);

//     try {
//       const formData = new FormData();
//       formData.append("folder_path", folderPath);
//       formData.append("upload_date", uploadDate);

//       const response = await fetch("http://localhost:8000/esi_upload", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.detail || "Failed to process folder");
//       }

//       const data = await response.json();
//       setResult(data);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(err.message);
//       } else {
//         setError("An unexpected error occurred");
//       }
//     } finally {
//       setProcessing(false);
//     }
//   };

//   return (
//     <div className="esi-upload-container">
//       <h1>Process Folder For ESI</h1>
//       <form onSubmit={handleSubmit} className="upload-form">
//         <div className="form-group">
//           <label htmlFor="uploadDate">Upload Date</label>
//           <input
//             id="uploadDate"
//             type="date"
//             value={uploadDate}
//             onChange={(e) => setUploadDate(e.target.value)}
//             required
//             disabled={processing}
//           />
//         </div>
//         <div className="form-group">
//           <label htmlFor="folderPath">Folder Path for ESI</label>
//           <input
//             id="folderPath"
//             type="text"
//             value={folderPath}
//             onChange={(e) => setFolderPath(e.target.value)}
//             placeholder="Enter the full path to the folder containing the excel files"
//             required
//             disabled={processing}
//             autoComplete="off"
//           />
//         </div>
//         <button
//           type="submit"
//           className="submit-button"
//           disabled={processing || !folderPath.trim() || !uploadDate.trim()}
//         >
//           {processing ? "Processing..." : "Process Folder"}
//         </button>
//       </form>

//       {error && (
//         <div className="error-message">
//           <h3>Error</h3>
//           <p>{error}</p>
//         </div>
//       )}

//       {result && (
//         <div className={`result-message ${result.status}`}>
//           <h3>Result</h3>
//           <p>
//             <strong>Status:</strong>{" "}
//             {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
//           </p>
//           <p>
//             <strong>Message:</strong> {result.message}
//           </p>
//           <p>
//             <strong>Folder Path:</strong> {result.file_path}
//           </p>
//           <p>
//             <strong>Upload Date:</strong> {result.upload_date}
//           </p>
//         </div>
//       )}

//       <div className="instructions">
//         <h3>Instructions</h3>
//         <ol>
//           <li>Select the upload date for the ESI data.</li>
//           <li>
//             Enter the full path to the folder containing Excel files with
//             employee data.
//           </li>
//           <li>
//             The Excel files should have the following columns:
//             <ul>
//               <li>ESI No (or ESI N0)</li>
//               <li>Employee Name</li>
//               <li>ESI Gross</li>
//               <li>Worked Days (or Worked days)</li>
//             </ul>
//           </li>
//           <li>
//             Click "Process Folder" to start processing all Excel files in the
//             folder.
//           </li>
//           <li>
//             The system will generate ESI reports in both Excel and text formats.
//           </li>
//         </ol>
//       </div>
//     </div>
//   );
// };

// export default EsiUpload;
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import { FileProcessResult } from "../../types";

const EsiUpload: React.FC = () => {
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

    if (!uploadDate.trim()) {
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
    const toastId = toast.loading("Processing ESI files...");

    try {
      const formData = new FormData();
      formData.append("folder_path", folderPath);
      formData.append("upload_date", uploadDate);

      const response = await fetch("http://localhost:8000/esi_upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process folder");
      }

      const data = await response.json();
      setResult(data);

      toast.update(toastId, {
        render: "ESI files processed successfully!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
        closeButton: true,
      });

      // Show additional details in a separate toast
      if (data.file_path) {
        toast.info(
          <div>
            <p>Processed files from:</p>
            <p>{data.file_path}</p>
          </div>,
          { autoClose: 7000 }
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);

      toast.update(toastId, {
        render: errorMessage,
        type: "error",
        isLoading: false,
        autoClose: 5000,
        closeButton: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for the default value
  const today = new Date().toISOString().split("T")[0];

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
          <label htmlFor="uploadDate">Upload Date</label>
          <input
            id="uploadDate"
            type="date"
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            required
            disabled={processing}
            max={today}
          />
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
          disabled={processing || !folderPath.trim() || !uploadDate.trim()}
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
            <strong>Upload Date:</strong> {result.upload_date}
          </p>
        </div>
      )}

      <div className="instructions">
        <h3>Instructions</h3>
        <ol>
          <li>Select the upload date for the ESI data.</li>
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
