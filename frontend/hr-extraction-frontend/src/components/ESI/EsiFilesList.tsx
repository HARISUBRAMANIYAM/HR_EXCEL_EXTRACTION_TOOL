// // export default EsiFilesList;
// import React, { useEffect, useState } from "react";
// import { useAuth } from "../../context/AuthContext";
// import { ProcessedFile } from "../../types";

// interface ESIFile extends ProcessedFile {
//   remittance_submitted?: boolean;
//   remittance_date?: string;
//   remittance_challan_path?: string;
// }
// const EsiFilesList: React.FC = () => {
//   const { token } = useAuth();
//   const [files, setFiles] = useState<ESIFile[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [downloading, setDownloading] = useState<string | null>(null);
//   const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
//   const [selectAll, setSelectAll] = useState(false);
//   const [sortConfig, setSortConfig] = useState<{
//     key: "filename" | "created_at";
//     direction: "asc" | "desc";
//   } | null>(null);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [selectedDate, setSelectedDate] = useState<string>(
//     new Date().toISOString().split("T")[0]
//   );

//   // For remittance challan upload
//   const [uploadingRemittance, setUploadingRemittance] = useState<number | null>(
//     null
//   );
//   const [remittanceDate, setRemittanceDate] = useState<string>(
//     new Date().toISOString().split("T")[0]
//   );
//   const [remittanceFile, setRemittanceFile] = useState<File | null>(null);

//   useEffect(() => {
//     fetchFiles();
//   }, [token, selectedDate]);

//   const fetchFiles = async () => {
//     try {
//       setLoading(true);
//       setError("");

//       const response = await fetch(
//         `http://localhost:8000/processed_files_esi?upload_date=${selectedDate}`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to fetch ESI files");
//       }

//       const data: ESIFile[] = await response.json();
//       setFiles(data);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(err.message);
//       } else {
//         setError("An unexpected error occurred");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDownload = async (
//     fileId: string,
//     filename: string,
//     fileType: string = "xlsx"
//   ) => {
//     try {
//       setDownloading(fileId);
//       setError("");

//       let url = `http://localhost:8000/processed_files_esi/${fileId}/download${
//         fileType ? `?file_type=${fileType}` : ""
//       }`;

//       const response = await fetch(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!response.ok) {
//         throw new Error("Failed to download file");
//       }

//       const blob = await response.blob();
//       const downloadUrl = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = downloadUrl;
//       a.download =
//         fileType === "txt"
//           ? filename.split(".")[0] + "_esi.txt"
//           : filename.split(".")[0] + "_esi.xlsx";
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(downloadUrl);
//       document.body.removeChild(a);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(`Download failed: ${err.message}`);
//       } else {
//         setError("An unexpected error occurred during download");
//       }
//     } finally {
//       setDownloading(null);
//     }
//   };

//   const handleBatchDownload = async () => {
//     if (selectedFiles.length === 0) {
//       setError("Please select at least one file to download");
//       return;
//     }

//     setError("");
//     try {
//       const fileIdsParam = selectedFiles.join(",");
//       const url = `http://localhost:8000/processed_files_esi/batch_download?file_ids=${fileIdsParam}`;
//       const response = await fetch(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!response.ok) {
//         throw new Error("Failed to download files");
//       }

//       const blob = await response.blob();
//       const downloadUrl = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = downloadUrl;
//       a.download = `esi_files_${new Date().toISOString().slice(0, 10)}.zip`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(downloadUrl);
//       a.remove();
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(`Batch download failed: ${err.message}`);
//       } else {
//         setError("An unexpected error occurred during batch download");
//       }
//     }
//   };

//   const toggleFileSelection = (fileId: number) => {
//     setSelectedFiles((prev) =>
//       prev.includes(fileId)
//         ? prev.filter((id) => id !== fileId)
//         : [...prev, fileId]
//     );
//   };

//   const handleSelectAll = () => {
//     if (selectAll) {
//       setSelectedFiles([]);
//     } else {
//       const allSuccessFileIds = files
//         .filter((file) => file.status === "success")
//         .map((file) => file.id);
//       setSelectedFiles(allSuccessFileIds);
//     }
//     setSelectAll(!selectAll);
//   };

//   const handleSort = (key: "filename" | "created_at") => {
//     setSortConfig((prev) => {
//       if (prev?.key === key) {
//         return {
//           key,
//           direction: prev.direction === "asc" ? "desc" : "asc",
//         };
//       }
//       return { key, direction: "asc" };
//     });
//   };

//   const handleRemittanceUpload = async (fileId: number) => {
//     if (!remittanceFile) {
//       setError("Please select a remittance file");
//       return;
//     }

//     try {
//       setUploadingRemittance(fileId);
//       setError("");

//       const formData = new FormData();
//       formData.append("remittance_date", remittanceDate);
//       formData.append("remittance_file", remittanceFile);

//       const response = await fetch(
//         `http://localhost:8000/processed_files_esi/${fileId}/submit_remittance`,
//         {
//           method: "POST",
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//           body: formData,
//         }
//       );

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.detail || "Failed to upload remittance");
//       }

//       await fetchFiles(); // Refresh the file list
//       setRemittanceFile(null);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(`Remittance upload failed: ${err.message}`);
//       } else {
//         setError("An unexpected error occurred during remittance upload");
//       }
//     } finally {
//       setUploadingRemittance(null);
//     }
//   };

//   const downloadRemittanceChallan = async (fileId: number) => {
//     try {
//       setError("");

//       const response = await fetch(
//         `http://localhost:8000/processed_files_esi/${fileId}/remittance_challan`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to download remittance challan");
//       }

//       const blob = await response.blob();
//       const downloadUrl = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = downloadUrl;
//       a.download = `remittance_challan_${fileId}.pdf`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(downloadUrl);
//       document.body.removeChild(a);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(`Challan download failed: ${err.message}`);
//       } else {
//         setError("An unexpected error occurred during challan download");
//       }
//     }
//   };

//   const filteredAndSortedFiles = [...files]
//     .filter((file) =>
//       file.filename?.toLowerCase().includes(searchQuery.toLowerCase())
//     )
//     .sort((a, b) => {
//       if (!sortConfig) return 0;
//       const { key, direction } = sortConfig;
//       const aValue = a[key] || "";
//       const bValue = b[key] || "";

//       if (key === "created_at") {
//         const aDate = new Date(aValue).getTime();
//         const bDate = new Date(bValue).getTime();
//         return direction === "asc" ? aDate - bDate : bDate - aDate;
//       }

//       const comparison = (aValue as string)
//         .toLowerCase()
//         .localeCompare((bValue as string).toLowerCase());
//       return direction === "asc" ? comparison : -comparison;
//     });

//   if (loading) {
//     return (
//       <div className="loading-container">
//         <p>Loading ESI files...</p>
//         <div className="loading-spinner"></div>
//       </div>
//     );
//   }

//   return (
//     <div className="files-container">
//       <div className="file-header">
//         <div className="controls-container">
//           <div className="date-selector">
//             <label htmlFor="date-select">Select Date:</label>
//             <input
//               type="date"
//               id="date-select"
//               value={selectedDate}
//               onChange={(e) => setSelectedDate(e.target.value)}
//               className="date-input"
//             />
//             <button onClick={fetchFiles} className="refresh-button">
//               Refresh
//             </button>
//           </div>
//           <input
//             type="text"
//             placeholder="Search by filename..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className="search-input"
//           />
//         </div>
//         <h1>Processed ESI Files</h1>
//         <div className="actions-container">
//           <div className="select-all-container">
//             <input
//               type="checkbox"
//               id="select-all-esi"
//               checked={selectAll}
//               onChange={handleSelectAll}
//             />
//             <label htmlFor="select-all-esi">Select All</label>
//           </div>
//           {selectedFiles.length > 0 && (
//             <button
//               className="batch-download-button"
//               onClick={handleBatchDownload}
//               disabled={selectedFiles.length === 0}
//             >
//               Download Selected ({selectedFiles.length})
//             </button>
//           )}
//         </div>
//       </div>

//       {error && (
//         <div className="error-container">
//           <p className="error-message">{error}</p>
//           <button className="error-close-button" onClick={() => setError("")}>
//             ✕
//           </button>
//         </div>
//       )}

//       {files.length === 0 ? (
//         <p className="no-files">No ESI files processed for the selected date</p>
//       ) : (
//         <table className="files-table">
//           <thead>
//             <tr>
//               <th style={{ width: "50px" }}></th>
//               <th
//                 onClick={() => handleSort("filename")}
//                 style={{ cursor: "pointer" }}
//               >
//                 Filename{" "}
//                 {sortConfig?.key === "filename"
//                   ? sortConfig.direction === "asc"
//                     ? "▲"
//                     : "▼"
//                   : ""}
//               </th>
//               <th>Status</th>
//               <th
//                 onClick={() => handleSort("created_at")}
//                 style={{ cursor: "pointer" }}
//               >
//                 Processed Date{" "}
//                 {sortConfig?.key === "created_at"
//                   ? sortConfig.direction === "asc"
//                     ? "▲"
//                     : "▼"
//                   : ""}
//               </th>
//               <th>Downloads</th>
//               <th>Remittance</th>
//             </tr>
//           </thead>
//           <tbody>
//             {filteredAndSortedFiles.map((file) => (
//               <tr key={`esi-${file.id}`} className={file.status}>
//                 <td>
//                   <input
//                     type="checkbox"
//                     className="file-select"
//                     checked={selectedFiles.includes(file.id)}
//                     onChange={() => toggleFileSelection(file.id)}
//                     disabled={file.status !== "success"}
//                     aria-label="fileselect"
//                   />
//                 </td>
//                 <td>{file.filename || "N/A"}</td>
//                 <td>
//                   <span className={`status-badge ${file.status}`}>
//                     {file.status.toUpperCase()}
//                   </span>
//                 </td>
//                 <td>{new Date(file.created_at).toLocaleString()}</td>
//                 <td>
//                   {file.status === "success" ? (
//                     <div className="download-buttons">
//                       <button
//                         className="download-button"
//                         onClick={() =>
//                           handleDownload(String(file.id), file.filename)
//                         }
//                         disabled={downloading === String(file.id)}
//                       >
//                         {downloading === String(file.id)
//                           ? "Downloading..."
//                           : "Excel"}
//                       </button>
//                       <button
//                         className="download-button"
//                         onClick={() =>
//                           handleDownload(String(file.id), file.filename, "txt")
//                         }
//                         disabled={downloading === String(file.id)}
//                       >
//                         {downloading === String(file.id)
//                           ? "Downloading..."
//                           : "Text"}
//                       </button>
//                     </div>
//                   ) : (
//                     <span className="error-message">{file.message}</span>
//                   )}
//                 </td>
//                 <td>
//                   {file.status === "success" && (
//                     <div className="remittance-section">
//                       {file.remittance_submitted ? (
//                         <div className="remittance-info">
//                           <span className="remittance-badge success">
//                             ✓ Submitted on{" "}
//                             {new Date(
//                               file.remittance_date ?? ""
//                             ).toLocaleDateString()}
//                           </span>
//                           <button
//                             className="download-button"
//                             onClick={() => downloadRemittanceChallan(file.id)}
//                           >
//                             View Challan
//                           </button>
//                         </div>
//                       ) : (
//                         <div className="remittance-upload">
//                           {uploadingRemittance === file.id ? (
//                             <div className="loading-spinner small"></div>
//                           ) : (
//                             <>
//                               <div className="remittance-form">
//                                 <input
//                                   type="date"
//                                   value={remittanceDate}
//                                   onChange={(e) =>
//                                     setRemittanceDate(e.target.value)
//                                   }
//                                   className="remittance-date"
//                                   aria-label="uploaddate"
//                                 />
//                                 <input
//                                   type="file"
//                                   accept=".pdf"
//                                   onChange={(e) =>
//                                     setRemittanceFile(
//                                       e.target.files ? e.target.files[0] : null
//                                     )
//                                   }
//                                   className="remittance-file"
//                                   aria-label="pdfupload"
//                                 />
//                                 <button
//                                   className="upload-button"
//                                   onClick={() =>
//                                     handleRemittanceUpload(file.id)
//                                   }
//                                   disabled={!remittanceFile}
//                                 >
//                                   Upload Challan
//                                 </button>
//                               </div>
//                             </>
//                           )}
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );
// };

// export default EsiFilesList;
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ProcessedFile } from "../../types";

interface ESIFile extends ProcessedFile {
  remittance_submitted?: boolean;
  remittance_date?: string;
  remittance_challan_path?: string;
}
const EsiFilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<ESIFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: "filename" | "created_at";
    direction: "asc" | "desc";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // For remittance challan upload
  const [uploadingRemittance, setUploadingRemittance] = useState<number | null>(
    null
  );
  const [remittanceDate, setRemittanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [token, selectedDate]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `http://localhost:8000/processed_files_esi?upload_date=${selectedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch ESI files");
      }

      const data: ESIFile[] = await response.json();
      setFiles(data);
      // Reset selections when data changes
      setSelectedFiles([]);
      setSelectAll(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (
    fileId: string,
    filename: string,
    fileType: string = "xlsx"
  ) => {
    try {
      setDownloading(fileId);
      setError("");

      let url = `http://localhost:8000/processed_files_esi/${fileId}/download${
        fileType ? `?file_type=${fileType}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download =
        fileType === "txt"
          ? filename.split(".")[0] + "_esi.txt"
          : filename.split(".")[0] + "_esi.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Download failed: ${err.message}`);
      } else {
        setError("An unexpected error occurred during download");
      }
    } finally {
      setDownloading(null);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file to download");
      return;
    }

    setError("");
    try {
      const fileIdsParam = selectedFiles.join(",");
      const url = `http://localhost:8000/processed_files_esi/batch_download?file_ids=${fileIdsParam}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download files");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `esi_files_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
    } catch (err) {
      if (err instanceof Error) {
        setError(`Batch download failed: ${err.message}`);
      } else {
        setError("An unexpected error occurred during batch download");
      }
    }
  };

  const toggleFileSelection = (fileId: number) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedFiles([]);
    } else {
      const allSuccessFileIds = files
        .filter((file) => file.status === "success")
        .map((file) => file.id);
      setSelectedFiles(allSuccessFileIds);
    }
    setSelectAll(!selectAll);
  };

  const handleSort = (key: "filename" | "created_at") => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const handleRemittanceUpload = async (fileId: number) => {
    if (!remittanceFile) {
      setError("Please select a remittance file");
      return;
    }

    try {
      setUploadingRemittance(fileId);
      setError("");

      const formData = new FormData();
      formData.append("remittance_date", remittanceDate);
      formData.append("remittance_file", remittanceFile);

      const response = await fetch(
        `http://localhost:8000/processed_files_esi/${fileId}/submit_remittance`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload remittance");
      }

      await fetchFiles(); // Refresh the file list
      setRemittanceFile(null);
      // Close the upload form
      setUploadingRemittance(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Remittance upload failed: ${err.message}`);
      } else {
        setError("An unexpected error occurred during remittance upload");
      }
    } finally {
      setUploadingRemittance(null);
    }
  };

  const downloadRemittanceChallan = async (fileId: number) => {
    try {
      setDownloading(`remittance-${fileId}`);
      setError("");

      const response = await fetch(
        `http://localhost:8000/processed_files_esi/${fileId}/remittance_challan`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download remittance challan");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `remittance_challan_${fileId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Challan download failed: ${err.message}`);
      } else {
        setError("An unexpected error occurred during challan download");
      }
    } finally {
      setDownloading(null);
    }
  };

  const filteredAndSortedFiles = [...files]
    .filter((file) =>
      file.filename?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      const aValue = a[key] || "";
      const bValue = b[key] || "";

      if (key === "created_at") {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return direction === "asc" ? aDate - bDate : bDate - aDate;
      }

      const comparison = (aValue as string)
        .toLowerCase()
        .localeCompare((bValue as string).toLowerCase());
      return direction === "asc" ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading ESI files...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="files-container">
      <div className="file-header">
        <div className="controls-container">
          <div className="date-selector">
            <label htmlFor="date-select">Select Date:</label>
            <input
              type="date"
              id="date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
            <button onClick={fetchFiles} className="refresh-button">
              Refresh
            </button>
          </div>
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <h1 style={{ fontWeight: "bold" }}>Processed ESI Files</h1>
        <div className="actions-container">
          <div className="select-all-container">
            <input
              type="checkbox"
              id="select-all-esi"
              checked={selectAll}
              onChange={handleSelectAll}
            />
            <label htmlFor="select-all-esi">Select All</label>
          </div>
          {selectedFiles.length > 0 && (
            <button
              className="batch-download-button"
              onClick={handleBatchDownload}
              disabled={selectedFiles.length === 0}
            >
              Download Selected ({selectedFiles.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      {files.length === 0 ? (
        <p className="no-files">No ESI files processed for the selected date</p>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th style={{ width: "50px" }}></th>
              <th
                onClick={() => handleSort("filename")}
                style={{ cursor: "pointer" }}
              >
                Filename{" "}
                {sortConfig?.key === "filename"
                  ? sortConfig.direction === "asc"
                    ? "▲"
                    : "▼"
                  : ""}
              </th>
              <th>Status</th>
              <th
                onClick={() => handleSort("created_at")}
                style={{ cursor: "pointer" }}
              >
                Processed Date{" "}
                {sortConfig?.key === "created_at"
                  ? sortConfig.direction === "asc"
                    ? "▲"
                    : "▼"
                  : ""}
              </th>
              <th>Remittance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedFiles.map((file) => (
              <tr key={`esi-${file.id}`} className={file.status}>
                <td>
                  <input
                    type="checkbox"
                    className="file-select"
                    checked={selectedFiles.includes(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    disabled={file.status !== "success"}
                    aria-label="fileselect"
                  />
                </td>
                <td>{file.filename || "N/A"}</td>
                <td>
                  <span className={`status-badge ${file.status}`}>
                    {file.status.toUpperCase()}
                  </span>
                </td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
                  {file.status === "success" ? (
                    file.remittance_submitted ? (
                      <div className="remittance-info">
                        <span className="status-badge success">
                          Submitted:{" "}
                          {new Date(
                            file.remittance_date || ""
                          ).toLocaleDateString()}
                        </span>
                        <button
                          className="download-button small"
                          onClick={() => downloadRemittanceChallan(file.id)}
                          disabled={downloading === `remittance-${file.id}`}
                        >
                          {downloading === `remittance-${file.id}`
                            ? "Downloading..."
                            : "View Challan"}
                        </button>
                      </div>
                    ) : uploadingRemittance === file.id ? (
                      <div className="remittance-upload-form">
                        <div className="remittance-fields">
                          <input
                            type="date"
                            value={remittanceDate}
                            onChange={(e) => setRemittanceDate(e.target.value)}
                            max={new Date().toISOString().split("T")[0]}
                            aria-label="inputdate"
                          />
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) =>
                              setRemittanceFile(e.target.files?.[0] || null)
                            }
                            aria-label="pdfinput"
                          />
                        </div>
                        <div className="remittance-actions">
                          <button
                            className="submit-button"
                            onClick={() => handleRemittanceUpload(file.id)}
                            disabled={!remittanceFile}
                          >
                            Submit
                          </button>
                          <button
                            className="cancel-button"
                            onClick={() => setUploadingRemittance(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="upload-button"
                        onClick={() => setUploadingRemittance(file.id)}
                      >
                        Upload Remittance
                      </button>
                    )
                  ) : (
                    <span>N/A</span>
                  )}
                </td>
                <td className="actions">
                  {file.status === "success" ? (
                    <div className="download-buttons">
                      <button
                        className="download-button"
                        onClick={() =>
                          handleDownload(String(file.id), file.filename)
                        }
                        disabled={downloading === String(file.id)}
                      >
                        {downloading === String(file.id)
                          ? "Downloading..."
                          : "Excel"}
                      </button>
                      <button
                        className="download-button"
                        onClick={() =>
                          handleDownload(String(file.id), file.filename, "txt")
                        }
                        disabled={downloading === String(file.id)}
                      >
                        {downloading === String(file.id)
                          ? "Downloading..."
                          : "Text"}
                      </button>
                    </div>
                  ) : (
                    <span className="error-message">{file.message}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EsiFilesList;
