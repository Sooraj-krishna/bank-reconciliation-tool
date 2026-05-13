import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";
import ThemeToggle from "../components/ThemeToggle";

const formatDate = (dateInput) => {
  if (!dateInput) return "N/A";
  if (typeof dateInput === "string" && dateInput.includes("/Date(")) {
    const ms = parseInt(dateInput.match(/\d+/)[0]);
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return new Date(dateInput).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatAmount = (amount, type) => {
  const val = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const t = type?.toUpperCase();
  const isOutflow = amount < 0 || t === 'ACCPAY' || t === 'ACCRECCREDIT';
  
  return (
    <span className={isOutflow ? "text-red-500 font-bold" : "text-app-emerald font-bold"}>
      {isOutflow ? "-" : "+"} ${val}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const t = type?.toUpperCase();
  const isOutflow = t === 'ACCPAY' || t === 'ACCRECCREDIT';
  let label = 'Invoice';
  if (t === 'ACCPAY') label = 'Bill';
  if (t?.includes('CREDIT')) label = 'Credit Note';
  
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border ${
      isOutflow 
        ? 'bg-red-500/10 text-red-500 border-red-500/20' 
        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    }`}>
      {label}
    </span>
  );
};

export default function Reconcile() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("matched");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [isMatching, setIsMatching] = useState(false); // Global spinner for action buttons
  const [manualMatchTarget, setManualMatchTarget] = useState(null); // Row selected for manual linking
  const [modalSearch, setModalSearch] = useState(""); // Search term for the Manual Match modal
  const [downloading, setDownloading] = useState(false); // Spinner for report generation

  // Range Filters: Used to drill down into specific transaction segments
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [amountRange, setAmountRange] = useState({ min: "", max: "" });

  /**
   * Main data fetching function.
   * Refreshes the entire report state (buckets + summary) from the backend.
   */
  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reconcile/${uploadId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to run reconciliation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [uploadId]);

  /**
   * Universal handler for all reconciliation actions (Approve, Reject, Unlink).
   * After the backend update, it refreshes the UI state locally.
   */
  const handleAction = async (type, bankId, invoiceId) => {
    if (isMatching) return; // RE-ENTRY GUARD: Prevents double-clicks if network is slow
    setIsMatching(true);
    try {
      let endpoint = "/api/reconcile/approve";
      if (type === "reject") endpoint = "/api/reconcile/reject";
      if (type === "unreconcile") endpoint = `/api/reconcile/unreconcile/${bankId}`;

      if (type === "unreconcile") {
        await api.post(endpoint);
      } else {
        await api.post(endpoint, { bank_id: bankId, invoice_id: invoiceId });
      }
      
      // Refreshing results moves the item between buckets instantly (e.g., Possible -> Matched)
      await fetchResults();
      setManualMatchTarget(null); // Close manual modal if it was open
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${type} match.`);
    } finally {
      setIsMatching(false);
    }
  };

  /**
   * Bulk Action: Approves all high-confidence suggestions in the current 'Matched' bucket.
   */
  const handleConfirmAll = async () => {
    if (isMatching) return; // RE-ENTRY GUARD
    setIsMatching(true);
    try {
      // We only approve items that haven't been manually verified yet
      const matchedToApprove = buckets.matched.filter(m => !m.is_manual);
      for (const m of matchedToApprove) {
        await api.post("/api/reconcile/approve", { 
          bank_id: m.bank_transaction.id, 
          invoice_id: m.xero_invoice.InvoiceID 
        });
      }
      await fetchResults();
    } catch (err) {
      setError("Failed to confirm all matches.");
    } finally {
      setIsMatching(false);
    }
  };

  /**
   * Triggers the backend Excel generation and handles the binary stream download.
   */
  const handleDownloadReport = async () => {
    if (downloading) return; // RE-ENTRY GUARD
    setDownloading(true);
    try {
      const response = await api.get(`/api/reconcile/report/${uploadId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `reconciliation_report_${uploadId.slice(0, 8)}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError("Failed to generate report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const summary = data?.summary || {};
  const buckets = data?.buckets || {
    matched: [],
    possible: [],
    unmatched_bank: [],
    unmatched_xero: []
  };

  /**
   * THE NORMALIZE-EXTRACT PATTERN
   * ----------------------------
   * Different buckets contain different object shapes.
   * This helper converts any item into a unified "Searchable Interface" 
   * so that filtering and sorting logic can be shared.
   */
  const getNormData = (item) => {
    // Shape: { bank_transaction, xero_invoice, confidence }
    if (item.bank_transaction && item.xero_invoice) {
      return {
        amount: item.bank_transaction.amount,
        date: new Date(item.bank_transaction.transaction_date),
        desc: item.bank_transaction.description || "",
        name: item.xero_invoice.Contact?.Name || "",
        ref: item.xero_invoice.InvoiceNumber || "",
        bank_id: item.bank_transaction.id,
        invoice_id: item.xero_invoice.InvoiceID,
        is_xero: true
      };
    }
    // Shape: { InvoiceNumber, Total, Contact, ... }
    if (item.InvoiceID) {
      return {
        amount: item.Total || 0,
        date: new Date(item.DateString || item.Date),
        desc: item.Reference || "",
        name: item.Contact?.Name || "",
        ref: item.InvoiceNumber || "",
        invoice_id: item.InvoiceID,
        is_xero: true
      };
    }
    // Shape: { transaction_date, description, amount }
    return {
      amount: item.amount || 0,
      date: new Date(item.transaction_date),
      desc: item.description || "",
      name: "",
      ref: "",
      bank_id: item.id
    };
  };

  /**
   * COMPOSITE FILTERING ENGINE
   * --------------------------
   * Chains text search, date ranges, and amount ranges before applying sorts.
   */
  const filteredItems = useMemo(() => {
    let items = [...buckets[activeTab]];

    // 1. Unified Text Search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(item => {
        const normalizedData = getNormData(item);
        return (
          normalizedData.desc.toLowerCase().includes(searchLower) ||
          normalizedData.name.toLowerCase().includes(searchLower) ||
          normalizedData.ref.toLowerCase().includes(searchLower) ||
          normalizedData.amount.toString().includes(searchLower)
        );
      });
    }

    // 2. Date Range Clipping
    if (dateRange.start || dateRange.end) {
      items = items.filter(item => {
        const normalizedDate = getNormData(item).date;
        if (dateRange.start && normalizedDate < new Date(dateRange.start)) return false;
        if (dateRange.end && normalizedDate > new Date(dateRange.end)) return false;
        return true;
      });
    }

    // 3. Amount Magnitude Filter (Uses absolute value for bank transactions)
    if (amountRange.min || amountRange.max) {
      items = items.filter(item => {
        const magnitudeAmount = Math.abs(getNormData(item).amount);
        if (amountRange.min && magnitudeAmount < parseFloat(amountRange.min)) return false;
        if (amountRange.max && magnitudeAmount > parseFloat(amountRange.max)) return false;
        return true;
      });
    }

    // 4. Deterministic Sort
    items.sort((a, b) => {
      const dataA = getNormData(a);
      const dataB = getNormData(b);

      // 4a. If searching, prioritize relevance (Exact > Starts With > Contains)
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        
        const getPriority = (data) => {
          const name = (data.name || "").toLowerCase();
          const ref = (data.ref || "").toLowerCase();
          const desc = (data.desc || "").toLowerCase();
          
          if (name === s || ref === s) return 3; // Exact match on high-value fields
          if (name.startsWith(s) || ref.startsWith(s)) return 2; // Starts with on high-value fields
          if (desc === s) return 1.5; // Exact match on description
          if (desc.startsWith(s)) return 1.2; // Starts with on description
          return 1; // Substring match (all items in the list passed the filter)
        };

        const priA = getPriority(dataA);
        const priB = getPriority(dataB);

        if (priA !== priB) return priB - priA; // Higher priority moves up
      }

      // 4b. Secondary Sort: Use selected field (Date/Amount)
      if (sortBy === "amount-asc") return dataA.amount - dataB.amount;
      if (sortBy === "amount-desc") return dataB.amount - dataA.amount;
      if (sortBy === "date-asc") return dataA.date - dataB.date;
      return dataB.date - dataA.date;
    });

    return items;
  }, [buckets, activeTab, searchTerm, dateRange, amountRange, sortBy]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-app-emerald border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-app-text-muted animate-pulse font-bold tracking-widest uppercase text-xs">Running Intelligent Matching...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors duration-300">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Manual Match Modal */}
      {manualMatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-app-surface rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-app-border transition-all">
            <div className="p-6 border-b border-app-border flex justify-between items-center bg-app-muted/30">
              <div>
                <h3 className="font-serif font-bold text-xl text-app-text">Manual Match</h3>
                <p className="text-xs text-app-text-muted font-bold mt-1 uppercase tracking-widest">Linking: {manualMatchTarget.description} ({manualMatchTarget.amount.toFixed(2)})</p>
              </div>
              <button onClick={() => { setManualMatchTarget(null); setModalSearch(""); }} className="p-2 hover:bg-app-muted rounded-full transition text-app-text-muted hover:text-app-text"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            </div>
            
            {/* Search Section for Modal */}
            <div className="px-6 py-4 bg-app-surface border-b border-app-border">
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <input 
                  type="text"
                  placeholder="Search contact, reference or amount..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-app-muted border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-emerald/20 focus:border-app-emerald transition-all text-app-text"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
              {(() => {
                const s = modalSearch.toLowerCase();
                const items = buckets.unmatched_xero.filter(inv => {
                  if (!s) return true;
                  return (
                    inv.Contact?.Name?.toLowerCase().includes(s) ||
                    inv.InvoiceNumber?.toLowerCase().includes(s) ||
                    inv.Total?.toString().includes(s)
                  );
                });

                // Relevance Sorting Logic
                items.sort((a, b) => {
                  if (!s) return 0;
                  const nameA = (a.Contact?.Name || "").toLowerCase();
                  const nameB = (b.Contact?.Name || "").toLowerCase();
                  
                  // 1. Exact matches first
                  if (nameA === s && nameB !== s) return -1;
                  if (nameB === s && nameA !== s) return 1;
                  
                  // 2. "Starts With" matches second
                  const startsA = nameA.startsWith(s);
                  const startsB = nameB.startsWith(s);
                  if (startsA && !startsB) return -1;
                  if (startsB && !startsA) return 1;
                  
                  // Keep original order otherwise
                  return 0;
                });

                if (items.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <p className="text-app-text-muted font-bold">No matching unmatched invoices found.</p>
                      {modalSearch && <button onClick={() => setModalSearch("")} className="text-app-emerald text-sm font-black mt-2 hover:underline">Clear Search</button>}
                    </div>
                  );
                }

                return items.map(inv => (
                  <div key={inv.InvoiceID} className="p-4 rounded-2xl border border-app-border hover:border-app-emerald hover:bg-app-emerald/5 transition group flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-app-text-muted mb-1 uppercase tracking-widest">{inv.InvoiceNumber} • {formatDate(inv.DateString || inv.Date)}</p>
                      <p className="font-bold text-app-text">{inv.Contact?.Name}</p>
                      <p className="text-xl font-black text-app-text">${inv.Total.toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => handleAction("approve", manualMatchTarget.id, inv.InvoiceID)}
                      disabled={isMatching}
                      className="bg-app-emerald text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-app-emerald/20 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {isMatching ? "Linking..." : "Match This"}
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-app-surface/90 backdrop-blur-md border-b border-app-border sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/upload")} className="text-app-text-muted hover:text-app-text transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="font-serif font-bold text-xl text-app-text tracking-tight">Reconciliation Report</div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden md:inline text-[10px] bg-app-muted text-app-text-muted px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-app-border">Upload ID: {uploadId.slice(0,8)}...</span>
            <button 
              onClick={handleDownloadReport}
              disabled={downloading || loading}
              className="flex items-center gap-2 bg-app-surface border border-app-border text-app-text px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:border-app-emerald hover:text-app-emerald transition disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {downloading ? "Exporting..." : "Export Report"}
            </button>
            <button 
              onClick={handleConfirmAll}
              disabled={isMatching || buckets.matched.length === 0}
              className="bg-app-emerald text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg shadow-app-emerald/20 hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isMatching ? "Confirming..." : "Confirm All Matches"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Matched", count: summary.matched_count, amount: summary.matched_amount, color: "emerald", icon: "✓" },
            { label: "Possible", count: summary.possible_count, amount: summary.possible_amount, color: "amber", icon: "!" },
            { label: "Bank (Unmatched)", count: summary.unmatched_bank_count, amount: summary.unmatched_bank_amount, color: "red", icon: "×" },
            { label: "Xero (Unmatched)", count: summary.unmatched_xero_count, amount: summary.unmatched_xero_amount, color: "blue", icon: "?" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm border-l-4 ${stat.color === 'blue' ? 'border-l-blue-500' : stat.color === 'amber' ? 'border-l-amber-500' : stat.color === 'red' ? 'border-l-red-500' : 'border-l-app-emerald'} transition-all`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-2xl font-black ${stat.color === 'blue' ? 'text-blue-500' : stat.color === 'amber' ? 'text-amber-500' : stat.color === 'red' ? 'text-red-500' : 'text-emerald-500'}`}>{stat.count}</p>
                    <p className="text-xs text-app-text-muted font-bold uppercase">Items</p>
                  </div>
                  <p className="text-sm font-bold text-app-text mt-1">
                    ${(stat.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-lg ${
                  stat.color === 'blue' ? 'bg-blue-500/10 text-blue-500' : 
                  stat.color === 'amber' ? 'bg-amber-500/10 text-amber-500' : 
                  stat.color === 'red' ? 'bg-red-500/10 text-red-500' : 
                  'bg-app-emerald/10 text-app-emerald'
                } flex items-center justify-center font-bold shadow-inner`}>{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Controls Bar */}
        <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm mb-8 space-y-6 transition-all">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            {/* Bucket Navigation Tabs */}
            <div className="flex gap-1 bg-app-muted p-1.5 rounded-2xl w-full lg:w-fit overflow-x-auto scrollbar-hide">
              {["matched", "possible", "unmatched_bank", "unmatched_xero"].map((tab) => {
                const count = summary[`${tab}_count`] || 0;
                const amount = summary[`${tab}_amount`] || 0;
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSearchTerm(""); }}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest flex items-center gap-2 ${
                      activeTab === tab 
                      ? "bg-app-surface text-app-emerald shadow-md shadow-emerald-500/10 scale-[1.02]" 
                      : "text-app-text-muted hover:text-app-text hover:bg-app-muted/50"
                    }`}
                  >
                    <span>{tab.replace("_", " ")}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${activeTab === tab ? 'bg-app-emerald/10 text-app-emerald' : 'bg-app-muted text-app-text-muted'}`}>
                      ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <div className="relative group flex-1 sm:w-48">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-app-text-muted group-focus-within:text-app-emerald transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={`Search...`}
                  className="w-full bg-app-muted border border-app-border pl-9 pr-4 py-2 rounded-xl text-xs font-bold text-app-text placeholder:text-app-text-muted focus:ring-2 focus:ring-app-emerald/20 focus:bg-app-surface transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="relative sm:w-40">
                <select 
                  className="w-full appearance-none bg-app-muted border border-app-border pl-3 pr-8 py-2 rounded-xl text-xs font-black text-app-text focus:ring-2 focus:ring-app-emerald/20 focus:bg-app-surface transition-all cursor-pointer shadow-inner uppercase tracking-wider"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-app-text-muted">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Range Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-app-border">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted ml-1">Start Date</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full bg-app-muted border border-app-border px-4 py-2.5 rounded-xl text-xs font-bold text-app-text focus:ring-2 focus:ring-app-emerald/20 transition-all shadow-inner [color-scheme:light] dark:[color-scheme:dark]"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted ml-1">End Date</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full bg-app-muted border border-app-border px-4 py-2.5 rounded-xl text-xs font-bold text-app-text focus:ring-2 focus:ring-app-emerald/20 transition-all shadow-inner [color-scheme:light] dark:[color-scheme:dark]"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted ml-1">Min Amount ($)</label>
              <input type="number" placeholder="0.00" value={amountRange.min} onChange={(e) => setAmountRange(prev => ({...prev, min: e.target.value}))} className="w-full bg-app-muted border border-app-border px-4 py-2.5 rounded-xl text-xs font-bold text-app-text focus:ring-2 focus:ring-app-emerald/20 transition-all shadow-inner"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-muted ml-1">Max Amount ($)</label>
              <input type="number" placeholder="999,999" value={amountRange.max} onChange={(e) => setAmountRange(prev => ({...prev, max: e.target.value}))} className="w-full bg-app-muted border border-app-border px-4 py-2.5 rounded-xl text-xs font-bold text-app-text focus:ring-2 focus:ring-app-emerald/20 transition-all shadow-inner"/>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-app-surface rounded-3xl border border-dashed border-app-border py-24 text-center">
              <p className="text-app-text-muted font-bold">No results found for your search/filters.</p>
              <button onClick={() => { setSearchTerm(""); setDateRange({start:"",end:""}); setAmountRange({min:"",max:""}); }} className="mt-4 text-app-emerald text-sm font-black hover:underline">Clear all filters</button>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div key={idx} className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden group hover:border-app-emerald/50 hover:shadow-xl hover:shadow-app-emerald/5 transition-all duration-300">
                {activeTab === "matched" || activeTab === "possible" ? (
                  <div className="flex flex-col">
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-app-border">
                      {/* Bank Side */}
                      <div className="flex-1 p-6 bg-app-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-blue-500/20">Bank Transaction</span>
                          <span className="text-xs text-app-text-muted font-bold">{item.bank_transaction.transaction_date}</span>
                        </div>
                        <p className="font-bold text-app-text mb-1 leading-tight">{item.bank_transaction.description}</p>
                        <p className="text-xl font-black">
                          {formatAmount(item.bank_transaction.amount)}
                        </p>
                      </div>

                      {/* Match Score Divider */}
                      <div className="px-6 py-4 md:py-0 flex items-center justify-center bg-app-surface border-x border-app-border">
                        <div className="text-center">
                          {item.is_ambiguous && (
                            <div className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full font-black uppercase mb-1.5 whitespace-nowrap shadow-sm border border-amber-500/20">
                              Ambiguous
                            </div>
                          )}
                          <div className={`text-sm font-black ${item.confidence >= 85 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {item.confidence}%
                          </div>
                          <div className="text-[10px] text-app-text-muted uppercase font-black tracking-tighter">Match</div>
                        </div>
                      </div>

                      {/* Xero Side */}
                      <div className="flex-1 p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <TypeBadge type={item.xero_invoice.Type} />
                          <span className="text-xs text-app-text-muted font-bold">
                            {item.xero_invoice.InvoiceNumber} • {formatDate(item.xero_invoice.DateString || item.xero_invoice.Date)}
                          </span>
                        </div>
                        <p className="font-bold text-app-text mb-1 leading-tight">{item.xero_invoice.Contact?.Name}</p>
                        <p className="text-xl font-black">
                          {formatAmount(item.xero_invoice.Total || 0, item.xero_invoice.Type)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions Footer */}
                    <div className="px-6 py-4 bg-app-muted/50 border-t border-app-border flex justify-between items-center">
                      <span className="text-[10px] text-app-text-muted font-medium">
                        {item.is_manual ? "● Manually Verified" : activeTab === "matched" ? "● Auto-Suggested" : "● Needs Review"}
                      </span>
                      <div className="flex gap-2">
                        {activeTab === "possible" ? (
                          <>
                            <button 
                              onClick={() => handleAction("reject", item.bank_transaction.id, item.xero_invoice.InvoiceID)}
                              disabled={isMatching}
                              className="px-4 py-2 text-xs font-black text-red-500 hover:bg-red-500/10 rounded-xl transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleAction("approve", item.bank_transaction.id, item.xero_invoice.InvoiceID)}
                              disabled={isMatching}
                              className="px-5 py-2 text-xs font-black bg-app-emerald text-white rounded-xl shadow-lg shadow-app-emerald/20 hover:opacity-90 transition disabled:opacity-50"
                            >
                              Approve Match
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleAction("unreconcile", item.bank_transaction.id)}
                            disabled={isMatching}
                            className="px-4 py-2 text-xs font-black text-app-text-muted hover:text-app-text rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {isMatching ? "Unlinking..." : "Unlink"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : activeTab === "unmatched_bank" ? (
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded font-bold uppercase">Unmatched</span>
                        <span className="text-xs text-app-text-muted font-medium">{item.transaction_date}</span>
                      </div>
                      <p className="font-bold text-app-text leading-tight">{item.description}</p>
                    </div>
                    <div className="text-right ml-6">
                      <p className="text-2xl font-black mb-2">{formatAmount(item.amount)}</p>
                      <button 
                        onClick={() => setManualMatchTarget(item)}
                        disabled={isMatching}
                        className="bg-app-surface border border-app-border text-app-emerald px-4 py-2 rounded-xl text-xs font-black hover:border-app-emerald hover:bg-app-emerald/5 transition shadow-sm disabled:opacity-50"
                      >
                        Find Match Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TypeBadge type={item.Type} />
                        <span className="text-xs text-app-text-muted font-medium">
                          {item.InvoiceNumber} • {formatDate(item.DateString || item.Date)}
                        </span>
                      </div>
                      <p className="font-bold text-app-text leading-tight">{item.Contact?.Name}</p>
                    </div>
                    <div className="text-right ml-6">
                      <p className="text-2xl font-black mb-2">{formatAmount(item.Total || 0, item.Type)}</p>
                      <span className="text-[10px] bg-app-muted text-app-text-muted px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-app-border">Unpaid</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {filteredItems.length > 0 && (
            <div className="flex justify-between items-center px-8 py-6 bg-app-surface rounded-3xl border border-app-emerald/20 shadow-xl shadow-app-emerald/5 mt-8 border-b-4 border-b-app-emerald">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-app-emerald/10 text-app-emerald rounded-2xl flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-0.5">{activeTab.replace("_", " ")} Summary</p>
                  <p className="text-sm font-bold text-app-text">Showing {filteredItems.length} transactions</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-0.5">Net Flow Result</p>
                <p className="text-3xl font-black">
                  {(() => {
                    const net = filteredItems.reduce((acc, item) => {
                      const rawAmt = activeTab === "unmatched_xero" 
                        ? (item.Total || 0)
                        : (item.bank_transaction?.amount || item.amount || 0);
                      const type = activeTab === "unmatched_xero"
                        ? item.Type
                        : (item.xero_invoice?.Type);
                      
                      const isOutflow = rawAmt < 0 || type === 'ACCPAY' || type === 'ACCRECCREDIT';
                      const signedAmt = isOutflow ? -Math.abs(rawAmt) : Math.abs(rawAmt);
                      return acc + signedAmt;
                    }, 0);
                    
                    return (
                      <span className={net < 0 ? "text-red-500" : "text-app-emerald"}>
                        {net < 0 ? "-" : "+"} ${Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    );
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
