/**
 * @file Upload.jsx
 * @description CSV upload page. Allows drag-and-drop or click-to-browse upload,
 *   displays cleaned results in a table, and lists past uploads for re-opening.
 *   Follows the same design system as Dashboard.jsx and Home.jsx.
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";
import UploadTable from "../components/UploadTable";
import ThemeToggle from "../components/ThemeToggle";

/**
 * Upload - Full page component for bank statement CSV management.
 *   Handles new uploads, displays results, and manages past uploads.
 */
export default function Upload() {
  const navigate = useNavigate();

  // State for new upload
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { upload_id, filename, row_count, duplicate_count, rows }

  // State for past uploads
  const [uploads, setUploads] = useState([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState(null); // { upload_id, filename, rows }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // upload_id pending delete

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  /**
   * Fetch past uploads from API on component mount.
   * GET /api/uploads returns list grouped by upload_id.
   */
  useEffect(() => {
    const fetchUploads = async () => {
      try {
        const res = await api.get("/api/uploads");
        setUploads(res.data);
      } catch (err) {
        console.error("Failed to fetch uploads:", err);
      } finally {
        setLoadingUploads(false);
      }
    };
    fetchUploads();
  }, []);

  /**
   * Handle file selection (from input or drop).
   * Validates file extension is .csv.
   */
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file (.csv extension required).");
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult(null);
  };

  /**
   * Upload the selected file to the backend.
   * POST /api/upload with multipart/form-data.
   */
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(res.data);

      // Refresh uploads list to include the new upload
      const uploadsRes = await api.get("/api/uploads");
      setUploads(uploadsRes.data);
      setFile(null);
    } catch (err) {
      const detail = err.response?.data?.detail || "Upload failed. Please try again.";
      setError(detail);
    } finally {
      setUploading(false);
    }
  };

  /**
   * View a past upload by fetching its rows.
   * GET /api/upload/{upload_id}
   */
  const handleSelectUpload = async (upload) => {
    try {
      const res = await api.get(`/api/upload/${upload.upload_id}`);
      setSelectedUpload({
        upload_id: upload.upload_id,
        filename: upload.filename,
        rows: res.data.rows,
      });
      setResult(null); // Hide new upload result if showing
    } catch (err) {
      setError("Failed to load upload. It may have been deleted.");
    }
  };

  /**
   * Delete a past upload after confirmation.
   * DELETE /api/upload/{upload_id}
   */
  const handleDeleteUpload = async (uploadId) => {
    try {
      await api.delete(`/api/upload/${uploadId}`);
      setUploads(uploads.filter(u => u.upload_id !== uploadId));

      if (selectedUpload?.upload_id === uploadId) {
        setSelectedUpload(null);
      }
    } catch (err) {
      setError("Failed to delete upload.");
    } finally {
      setDeleteConfirm(null);
    }
  };

  /**
   * Handle drag events for the drop zone.
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors duration-300">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Header - matches Dashboard.jsx */}
      <header className="bg-app-surface/90 backdrop-blur-md border-b border-app-border sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-app-text-muted hover:text-app-text transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="font-serif font-bold text-2xl text-app-text tracking-tight">BankSync</div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-app-text-muted hover:text-app-text transition font-bold"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif font-bold text-3xl text-app-text">Upload Bank Statement</h1>
          <p className="text-app-text-muted mt-1">Upload your bank CSV to start reconciliation</p>
        </div>

        {/* Upload Section */}
        <div className="bg-app-surface rounded-xl border border-app-border p-6 mb-8 transition-all">
          <h2 className="font-semibold text-app-text mb-4">New Upload</h2>

          {/* Drag-and-drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
              isDragging
                ? "border-app-emerald bg-app-emerald/10"
                : "border-app-border hover:border-app-emerald hover:bg-app-muted/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />

            <svg className="w-12 h-12 text-app-border mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            <p className="text-app-text font-medium mb-1">
              {file ? file.name : "Drop your CSV file here, or click to browse"}
            </p>
            <p className="text-sm text-app-text-muted">
              Supports .csv files with Date, Amount, and Description columns
            </p>
          </div>

          {/* Upload button */}
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`px-6 py-2.5 rounded-full font-bold text-sm transition ${
                !file || uploading
                  ? "bg-app-muted text-app-text-muted cursor-not-allowed opacity-50"
                  : "bg-app-emerald text-white hover:opacity-90 shadow-lg shadow-app-emerald/20"
              }`}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </span>
              ) : (
                "Upload CSV"
              )}
            </button>

            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
                className="text-sm text-app-text-muted hover:text-red-500 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Upload Result */}
        {result && (
          <div className="mb-8">
            {/* Success summary */}
            <div className="bg-app-emerald/10 border border-app-emerald/20 rounded-xl p-4 mb-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-app-emerald/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-app-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-app-emerald">{result.filename} uploaded successfully!</p>
                <p className="text-sm text-app-text-muted font-medium">
                  {result.row_count} rows processed
                  {result.duplicate_count > 0 && ` • ${result.duplicate_count} duplicate(s) flagged`}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <UploadTable rows={result.rows} onClose={() => setResult(null)} />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/reconcile/${result.upload_id}`)}
                className="bg-app-emerald text-white px-8 py-4 rounded-full font-black hover:opacity-90 shadow-xl shadow-app-emerald/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                🚀 Start Intelligent Matching
              </button>
            </div>
          </div>
        )}

        {/* Selected Past Upload */}
        {selectedUpload && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setSelectedUpload(null)}
                className="text-app-text-muted hover:text-app-text transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-serif font-bold text-2xl text-app-text">
                {selectedUpload.filename}
              </h2>
            </div>
            <UploadTable rows={selectedUpload.rows} onClose={() => setSelectedUpload(null)} />
          </div>
        )}

        {/* Past Uploads List */}
        {!selectedUpload && (
          <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden transition-all">
            <div className="px-6 py-4 border-b border-app-border">
              <h2 className="font-semibold text-app-text">Past Uploads</h2>
            </div>

            {loadingUploads ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-3 border-app-emerald border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-app-text-muted font-medium">No past uploads yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-app-border">
                {uploads.map((upload) => (
                  <div
                    key={upload.upload_id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-app-muted/50 transition group"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleSelectUpload(upload)}
                    >
                      <p className="font-medium text-app-text group-hover:text-app-emerald transition">
                        {upload.filename}
                      </p>
                      <p className="text-xs text-app-text-muted mt-1">
                        {new Date(upload.uploaded_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                        {' • '}{upload.row_count} rows
                        {upload.duplicate_count > 0 && ` • ${upload.duplicate_count} duplicate(s)`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectUpload(upload)}
                        className="text-xs text-app-emerald hover:opacity-70 font-bold transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => navigate(`/reconcile/${upload.upload_id}`)}
                        className="text-xs text-app-emerald hover:opacity-70 font-black transition"
                      >
                        Reconcile
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(upload.upload_id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-app-surface rounded-2xl p-6 max-w-sm w-full border border-app-border">
            <h3 className="font-bold text-app-text mb-2">Delete Upload?</h3>
            <p className="text-sm text-app-text-muted mb-6">
              This will permanently delete all rows from this upload. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-app-text-muted hover:text-app-text transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUpload(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-full hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
