// // export default FolderUpload;
// import React, { useState } from "react";
// import { useAuth } from "../../context/AuthContext";
// import { FileProcessResult } from "../../types";

// const PFUpload: React.FC = () => {
//   const { token } = useAuth();
//   const [folderPath, setFolderPath] = useState("");
//   const [processing, setProcessing] = useState(false);
//   const [result, setResult] = useState<FileProcessResult | null>(null);
//   const [error, setError] = useState("");

//   const validatePath = (path: string): boolean => {
//     // Basic validation for Windows paths
//     return /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/.test(
//       path
//     );
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!folderPath.trim()) {
//       setError("Folder path is required");
//       return;
//     }

//     if (!validatePath(folderPath)) {
//       setError(
//         "Please enter a valid Windows folder path (e.g., C:\\folder\\subfolder)"
//       );
//       return;
//     }

//     setProcessing(true);
//     setError("");
//     setResult(null);

//     try {
//       const formData = new FormData();
//       formData.append("folder_path", folderPath);

//       const response = await fetch("http://localhost:8000/process_folder_pf", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//         body: formData,
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.detail || "PF processing failed");
//       }

//       const data = await response.json();
//       setResult(data);
//     } catch (err) {
//       setError(
//         err instanceof Error
//           ? err.message
//           : "An error occurred during PF processing"
//       );
//     } finally {
//       setProcessing(false);
//     }
//   };

//   return (
//     <div className="pf-upload-container">
//       <h1>Upload PF Files</h1>

//       <form onSubmit={handleSubmit} className="pf-upload-form">
//         <div className="form-group">
//           <label htmlFor="pfFolderPath">
//             PF Files Folder Path
//             <span className="required">*</span>
//           </label>
//           <input
//             id="pfFolderPath"
//             type="text"
//             name="folderPath"
//             value={folderPath}
//             onChange={(e) => setFolderPath(e.target.value)}
//             placeholder="Example: C:\\HR\\PF_Monthly_Reports"
//             required
//             disabled={processing}
//             title="Enter a valid Windows folder path"
//           />
//         </div>

//         <button
//           type="submit"
//           className="submit-button"
//           disabled={processing || !folderPath.trim()}
//         >
//           {processing ? (
//             <>
//               <span className="spinner"></span>
//               Processing...
//             </>
//           ) : (
//             "Process PF Files"
//           )}
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
//           <h3>Processing Result</h3>
//           <div className="result-details">
//             <p>
//               <strong>Status:</strong>{" "}
//               <span className="status">{result.status.toUpperCase()}</span>
//             </p>
//             <p>
//               <strong>Message:</strong> {result.message}
//             </p>
//             <p>
//               <strong>Files Processed:</strong> {result.file_path}
//             </p>
//           </div>
//         </div>
//       )}

//       <div className="instructions">
//         <h3>PF File Requirements</h3>
//         <ul>
//           <li>Excel files (.xlsx, .xls) containing PF data</li>
//           <li>
//             Required columns:
//             <ul>
//               <li>
//                 <strong>UAN No</strong> (10-12 digit Universal Account Number)
//               </li>
//               <li>
//                 <strong>Employee Name</strong>
//               </li>
//               <li>
//                 <strong>Gross Wages</strong> (Total Salary/Gross Salary)
//               </li>
//               <li>
//                 <strong>PF Gross</strong> (EPF Gross/PF Gross)
//               </li>
//               <li>
//                 <strong>LOP Days</strong> (Loss of Pay days)
//               </li>
//             </ul>
//           </li>
//           <li>All Excel files should be in the specified folder</li>
//           <li>Folder should contain only relevant PF files</li>
//         </ul>
//       </div>
//     </div>
//   );
// };

// export default PFUpload;
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
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
      setError("Folder path is required");
      return;
    }

    if (!uploadDate) {
      setError("Upload date is required");
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
      formData.append("upload_date", uploadDate);

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

  // Get today's date in YYYY-MM-DD format for the default value
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="pf-upload-container">
      <h1>Upload PF Files</h1>

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