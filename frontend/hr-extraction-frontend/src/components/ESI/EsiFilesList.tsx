// export default EsiFilesList;
import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { ProcessedFile } from "../../types";
interface ESIFile extends ProcessedFile {
  remittance_submitted?: boolean;
  remittance_date?: string;
  remittance_challan_path?: string;
  upload_date?: string; // Add this field to match backend
}

const EsiFilesList: React.FC = () => {
  const { token, user } = useAuth(); // Assume user object contains role info
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
  const [uploadDate, setUploadDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null); // For admin filtering

  // For remittance challan upload
  const [uploadingRemittance, setUploadingRemittance] = useState<number | null>(
    null
  );
  const [remittanceDate, setRemittanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    fetchFiles();
  }, [token, uploadDate, selectedUserId]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError("");
      toast.info("Loading ESI files...", { autoClose: 2000 });

      const params: Record<string, string> = {
        upload_date: uploadDate,
      };

      // Add user_id parameter if admin and a user is selected
      if (user?.role === "admin" && selectedUserId) {
        params.user_id = selectedUserId.toString();
      }

      const response = await api.get("/processed_files_esi", { params });
      setFiles(response.data);
      // Reset selections when data changes
      toast.success("ESI files loaded successfully", { autoClose: 3000 });
      setSelectedFiles([]);
      setSelectAll(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load files";
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    }
  }, [user]);
  const fetchUsers = async () => {
    try {
      toast.info("Loading user list...", { autoClose: 1500 });
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load users";
      toast.error(errorMessage);
      setError(errorMessage);
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
      toast.info(`Downloading ${fileType.toUpperCase()} file...`);

      const response = await api.get(
        `/processed_files_esi/${fileId}/download?file_type=${fileType}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `esi_report_${fileId}.${fileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success(`Downloaded: ${filename.split(".")[0]}_esi.${fileType}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? `Download failed: ${err.message}`
          : "Download error";
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setDownloading(null);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.length === 0) {
      toast.warn("Please select files to download");
      setError("Please select at least one file to download");
      return;
    }

    setError("");
    try {
      toast.info(`Preparing ${selectedFiles.length} file(s) for download...`);
      const fileIdsParam = selectedFiles.join(",");
      //const url = `http://localhost:8000/processed_files_esi/batch_download?file_ids=${fileIdsParam}`;
      const response = await api.get(
        `/processed_files_esi/batch_download?file_ids=${fileIdsParam}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `esi_files_${uploadDate}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      toast.success(
        `Downloaded ${selectedFiles.length} file(s) as esi_files_${uploadDate}.zip`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Batch download failed";
      toast.error(errorMessage);
      setError(errorMessage);
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
      toast.error("Please select a remittance file");
      setError("Please select a remittance file");
      return;
    }

    try {
      setUploadingRemittance(fileId);
      const toastId = toast.loading("Uploading remittance...");
      setError("");

      const formData = new FormData();
      formData.append("remittance_date", remittanceDate);
      formData.append("remittance_file", remittanceFile);

      await api.post(
        `/processed_files_esi/${fileId}/submit_remittance`,
        formData
      );

      toast.update(toastId, {
        render: "Remittance uploaded successfully!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
      fetchFiles(); // Refresh the file list
      setRemittanceFile(null);
      // Close the upload form
      setUploadingRemittance(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setUploadingRemittance(null);
    }
  };

  const downloadRemittanceChallan = async (fileId: number) => {
    try {
      setDownloading(`remittance-${fileId}`);
      toast.info("Downloading remittance challan...");
      setError("");

      const response = await api.get(
        `/processed_files_esi/${fileId}/remittance_challan`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `remittance_challan_${fileId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success("Remittance challan downloaded");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Challan download failed";
      toast.error(errorMessage);
      setError(errorMessage);
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
        <p>Loading ESI Remittance...</p>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
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
      <div className="files-container">
        <div className="file-header">
          <div className="controls-container">
            <div className="date-selector">
              <label htmlFor="date-select">Select Date:</label>
              <input
                type="date"
                id="date-select"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="date-input"
              />
              {/* Add user selector for Admin role */}
              {user?.role === "admin" && (
                <div className="user-selector">
                  <label htmlFor="user-selector-esi">User:</label>
                  <select
                    id="user-selector-esi"
                    value={selectedUserId || ""}
                    onChange={(e) =>
                      setSelectedUserId(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="user-select"
                  >
                    <option value="">All Users</option>
                    {users.map((m) => {
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
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
          <h1 style={{ fontWeight: "bold" }}>Processed ESI Remittance</h1>
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
          <p className="no-files">
            No ESI Remittance processed for the selected date
          </p>
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
                              onChange={(e) =>
                                setRemittanceDate(e.target.value)
                              }
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
                            handleDownload(
                              String(file.id),
                              file.filename,
                              "txt"
                            )
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
    </>
  );
};

export default EsiFilesList;
