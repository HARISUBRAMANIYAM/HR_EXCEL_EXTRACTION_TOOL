// src/components/FolderUpload.tsx

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FileProcessResult } from "../types";

const FolderUpload: React.FC = () => {
  const { token } = useAuth();
  const [folderPath, setFolderPath] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<FileProcessResult | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) {
      setError("Folder path is required");
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("folder_path", folderPath);

      const response = await fetch("http://localhost:8000/process_folder", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process folder");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="folder-upload">
      <h1>Process Folder</h1>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="folderPath">Folder Path</label>
          <input
            id="folderPath"
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="Enter the full path to the folder containing Excel files"
            required
            disabled={processing}
          />
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={processing || !folderPath.trim()}
        >
          {processing ? "Processing..." : "Process Folder"}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className={`result-message ${result.status}`}>
          <h3>Result</h3>
          <p>
            <strong>Status:</strong>{" "}
            {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
          </p>
          <p>
            <strong>Message:</strong> {result.message}
          </p>
          <p>
            <strong>Folder Path:</strong> {result.file_path}
          </p>
        </div>
      )}

      <div className="instructions">
        <h3>Instructions</h3>
        <ol>
          <li>
            Enter the full path to the folder containing Excel files with
            employee data.
          </li>
          <li>
            The Excel files should have the following columns:
            <ul>
              <li>UAN No</li>
              <li>Employee Name</li>
              <li>Gross wages</li>
              <li>PF Gross</li>
              <li>LOP</li>
            </ul>
          </li>
          <li>
            Click "Process Folder" to start processing all Excel files in the
            folder.
          </li>
          <li>
            The system will generate the required reports in the Excel and text
            formats.
          </li>
        </ol>
      </div>
    </div>
  );
};

export default FolderUpload;
