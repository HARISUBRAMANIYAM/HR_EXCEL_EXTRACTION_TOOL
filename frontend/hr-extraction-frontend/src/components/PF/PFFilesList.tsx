// export default PFFilesList;
import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { ProcessedFile } from "../../types";
import api from "../../services/api";

interface PFFile extends ProcessedFile {
  uan_no?: string;
  member_name?: string;
  remittance_submitted?: boolean;
  remittance_date?: string;
  remittance_challan_path?: string;
  upload_date?: string;
}

const PFFilesList: React.FC = () => {
  const { token, user } = useAuth();
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
  const [uploadDate, setUploadDate] = useState<string>(
    new Date().toISOString().split("T")[0] // Today's date
  );
  const [uploadingRemittance, setUploadingRemittance] = useState<number | null>(
    null
  );
  const [remittanceDate, setRemittanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    fetchFiles();
  }, [token, uploadDate, selectedUserId]);

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

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError("");
      toast.info("Loading PF files...", { autoClose: 2000 });
      
      // Build the params object
      const params: Record<string, string> = {
        upload_date: uploadDate
      };

      if (user?.role === "admin" && selectedUserId) {
        params.user_id = selectedUserId.toString();
      }

      const response = await api.get("/processed_files_pf", { params });
      setFiles(response.data);
      toast.success("PF files loaded successfully", { autoClose: 3000 });
      setSelectedFiles([]);
      setSelectAll(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load files";
      setError(errorMessage);
      toast.error(errorMessage);
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

      const response = await api.get(
        `/processed_files_pf/${fileId}/download?file_type=${fileType}`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
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
      toast.warning("Please select at least one file to download");
      setError("Please select at least one file to download");
      return;
    }

    setError("");
    try {
      toast.info(`Preparing ${selectedFiles.length} files for download...`);
      const fileIdsParam = selectedFiles.join(",");
      
      const response = await api.get(
        `/processed_files_pf/batch_download?file_ids=${fileIdsParam}`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `pf_files_bundle_${uploadDate}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      toast.success(`Downloaded ${selectedFiles.length} files successfully`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Batch download failed";
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  const handleRemittanceDownload = async (fileId: number) => {
    try {
      setDownloading(`remittance-${fileId}`);
      toast.info("Downloading remittance challan...");
      setError("");

      const response = await api.get(
        `/processed_files_pf/${fileId}/remittance_challan`,
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
      setError(
        err instanceof Error ? err.message : "Remittance download error"
      );
    } finally {
      setDownloading(null);
    }
  };

  const handleUploadRemittance = async (fileId: number) => {
    if (!remittanceFile || !remittanceDate) {
      toast.warning("Please select a remittance file and date");
      setError("Please select a remittance file and date");
      return;
    }

    try {
      setUploadingRemittance(fileId);
      toast.info("Uploading remittance file...");
      setError("");

      const formData = new FormData();
      formData.append("remittance_date", remittanceDate);
      formData.append("remittance_file", remittanceFile);
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };  
      await api.post(
        `/processed_files_pf/${fileId}/submit_remittance`,
        formData,
        config
      );

      toast.success("Remittance uploaded successfully");
      fetchFiles();
      setRemittanceFile(null);
      setUploadingRemittance(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Remittance upload failed";
      toast.error(errorMessage);
      setError(errorMessage);
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
        <p>Loading PF Remittance...</p>
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
              <label htmlFor="date-selector">Select Date:</label>
              <input
                type="date"
                id="date-selector"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="date-input"
              />
              {/* Add user selector for Admin role */}
              {user?.role && user.role === "admin" && (
                <div className="user-selector">
                  <label htmlFor="user-selector">User:</label>
                  <select
                    id="user-selector"
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
          <h1 style={{ fontWeight: "bold" }}>Processed PF Remittance</h1>
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
          <p className="no-files">No PF Remittance found for this date</p>
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
                          onClick={() =>
                            handleDownload(String(file.id), "xlsx")
                          }
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
    </>
  );
};

export default PFFilesList;