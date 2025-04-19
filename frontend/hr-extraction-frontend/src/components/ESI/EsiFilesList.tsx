// export default EsiFilesList;
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ProcessedFile } from "../../types";

const EsiFilesList: React.FC = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [sortConfig, setsortConfig] = useState<{
    key: "filename" | "created_at";
    direction: "asc" | "desc";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError("");

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
  const filteredandSortedFiles = [...files]
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
    setsortConfig((prev) => {
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
        <p>Loading ESI files...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button
          className="download-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="files-container">
      <div className="file-header">
        <div className="controls-container">
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <h1>Processed ESI Files</h1>
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

      {files.length === 0 ? (
        <p className="no-files">No ESI files processed yet</p>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredandSortedFiles.map((file) => (
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
