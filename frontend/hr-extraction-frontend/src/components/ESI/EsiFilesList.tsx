import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ProcessedFile } from "../../types";

const EsiFilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/processed_files_esi",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch ESI files");
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

  const handleDownload = async (
    fileId: string,
    filename: string,
    fileType?: string
  ) => {
    setError("");
    try {
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
        setError(
          err instanceof Error
            ? `Download failed: ${err.message}`
            : "File download error"
        );
      } else {
        setError("An unexpected error occurred during download");
      }
    }
  };

  const getFileExtension = (filename: string) => {
    if (!filename) return "";
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const renderFilesTable = () => (
    <div className="file-section">
      <h2>Processed ESI Files</h2>
      {files.length === 0 ? (
        <p>No processed ESI files found</p>
      ) : (
        <table className="files-table">
          <thead>
            <tr>
              <th>Original Filename</th>
              <th>Status</th>
              <th>Message</th>
              <th>Date Processed</th>
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
                          handleDownload(String(file.id), file.filename)
                        }
                      >
                        Download Excel
                      </button>
                      <button
                        className="download-button"
                        onClick={() =>
                          handleDownload(String(file.id), file.filename, "txt")
                        }
                      >
                        Download Text
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

  if (loading) {
    return <div className="loading">Loading ESI files...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return <div className="esi-files-list">{renderFilesTable()}</div>;
};

export default EsiFilesList;
