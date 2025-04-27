// export default PFFilesList;
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { ProcessedFile } from "../../types";

interface PFFile extends ProcessedFile {
  uan_no?: string;
  member_name?: string;
  remittance_submitted?: boolean;
  remittance_amount?: number;
  remittance_month?: string;
  remittance_challan_path?: string;
  remittance_date?: string;
}

const PFFilesList: React.FC = () => {
  // State declarations
  const { token, user } = useAuth();
  const [files, setFiles] = useState<PFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [remittanceAmount, setRemittanceAmount] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{
    key: "filename" | "created_at";
    direction: "asc" | "desc";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Date-related states
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const [uploadMonthInput, setUploadMonthInput] =
    useState<string>(currentYearMonth);
  const [uploadMonth, setUploadMonth] = useState<string>(
    formatDateForBackend(currentYearMonth)
  );
  const [uploadingRemittance, setUploadingRemittance] = useState<number | null>(
    null
  );
  const [remittanceMonthInput, setRemittanceMonthInput] =
    useState<string>(currentYearMonth);
  const [remittanceMonth, setRemittanceMonth] = useState<string>(
    formatDateForBackend(currentYearMonth)
  );
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  // Refs
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Utility functions
  function formatDateForBackend(dateString: string): string {
    if (!dateString) return "";
    const [year, month] = dateString.split("-");
    return `${month}-${year}`;
  }

  function formatDateForInput(dateString: string): string {
    if (!dateString) return "";
    const [month, year] = dateString.split("-");
    return `${year}-${month}`;
  }

  const formatNumberWithCommas = (value: string) => {
    const parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const removeCommas = (value: string) => {
    return value.replace(/,/g, "");
  };

  // Event handlers
  const handleUploadMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setUploadMonthInput(inputValue);
    setUploadMonth(formatDateForBackend(inputValue));
  };

  const handleRemittanceMonthChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputValue = e.target.value;
    setRemittanceMonthInput(inputValue);
    setRemittanceMonth(formatDateForBackend(inputValue));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    const numericInput = input;
    if (numericInput === "" || /^\d*\.?\d*$/.test(numericInput)) {
      setRemittanceAmount(numericInput);
    }
  };

  // const handleAmountBlur = () => {
  //   setRemittanceAmount((prev) => formatNumberWithCommas(prev));
  // };

  // Data fetching
  const fetchUsers = useCallback(async () => {
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
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      toast.info("Loading PF files...", { autoClose: 2000 });

      const params: Record<string, string> = {
        upload_month: uploadMonth,
      };

      if (user?.role === "admin" && selectedUserId) {
        params.user_id = selectedUserId.toString();
      }

      const response = await api.get("/processed_files_pf", {
        params,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
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
  }, [token, uploadMonth, selectedUserId, user?.role]);

  // File operations
  const handleDownload = async (
    fileId: string,
    fileType: "xlsx" | "txt" = "xlsx"
  ) => {
    try {
      setDownloading(fileId);
      setError("");

      const response = await api.get(
        `/processed_files_pf/${fileId}/download_new?file_type=${fileType}`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `pf_report_${fileId}_${uploadMonth}.${fileType}`;
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
        `/processed_files_pf/batch_download_new?file_ids=${fileIdsParam}`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `pf_files_bundle_${uploadMonth}.zip`;
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
        `/processed_files_pf/${fileId}/remittance_challan_new`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `remittance_challan_${fileId}_${uploadMonth}.pdf`;
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
    if (!remittanceFile || !remittanceMonth || !remittanceAmount) {
      toast.warning("Please fill all remittance details");
      setError("Please fill all remittance details");
      return;
    }

    try {
      setUploadingRemittance(fileId);
      toast.info("Uploading remittance file...");
      setError("");

      const formData = new FormData();
      const [year, month, day] = remittanceMonthInput.split("-");
      const formattedDate = `${day}-${month}-${year}`;

      formData.append("remittance_date", formattedDate);
      console.log(formattedDate);
      formData.append("remittance_amount", remittanceAmount); //.toString()
      console.log(remittanceAmount);
      formData.append("remittance_file", remittanceFile);
      console.log(remittanceFile);

      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      await api.post(
        `/processed_files_pf/${fileId}/submit_remittance_new`,
        formData,
        config
      );

      toast.success("Remittance uploaded successfully");
      fetchFiles();
      setRemittanceFile(null);
      setUploadingRemittance(null);
      setRemittanceAmount("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Remittance upload failed";
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setUploadingRemittance(null);
    }
  };

  // UI helpers
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

  const getMonthNameFromMMYYYY = (mmYYYY: string): string => {
    const [month, year] = mmYYYY.split("-").map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long" });
  };

  // Sorting and filtering
  const filteredAndSortedFiles = React.useMemo(() => {
    return [...files]
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
  }, [files, searchQuery, sortConfig]);

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

  // Effects
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  // Component for remittance upload form
  const RemittanceUploadForm = React.useCallback(
    ({ fileId }: { fileId: number }) => {
      // Focus the input when the form mounts
      useEffect(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
        }
      }, []);

      return (
        <div className="remittance-upload-form">
          <div className="remittance-fields">
            <input
              type="date"
              value={remittanceMonthInput}
              onChange={handleRemittanceMonthChange}
              aria-label="inputdate"
            />
            <input
              type="text"
              ref={amountInputRef}
              value={remittanceAmount}
              onChange={handleAmountChange}
              //onBlur={handleAmountBlur}
              placeholder="Amount"
              aria-label="amountinput"
            />
            <div style={{ display: "inline-block", position: "relative" }}>
              <label
                htmlFor="remittance-upload"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  borderRadius: "5px",
                  cursor: "pointer",
                  display: "inline-block",
                }}
              >
                Upload Remittance
              </label>
              <input
                id="remittance-upload"
                type="file"
                accept=".pdf"
                onChange={(e) => setRemittanceFile(e.target.files?.[0] || null)}
                aria-label="pdfinput"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
          <div className="remittance-actions">
            <button
              className="submit-button"
              onClick={() => handleUploadRemittance(fileId)}
              disabled={!remittanceFile || remittanceAmount === "0"}
            >
              Submit
            </button>
            <button
              className="cancel-button"
              onClick={() => {
                setUploadingRemittance(null);
                setRemittanceAmount("");
                setRemittanceFile(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    },
    [remittanceAmount, remittanceMonthInput, remittanceFile]
  );

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
            <div className="filters">
              <div className="filter-item">
                <label htmlFor="month-selector">Select Month:</label>
                <input
                  type="month"
                  id="month-selector"
                  value={uploadMonthInput}
                  onChange={handleUploadMonthChange}
                  className="date-input"
                />
              </div>

              {user?.role === "admin" && (
                <div className="filter-item">
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
                    {users.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button onClick={fetchFiles} className="refresh-button">
                Refresh
              </button>
            </div>

            <div className="search-box">
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
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
          <p className="no-files">No PF Remittance found for {uploadMonth}</p>
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
                <th>Month</th>
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
                {user?.role === "admin" && !selectedUserId && (
                  <th>Submitted BY</th>
                )}
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
                  <td>
                    {file.remittance_month
                      ? getMonthNameFromMMYYYY(file.remittance_month)
                      : "N/A"}
                  </td>
                  <td>{file.created_at.split("T")[0]}</td>
                  <td>
                    {file.status === "success" ? (
                      file.remittance_submitted ? (
                        <div className="remittance-info">
                          <span className="status-badge success">
                            Submitted {file.remittance_date} - ₹
                            {file.remittance_amount?.toFixed(2)}
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
                        <RemittanceUploadForm fileId={file.id} />
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
                  {user?.role === "admin" && !selectedUserId && (
                    <td>
                      {users.find((u) => u.id === file.user_id)?.name ||
                        "Unknown User"}
                    </td>
                  )}
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
