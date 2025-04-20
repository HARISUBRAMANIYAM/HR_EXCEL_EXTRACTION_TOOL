// // export default PFFilesList;
// import React, { useEffect, useState } from "react";
// import { useAuth } from "../../context/AuthContext";
// import { ProcessedFile } from "../../types";

// interface PFFile extends ProcessedFile {
//   uan_no?: string;
//   member_name?: string;
// }

// const PFFilesList: React.FC = () => {
//   const { token } = useAuth();
//   const [files, setFiles] = useState<PFFile[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [downloading, setDownloading] = useState<string | null>(null);
//   const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
//   const [selectAll, setSelectAll] = useState(false);
//   const [sortConfig, setsortConfig] = useState<{
//     key: "filename" | "created_at";
//     direction: "asc" | "desc";
//   } | null>(null);
//   const [searchQuery, setSearchQuery] = useState("");

//   useEffect(() => {
//     const fetchFiles = async () => {
//       try {
//         setLoading(true);
//         setError("");

//         const response = await fetch(
//           "http://localhost:8000/processed_files_pf",
//           {
//             headers: { Authorization: `Bearer ${token}` },
//           }
//         );

//         if (!response.ok) {
//           throw new Error(
//             (await response.text()) || "Failed to fetch PF files"
//           );
//         }

//         const data = await response.json();
//         setFiles(data);
//       } catch (err) {
//         setError(err instanceof Error ? err.message : "Failed to load files");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchFiles();
//   }, [token]);

//   const handleDownload = async (
//     fileId: string,
//     fileType: "xlsx" | "txt" = "xlsx"
//   ) => {
//     try {
//       setDownloading(fileId);
//       setError("");

//       const url = `http://localhost:8000/processed_files_pf/${fileId}/download?file_type=${fileType}`;
//       const response = await fetch(url, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!response.ok) {
//         throw new Error((await response.text()) || "Download failed");
//       }

//       const blob = await response.blob();
//       const downloadUrl = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = downloadUrl;
//       a.download = `pf_report_${fileId}.${fileType}`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(downloadUrl);
//       document.body.removeChild(a);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Download error");
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
//       const url = `http://localhost:8000/processed_files_pf/batch_download?file_ids=${fileIdsParam}`;
//       const response = await fetch(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to download files: ${response.statusText}`);
//       }

//       const blob = await response.blob();
//       const downloadUrl = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = downloadUrl;
//       a.download = `pf_files_bundle_${new Date()
//         .toISOString()
//         .slice(0, 10)}.zip`;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(downloadUrl);
//       a.remove();
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Batch download failed");
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
//   const filteredandSortedFiles = [...files]
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
//   const handleSort = (key: "filename" | "created_at") => {
//     setsortConfig((prev) => {
//       if (prev?.key === key) {
//         return {
//           key,
//           direction: prev.direction === "asc" ? "desc" : "asc",
//         };
//       }
//       return { key, direction: "asc" };
//     });
//   };

//   if (loading) {
//     return (
//       <div className="loading-container">
//         <p>Loading PF files...</p>
//         <div className="loading-spinner"></div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="error-container">
//         <p className="error-message">{error}</p>
//         <button
//           className="download-button"
//           onClick={() => window.location.reload()}
//         >
//           Retry
//         </button>
//       </div>
//     );
//   }

//   return (
//     <div className="files-container">
//       <div className="file-header">
//         <div className="controls-container">
//           <input
//             type="text"
//             placeholder="Search by filename..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className="search-input"
//           />
//         </div>
//         <h1 style={{font:"bold"}}>Processed PF Files</h1>
//         <div className="actions-container">
//           <div className="select-all-container">
//             <input
//               type="checkbox"
//               id="select-all-pf"
//               checked={selectAll}
//               onChange={handleSelectAll}
//             />
//             <label htmlFor="select-all-pf">Select All</label>
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

//       {files.length === 0 ? (
//         <p className="no-files">No PF files processed yet</p>
//       ) : (
//         <table className="files-table">
//           <thead>
//             <tr>
//               <th></th>
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
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {filteredandSortedFiles.map((file) => (
//               <tr key={`pf-${file.id}`} className={file.status}>
//                 <td>
//                   <input
//                     type="checkbox"
//                     checked={selectedFiles.includes(file.id)}
//                     onChange={() => toggleFileSelection(file.id)}
//                     disabled={file.status !== "success"}
//                     aria-label="selectfile"
//                   />
//                 </td>
//                 <td>{file.filename || "N/A"}</td>
//                 <td>
//                   <span className={`status-badge ${file.status}`}>
//                     {file.status.toUpperCase()}
//                   </span>
//                 </td>
//                 <td>{new Date(file.created_at).toLocaleString()}</td>
//                 <td className="actions">
//                   {file.status === "success" ? (
//                     <div className="download-buttons">
//                       <button
//                         className="download-button"
//                         onClick={() => handleDownload(String(file.id), "xlsx")}
//                         disabled={downloading === String(file.id)}
//                       >
//                         {downloading === String(file.id)
//                           ? "Downloading..."
//                           : "Excel"}
//                       </button>
//                       <button
//                         className="download-button"
//                         onClick={() => handleDownload(String(file.id), "txt")}
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
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );
// };

// export default PFFilesList;
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ProcessedFile } from "../../types";

interface PFFile extends ProcessedFile {
  uan_no?: string;
  member_name?: string;
  remittance_submitted?: boolean;
  remittance_date?: string;
  remittance_challan_path?: string;
}

const PFFilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<PFFile[]>([]);
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
    new Date().toISOString().split("T")[0] // Today's date
  );
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
        `http://localhost:8000/processed_files_pf?upload_date=${selectedDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error((await response.text()) || "Failed to fetch PF files");
      }

      const data = await response.json();
      setFiles(data);
      // Reset selections when data changes
      setSelectedFiles([]);
      setSelectAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (
    fileId: string,
    fileType: "xlsx" | "txt" = "xlsx"
  ) => {
    try {
      setDownloading(fileId);
      setError("");

      const url = `http://localhost:8000/processed_files_pf/${fileId}/download?file_type=${fileType}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `pf_report_${fileId}.${fileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download error");
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
      const url = `http://localhost:8000/processed_files_pf/batch_download?file_ids=${fileIdsParam}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download files: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `pf_files_bundle_${selectedDate}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch download failed");
    }
  };

  const handleRemittanceDownload = async (fileId: number) => {
    try {
      setDownloading(`remittance-${fileId}`);
      setError("");

      const url = `http://localhost:8000/processed_files_pf/${fileId}/remittance_challan`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) || "Remittance download failed"
        );
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
      setError(
        err instanceof Error ? err.message : "Remittance download error"
      );
    } finally {
      setDownloading(null);
    }
  };

  const handleUploadRemittance = async (fileId: number) => {
    if (!remittanceFile || !remittanceDate) {
      setError("Please select a remittance file and date");
      return;
    }

    try {
      setUploadingRemittance(fileId);
      setError("");

      const formData = new FormData();
      formData.append("remittance_date", remittanceDate);
      formData.append("remittance_file", remittanceFile);

      const response = await fetch(
        `http://localhost:8000/processed_files_pf/${fileId}/submit_remittance`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error((await response.text()) || "Remittance upload failed");
      }

      await response.json();
      // Refresh the file list to show updated remittance status
      fetchFiles();
      setRemittanceFile(null);
      // Close the upload form
      setUploadingRemittance(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remittance upload error");
    } finally {
      setUploadingRemittance(null);
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

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading PF files...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="files-container">
      <div className="file-header">
        <div className="controls-container">
          <div className="date-selector">
            <label htmlFor="date-selector">Select Date:</label>
            <input
              type="date"
              id="date-selector"
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
        <h1 style={{ fontWeight: "bold" }}>Processed PF Files</h1>
        <div className="actions-container">
          <div className="select-all-container">
            <input
              type="checkbox"
              id="select-all-pf"
              checked={selectAll}
              onChange={handleSelectAll}
            />
            <label htmlFor="select-all-pf">Select All</label>
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
        <p className="no-files">No PF files found for this date</p>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th></th>
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
              <tr key={`pf-${file.id}`} className={file.status}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    disabled={file.status !== "success"}
                    aria-label="selectfile"
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
                          onClick={() => handleRemittanceDownload(file.id)}
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
                            onClick={() => handleUploadRemittance(file.id)}
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
                        onClick={() => handleDownload(String(file.id), "xlsx")}
                        disabled={downloading === String(file.id)}
                      >
                        {downloading === String(file.id)
                          ? "Downloading..."
                          : "Excel"}
                      </button>
                      <button
                        className="download-button"
                        onClick={() => handleDownload(String(file.id), "txt")}
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

export default PFFilesList;
