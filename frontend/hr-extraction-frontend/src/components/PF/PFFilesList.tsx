// // import React, { useEffect, useState } from "react";
// import React, { useEffect, useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { ProcessedFile } from "../types";

// const FilesList: React.FC = () => {
//   const { token } = useAuth();
//   const [files, setFiles] = useState<ProcessedFile[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const fetchFiles = async () => {
//       try {
//         const response = await fetch("http://localhost:8000/processed_files", {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         });

//         if (!response.ok) {
//           throw new Error("Failed to fetch files");
//         }

//         const data = await response.json();
//         setFiles(data);
//       } catch (err) {
//         if (err instanceof Error) {
//           setError(err.message);
//         } else {
//           setError("An unexpected error occurred");
//         }
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchFiles();
//   }, [token]);

//   const handleDownload = async (fileId: string, filename: string) => {
//     try {
//       const response = await fetch(
//         `http://localhost:8000/processed_files/${fileId}/download`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to download file");
//       }

//       const blob = await response.blob();
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = url;
//       a.download = filename;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(url);
//       document.body.removeChild(a);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(err.message);
//       } else {
//         setError("An unexpected error occurred during download");
//       }
//     }
//   };

//   const getFileExtension = (filename: string) => {
//     if (!filename) return "";
//     return filename.split(".").pop()?.toLowerCase() || "";
//   };

//   const renderFilesTable = (files: ProcessedFile[], title: string) => (
//     <div className="file-section">
//       <h2>{title}</h2>
//       {files.length === 0 ? (
//         <p>No {title.toLowerCase()} found</p>
//       ) : (
//         <table className="files-table">
//           <thead>
//             <tr>
//               <th>Filename</th>
//               <th>Status</th>
//               <th>Message</th>
//               <th>Date</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {files.map((file) => (
//               <tr key={file.id} className={file.status}>
//                 <td>{file.filename || "N/A"}</td>
//                 <td className={`status ${file.status}`}>
//                   {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
//                 </td>
//                 <td>{file.message}</td>
//                 <td>{new Date(file.created_at).toLocaleString()}</td>
//                 <td>
//                   <button
//                     className="download-button"
//                     onClick={() =>
//                       handleDownload(String(file.id), file.filename)
//                     }
//                     disabled={file.status !== "completed"}
//                   >
//                     Download
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );

//   if (loading) {
//     return <div className="loading">Loading files...</div>;
//   }

//   if (error) {
//     return <div className="error-message">Error: {error}</div>;
//   }

//   // Filter files by type
//   const excelFiles = files.filter((file) => {
//     const ext = getFileExtension(file.filename);
//     return ext === "xlsx" || ext === "xls" || ext === "csv";
//   });

//   const textFiles = files.filter((file) => {
//     const ext = getFileExtension(file.filename);
//     return ext === "txt" || ext === "md" || ext === "json" || ext === "xml";
//   });

//   const otherFiles = files.filter((file) => {
//     const ext = getFileExtension(file.filename);
//     return !["xlsx", "xls", "csv", "txt", "md", "json", "xml"].includes(ext);
//   });

//   return (
//     <div className="files-list">
//       <h1>Processed Files</h1>

//       {files.length === 0 ? (
//         <p>No processed files found</p>
//       ) : (
//         <>
//           {renderFilesTable(excelFiles, "Excel Files")}
//           {renderFilesTable(textFiles, "Text Files")}
//           {otherFiles.length > 0 && renderFilesTable(otherFiles, "Other Files")}
//         </>
//       )}
//     </div>
//   );
// };

// export default FilesList;
// import React, { useEffect, useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { ProcessedFile } from "../types";

// // Add this new interface for directory files
// interface DirectoryFile {
//   filename: string;
//   filepath: string;
//   size: number;
//   created_at: string;
//   type: string;
// }

// // Add this interface for the API response
// interface DirectoryFilesResponse {
//   excel_files: DirectoryFile[];
//   text_files: DirectoryFile[];
// }

// const FilesList: React.FC = () => {
//   const { token } = useAuth();
//   const [files, setFiles] = useState<ProcessedFile[]>([]);
//   const [directoryFiles, setDirectoryFiles] = useState<DirectoryFilesResponse>({
//     excel_files: [],
//     text_files: [],
//   });
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [activeTab, setActiveTab] = useState<"database" | "directory">(
//     "database"
//   );

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);

//         // Fetch processed files from database
//         const filesResponse = await fetch(
//           "http://localhost:8000/processed_files_pf",
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );

//         if (!filesResponse.ok) {
//           throw new Error("Failed to fetch pf files");
//         }

//         const filesData = await filesResponse.json();
//         setFiles(filesData);

//         // Fetch directory files
//         const dirFilesResponse = await fetch(
//           "http://localhost:8000/directory_files_pf",
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );

//         if (!dirFilesResponse.ok) {
//           throw new Error("Failed to fetch pf directory files");
//         }

//         const dirFilesData = await dirFilesResponse.json();
//         setDirectoryFiles(dirFilesData);
//       } catch (err) {
//         if (err instanceof Error) {
//           setError(err.message);
//         } else {
//           setError("An unexpected error occurred");
//         }
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, [token]);

//   const handleDatabaseFileDownload = async (
//     fileId: string,
//     filename: string,
//     fileType?: string
//   ) => {
//     try {
//       // Build URL with optional file_type query parameter
//       let url = `http://localhost:8000/processed_files_pf/${fileId}/download${
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
//         fileType === "txt" ? filename.split(".")[0] + ".txt" : filename;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(downloadUrl);
//       document.body.removeChild(a);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(err.message);
//       } else {
//         setError("An unexpected error occurred during download");
//       }
//     }
//   };

//   const handleDirectoryFileDownload = async (
//     filename: string,
//     fileType: string
//   ) => {
//     try {
//       const response = await fetch(
//         `http://localhost:8000/directory_files_pf/${fileType}/${encodeURIComponent(filename)}`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to download file");
//       }

//       const blob = await response.blob();
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       a.href = url;
//       a.download = filename;
//       document.body.appendChild(a);
//       a.click();
//       window.URL.revokeObjectURL(url);
//       document.body.removeChild(a);
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(err.message);
//       } else {
//         setError("An unexpected error occurred during download");
//       }
//     }
//   };

//   const getFileExtension = (filename: string) => {
//     if (!filename) return "";
//     return filename.split(".").pop()?.toLowerCase() || "";
//   };

//   const renderFilesTable = (files: ProcessedFile[], title: string) => (
//     <div className="file-section">
//       <h2>{title}</h2>
//       {files.length === 0 ? (
//         <p>No {title.toLowerCase()} found</p>
//       ) : (
//         <table className="files-table">
//           <thead>
//             <tr>
//               <th>Filename</th>
//               <th>Status</th>
//               <th>Message</th>
//               <th>Date</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {files.map((file) => (
//               <tr key={file.id} className={file.status}>
//                 <td>{file.filename || "N/A"}</td>
//                 <td className={`status ${file.status}`}>
//                   {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
//                 </td>
//                 <td>{file.message}</td>
//                 <td>{new Date(file.created_at).toLocaleString()}</td>
//                 <td>
//                   {file.status === "success" ? (
//                     <div className="download-buttons">
//                       <button
//                         className="download-button"
//                         onClick={() =>
//                           handleDatabaseFileDownload(
//                             String(file.id),
//                             file.filename
//                           )
//                         }
//                       >
//                         Excel
//                       </button>
//                       <button
//                         className="download-button"
//                         onClick={() =>
//                           handleDatabaseFileDownload(
//                             String(file.id),
//                             file.filename,
//                             "txt"
//                           )
//                         }
//                       >
//                         Text
//                       </button>
//                     </div>
//                   ) : (
//                     <button className="download-button" disabled={file.status !== "sucess"}>
//                       Download
//                     </button>
//                   )}
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );

//   const renderDirectoryFilesTable = (
//     files: DirectoryFile[],
//     title: string,
//     fileType: string
//   ) => (
//     <div className="file-section">
//       <h2>{title}</h2>
//       {files.length === 0 ? (
//         <p>No {title.toLowerCase()} found</p>
//       ) : (
//         <table className="files-table">
//           <thead>
//             <tr>
//               <th>Filename</th>
//               <th>Size</th>
//               <th>Created At</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {files.map((file) => (
//               <tr key={`${file.type}-${file.filename}-${file.created_at}`}>
//                 <td>{file.filename}</td>
//                 <td>{formatFileSize(file.size)}</td>
//                 <td>{new Date(file.created_at).toLocaleString()}</td>
//                 <td>
//                   <button
//                     className="download-button"
//                     onClick={() =>
//                       handleDirectoryFileDownload(file.filename, fileType)
//                     }
//                   >
//                     Download
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       )}
//     </div>
//   );

//   // Helper function to format file size
//   const formatFileSize = (bytes: number) => {
//     if (bytes < 1024) return bytes + " B";
//     else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
//     else return (bytes / 1048576).toFixed(2) + " MB";
//   };

//   if (loading) {
//     return <div className="loading">Loading files...</div>;
//   }

//   if (error) {
//     return <div className="error-message">Error: {error}</div>;
//   }

//   // Filter database files by type
//   const excelFiles = files.filter((file) => {
//     const ext = getFileExtension(file.filename);
//     return ext === "xlsx" || ext === "xls" || ext === "csv";
//   });

//   const textFiles = files.filter((file) => {
//     const ext = getFileExtension(file.filename);
//     return ext === "txt" || ext === "md" || ext === "json" || ext === "xml";
//   });

//   const otherFiles = files.filter((file) => {
//     const ext = getFileExtension(file.filename);
//     return !["xlsx", "xls", "csv", "txt", "md", "json", "xml"].includes(ext);
//   });

//   return (
//     <div className="files-list">
//       <h1>Processed Files</h1>

//       <div className="tabs">
//         <button
//           className={activeTab === "database" ? "active" : ""}
//           onClick={() => setActiveTab("database")}
//         >
//           Database Files
//         </button>
//         <button
//           className={activeTab === "directory" ? "active" : ""}
//           onClick={() => setActiveTab("directory")}
//         >
//           Directory Files
//         </button>
//       </div>

//       {activeTab === "database" ? (
//         // Database files view
//         <>
//           {files.length === 0 ? (
//             <p>No processed files found in database</p>
//           ) : (
//             <>
//               {renderFilesTable(excelFiles, "Excel Files")}
//               {renderFilesTable(textFiles, "Text Files")}
//               {otherFiles.length > 0 &&
//                 renderFilesTable(otherFiles, "Other Files")}
//             </>
//           )}
//         </>
//       ) : (
//         // Directory files view
//         <>
//           {directoryFiles.excel_files.length === 0 &&
//           directoryFiles.text_files.length === 0 ? (
//             <p>No files found in directories</p>
//           ) : (
//             <>
//               {renderDirectoryFilesTable(
//                 directoryFiles.excel_files,
//                 "Excel Files from Directory",
//                 "excel"
//               )}
//               {renderDirectoryFilesTable(
//                 directoryFiles.text_files,
//                 "Text Files from Directory",
//                 "text"
//               )}
//             </>
//           )}
//         </>
//       )}
//     </div>
//   );
// };

// export default FilesList;
// import React, { useEffect, useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { ProcessedFile } from "../types";

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

//   useEffect(() => {
//     const fetchFiles = async () => {
//       try {
//         setLoading(true);
//         setError("");

//         const response = await fetch("http://localhost:8000/processed_files_pf", {
//           headers: { Authorization: `Bearer ${token}` }
//         });

//         if (!response.ok) {
//           throw new Error(await response.text() || "Failed to fetch PF files");
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

//   const handleDownload = async (fileId: string, fileType: 'xlsx' | 'txt' = 'xlsx') => {
//     try {
//       setDownloading(fileId);
//       setError("");

//       const url = `http://localhost:8000/processed_files_pf/${fileId}/download?file_type=${fileType}`;
//       const response = await fetch(url, {
//         headers: { Authorization: `Bearer ${token}` }
//       });

//       if (!response.ok) {
//         throw new Error(await response.text() || "Download failed");
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
//         <button onClick={() => window.location.reload()}>Retry</button>
//       </div>
//     );
//   }

//   return (
//     <div className="pf-files-container">
//       <h1>Processed PF Files</h1>

//       {files.length === 0 ? (
//         <p className="no-files">No PF files processed yet</p>
//       ) : (
//         <table className="pf-files-table">
//           <thead>
//             <tr>
//               <th>Filename</th>
//               <th>UAN No</th>
//               <th>Status</th>
//               <th>Processed Date</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {files.map((file) => (
//               <tr key={`pf-${file.id}`} className={`status-${file.status}`}>
//                 <td>{file.filename || "N/A"}</td>
//                 <td>{file.uan_no || "N/A"}</td>
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
//                         onClick={() => handleDownload(String(file.id), 'xlsx')}
//                         disabled={downloading === String(file.id)}
//                       >
//                         {downloading === String(file.id) ? "Downloading..." : "Excel"}
//                       </button>
//                       <button
//                         onClick={() => handleDownload(String(file.id), 'txt')}
//                         disabled={downloading === String(file.id)}
//                       >
//                         {downloading === String(file.id) ? "Downloading..." : "Text"}
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
}

const PFFilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<PFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "http://localhost:8000/processed_files_pf",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          throw new Error(
            (await response.text()) || "Failed to fetch PF files"
          );
        }

        const data = await response.json();
        setFiles(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load files");
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [token]);

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

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading PF files...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="files-list">
        <p className="error-message">{error}</p>
        <button
          className="submit-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="files-list">
      <h1>Processed PF Files</h1>

      {files.length === 0 ? (
        <p>No PF files processed yet</p>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Status</th>
              <th>Processed Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={`pf-${file.id}`} className={file.status}>
                <td>{file.filename || "N/A"}</td>
                <td>
                  <span className={`status ${file.status}`}>
                    {file.status.toUpperCase()}
                  </span>
                </td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
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
