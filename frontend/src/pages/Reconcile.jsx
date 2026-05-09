/**
 * @file Reconcile.jsx
 * @description The "Engine Room" of the application. 
 * This component manages the complex state of four reconciliation buckets,
 * handles real-time filtering, manual overrides (matching/rejecting),
 * and generates the final audit reports.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";

// --- UI Components ---
import ReconcileHeader from "../components/reconcile/ReconcileHeader";
import SummaryStats from "../components/reconcile/SummaryStats";
import BucketTabs from "../components/reconcile/BucketTabs";
import TransactionTable from "../components/reconcile/TransactionTable";
import ManualLinkModal from "../components/reconcile/ManualLinkModal";

export default function Reconcile() {
  const { uploadId } = useParams(); // Extract upload UUID from the URL
  const navigate = useNavigate();

  // --- Core Data State ---
  const [data, setData] = useState(null); // Full report object from backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false); // UI state for Excel export

  // --- UI/Interaction State ---
  const [activeTab, setActiveTab] = useState("matched"); // Currently selected bucket
  const [search, setSearch] = useState(""); // Description filter
  const [amountRange, setAmountRange] = useState({ min: "", max: "" }); // Price filter
  const [showManualModal, setShowManualModal] = useState(false); // Link picker modal
  const [selectedBankRow, setSelectedBankRow] = useState(null); // Targeted row for manual link
  const [actionLoading, setActionLoading] = useState(null); // Tracks ID of row being updated

  /**
   * Main Data Fetcher: Calls the reconciliation engine on the backend.
   * This is triggered on mount and after every manual approval/rejection.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reconcile/${uploadId}`);
      // Ensure we have a valid summary object to prevent component crashes
      if (!res.data || !res.data.summary) {
        throw new Error("Invalid report data received from server.");
      }
      setData(res.data);
      setError(""); // Clear any previous errors on success
    } catch (err) {
      // Robust error handling: capture 500s or network failures
      const msg = err.response?.data?.detail || "Failed to load reconciliation engine.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Action Handler: Approve a match (Manual or Suggested)
   */
  const handleApprove = async (bankId, invoiceId) => {
    setActionLoading(bankId);
    try {
      await api.post("/api/reconcile/approve", { bank_id: bankId, invoice_id: invoiceId });
      await fetchData(); // Refresh entire state to move rows between buckets
    } catch (err) {
      setError("Failed to approve match.");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Action Handler: Reject a suggested match
   */
  const handleReject = async (bankId, invoiceId) => {
    setActionLoading(bankId);
    try {
      await api.post("/api/reconcile/reject", { bank_id: bankId, invoice_id: invoiceId });
      await fetchData();
    } catch (err) {
      setError("Failed to reject match.");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Action Handler: Unreconcile (move from matched back to pending)
   */
  const handleUnreconcile = async (bankId) => {
    setActionLoading(bankId);
    try {
      await api.post(`/api/reconcile/unreconcile/${bankId}`);
      await fetchData();
    } catch (err) {
      setError("Failed to reset transaction.");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Action Handler: Trigger the Excel Report download
   */
  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      // Fetch the binary blob from the backend
      const response = await api.get(`/api/reconcile/report/${uploadId}/download`, {
        responseType: 'blob' 
      });
      
      // Create a temporary link element to trigger the browser's download dialog
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Set the filename - backend also sends this in headers, but we define a fallback here
      link.setAttribute('download', `reconciliation_report_${uploadId.slice(0,8)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove(); // Cleanup DOM
    } catch (err) {
      setError("Failed to download report. Please ensure your Xero session is still active.");
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Memoized Filter Logic: 
   * Runs the search and amount filters on the active bucket's data.
   */
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    // Get the raw list for the current tab
    const list = data.buckets[activeTab] || [];
    
    return list.filter(item => {
      // 1. Resolve nested transaction object based on bucket structure
      const bank = activeTab === "unmatched_bank" ? item : item.bank_transaction;
      
      // 2. Search Filter (Description)
      const matchesSearch = (bank.description || "").toLowerCase().includes(search.toLowerCase());
      
      // 3. Amount Range Filter
      const amt = Math.abs(bank.amount);
      const matchesMin = amountRange.min === "" || amt >= parseFloat(amountRange.min);
      const matchesMax = amountRange.max === "" || amt <= parseFloat(amountRange.max);
      
      return matchesSearch && matchesMin && matchesMax;
    });
  }, [data, activeTab, search, amountRange]);

  // Loading screen (Premium feel)
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#059669] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#64748B] font-medium animate-pulse">Running Intelligent Matching...</p>
        </div>
      </div>
    );
  }

  // Error Fallback UI (Now with 'Back' and 'Reconnect' options)
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#1A1A1A] mb-2">Reconciliation Error</h2>
          <p className="text-[#64748B] mb-8">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => window.location.href = '/auth/login'} className="w-full bg-[#059669] text-white py-3 rounded-full font-bold hover:bg-emerald-700 transition">
              Reconnect to Xero
            </button>
            <button onClick={() => navigate("/upload")} className="w-full border-2 border-gray-200 text-[#64748B] py-3 rounded-full font-bold hover:bg-gray-50 transition">
              Back to Uploads
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-20">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Persistent Page Header */}
      <ReconcileHeader 
        filename={data?.buckets.unmatched_bank?.[0]?.filename || "Statement"} 
        onExport={handleDownloadReport}
        isExporting={downloading}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Summary Cards */}
        <SummaryStats summary={data.summary} buckets={data.buckets} />

        {/* Tabbed Navigation for Buckets */}
        <div className="mt-8">
          <BucketTabs 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            counts={{
              matched: data.summary.matched_count,
              possible: data.summary.possible_count,
              unmatched_bank: data.summary.unmatched_bank_count,
              unmatched_xero: data.summary.unmatched_xero_count,
            }}
          />

          {/* Search & Filter Bar */}
          <div className="bg-white border-x border-b border-gray-100 p-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input 
                type="text" 
                placeholder="Search by description..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="number" placeholder="Min $" 
                className="w-24 px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                value={amountRange.min}
                onChange={(e) => setAmountRange({...amountRange, min: e.target.value})}
              />
              <span className="text-gray-400">-</span>
              <input 
                type="number" placeholder="Max $" 
                className="w-24 px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                value={amountRange.max}
                onChange={(e) => setAmountRange({...amountRange, max: e.target.value})}
              />
            </div>
          </div>

          {/* Main Data Table */}
          <TransactionTable 
            type={activeTab} 
            data={filteredData} 
            onApprove={handleApprove}
            onReject={handleReject}
            onUnreconcile={handleUnreconcile}
            onManualLink={(row) => {
              setSelectedBankRow(row);
              setShowManualModal(true);
            }}
            loadingId={actionLoading}
          />
        </div>
      </div>

      {/* Modal for manual search/link of Xero invoices */}
      {showManualModal && (
        <ManualLinkModal 
          bankRow={selectedBankRow}
          unmatchedXero={data.buckets.unmatched_xero}
          onClose={() => setShowManualModal(false)}
          onLink={handleApprove}
        />
      )}
    </div>
  );
}
