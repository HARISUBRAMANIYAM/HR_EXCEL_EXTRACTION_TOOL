// // src/components/FolderUpload.tsx

// import React, { useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { FileProcessResult } from "../types";

// const FolderUpload: React.FC = () => {
//   const { token } = useAuth();
//   const [folderPath, setFolderPath] = useState("");
//   const [processing, setProcessing] = useState(false);
//   const [result, setResult] = useState<FileProcessResult | null>(null);
//   const [error, setError] = useState("");

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!folderPath.trim()) {
//       setError("Folder path is required");
//       return;
//     }

//     setProcessing(true);
//     setError("");
//     setResult(null);

//     try {
//       const formData = new FormData();
//       formData.append("folder_path", folderPath);

//       const response = await fetch("http://localhost:8000/process_folder", {
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
//     <div className="folder-upload">
//       <h1>Process Folder</h1>

//       <form onSubmit={handleSubmit} className="upload-form">
//         <div className="form-group">
//           <label htmlFor="folderPath">Folder Path</label>
//           <input
//             id="folderPath"
//             type="text"
//             value={folderPath}
//             onChange={(e) => setFolderPath(e.target.value)}
//             placeholder="Enter the full path to the folder containing Excel files"
//             required
//             disabled={processing}
//             autoComplete="off"
//           />
//         </div>

//         <button
//           type="submit"
//           className="submit-button"
//           disabled={processing || !folderPath.trim()}
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
//         </div>
//       )}

//       <div className="instructions">
//         <h3>Instructions</h3>
//         <ol>
//           <li>
//             Enter the full path to the folder containing Excel files with
//             employee data.
//           </li>
//           <li>
//             The Excel files should have the following columns:
//             <ul>
//               <li>UAN No</li>
//               <li>Employee Name</li>
//               <li>Gross wages</li>
//               <li>PF Gross</li>
//               <li>LOP</li>
//             </ul>
//           </li>
//           <li>
//             Click "Process Folder" to start processing all Excel files in the
//             folder.
//           </li>
//           <li>
//             The system will generate the required reports in the Excel and text
//             formats.
//           </li>
//         </ol>
//       </div>
//     </div>
//   );
// };

// export default FolderUpload;
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { FileProcessResult } from "../../types";

const PFUpload: React.FC = () => {
  const { token } = useAuth();
  const [folderPath, setFolderPath] = useState("");
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
      setError("Folder path is required");
      return;
    }

    if (!validatePath(folderPath)) {
      setError(
        "Please enter a valid Windows folder path (e.g., C:\\folder\\subfolder)"
      );
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("folder_path", folderPath);

      const response = await fetch("http://localhost:8000/process_folder_pf", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "PF processing failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during PF processing"
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="pf-upload-container">
      <h1>Upload PF Files</h1>

      <form onSubmit={handleSubmit} className="pf-upload-form">
        <div className="form-group">
          <label htmlFor="pfFolderPath">
            PF Files Folder Path
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
          disabled={processing || !folderPath.trim()}
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
          </div>
        </div>
      )}

      <div className="instructions">
        <h3>PF File Requirements</h3>
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
          <li>Folder should contain only relevant PF files</li>
        </ul>
      </div>
    </div>
  );
};

export default PFUpload;
