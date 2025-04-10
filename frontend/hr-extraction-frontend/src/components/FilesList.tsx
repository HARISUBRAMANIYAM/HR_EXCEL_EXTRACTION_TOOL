// import React, { useEffect, useState } from "react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ProcessedFile } from "../types";

const FilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch("http://localhost:8000/processed_files", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch files");
        }

        const data = await response.json();
        setFiles(data);
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

    fetchFiles();
  }, [token]);

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const response = await fetch(
        `http://localhost:8000/processed_files/${fileId}/download`,
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
                  <button
                    className="download-button"
                    onClick={() =>
                      handleDownload(String(file.id), file.filename)
                    }
                    disabled={file.status !== "completed"}
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

  if (loading) {
    return <div className="loading">Loading files...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  // Filter files by type
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

      {files.length === 0 ? (
        <p>No processed files found</p>
      ) : (
        <>
          {renderFilesTable(excelFiles, "Excel Files")}
          {renderFilesTable(textFiles, "Text Files")}
          {otherFiles.length > 0 && renderFilesTable(otherFiles, "Other Files")}
        </>
      )}
    </div>
  );
};

export default FilesList;
