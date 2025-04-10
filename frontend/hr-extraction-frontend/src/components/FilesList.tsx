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
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ProcessedFile } from "../types";

// Add this new interface for directory files
interface DirectoryFile {
  filename: string;
  filepath: string;
  size: number;
  created_at: string;
  type: string;
}

// Add this interface for the API response
interface DirectoryFilesResponse {
  excel_files: DirectoryFile[];
  text_files: DirectoryFile[];
}

const FilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [directoryFiles, setDirectoryFiles] = useState<DirectoryFilesResponse>({
    excel_files: [],
    text_files: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"database" | "directory">(
    "database"
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch processed files from database
        const filesResponse = await fetch(
          "http://localhost:8000/processed_files",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!filesResponse.ok) {
          throw new Error("Failed to fetch files");
        }

        const filesData = await filesResponse.json();
        setFiles(filesData);

        // Fetch directory files
        const dirFilesResponse = await fetch(
          "http://localhost:8000/directory_files",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!dirFilesResponse.ok) {
          throw new Error("Failed to fetch directory files");
        }

        const dirFilesData = await dirFilesResponse.json();
        setDirectoryFiles(dirFilesData);
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

    fetchData();
  }, [token]);

  const handleDatabaseFileDownload = async (
    fileId: string,
    filename: string,
    fileType?: string
  ) => {
    try {
      // Build URL with optional file_type query parameter
      let url = `http://localhost:8000/processed_files/${fileId}/download`;
      if (fileType) {
        url += `?file_type=${fileType}`;
      }

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
        fileType === "txt" ? filename.split(".")[0] + ".txt" : filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during download");
      }
    }
  };

  const handleDirectoryFileDownload = async (
    filename: string,
    fileType: string
  ) => {
    try {
      const response = await fetch(
        `http://localhost:8000/directory_files/${fileType}/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during download");
      }
    }
  };

  const getFileExtension = (filename: string) => {
    if (!filename) return "";
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const renderFilesTable = (files: ProcessedFile[], title: string) => (
    <div className="file-section">
      <h2>{title}</h2>
      {files.length === 0 ? (
        <p>No {title.toLowerCase()} found</p>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Status</th>
              <th>Message</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className={file.status}>
                <td>{file.filename || "N/A"}</td>
                <td className={`status ${file.status}`}>
                  {file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                </td>
                <td>{file.message}</td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
                  {file.status === "success" ? (
                    <div className="download-buttons">
                      <button
                        className="download-button"
                        onClick={() =>
                          handleDatabaseFileDownload(
                            String(file.id),
                            file.filename
                          )
                        }
                      >
                        Excel
                      </button>
                      <button
                        className="download-button"
                        onClick={() =>
                          handleDatabaseFileDownload(
                            String(file.id),
                            file.filename,
                            "txt"
                          )
                        }
                      >
                        Text
                      </button>
                    </div>
                  ) : (
                    <button className="download-button" disabled>
                      Download
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderDirectoryFilesTable = (
    files: DirectoryFile[],
    title: string,
    fileType: string
  ) => (
    <div className="file-section">
      <h2>{title}</h2>
      {files.length === 0 ? (
        <p>No {title.toLowerCase()} found</p>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.filepath}>
                <td>{file.filename}</td>
                <td>{formatFileSize(file.size)}</td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="download-button"
                    onClick={() =>
                      handleDirectoryFileDownload(file.filename, fileType)
                    }
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
    else return (bytes / 1048576).toFixed(2) + " MB";
  };

  if (loading) {
    return <div className="loading">Loading files...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  // Filter database files by type
  const excelFiles = files.filter((file) => {
    const ext = getFileExtension(file.filename);
    return ext === "xlsx" || ext === "xls" || ext === "csv";
  });

  const textFiles = files.filter((file) => {
    const ext = getFileExtension(file.filename);
    return ext === "txt" || ext === "md" || ext === "json" || ext === "xml";
  });

  const otherFiles = files.filter((file) => {
    const ext = getFileExtension(file.filename);
    return !["xlsx", "xls", "csv", "txt", "md", "json", "xml"].includes(ext);
  });

  return (
    <div className="files-list">
      <h1>Processed Files</h1>

      <div className="tabs">
        <button
          className={activeTab === "database" ? "active" : ""}
          onClick={() => setActiveTab("database")}
        >
          Database Files
        </button>
        <button
          className={activeTab === "directory" ? "active" : ""}
          onClick={() => setActiveTab("directory")}
        >
          Directory Files
        </button>
      </div>

      {activeTab === "database" ? (
        // Database files view
        <>
          {files.length === 0 ? (
            <p>No processed files found in database</p>
          ) : (
            <>
              {renderFilesTable(excelFiles, "Excel Files")}
              {renderFilesTable(textFiles, "Text Files")}
              {otherFiles.length > 0 &&
                renderFilesTable(otherFiles, "Other Files")}
            </>
          )}
        </>
      ) : (
        // Directory files view
        <>
          {directoryFiles.excel_files.length === 0 &&
          directoryFiles.text_files.length === 0 ? (
            <p>No files found in directories</p>
          ) : (
            <>
              {renderDirectoryFilesTable(
                directoryFiles.excel_files,
                "Excel Files from Directory",
                "excel"
              )}
              {renderDirectoryFilesTable(
                directoryFiles.text_files,
                "Text Files from Directory",
                "text"
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FilesList;
