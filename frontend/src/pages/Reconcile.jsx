import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";

const formatDate = (dateInput) => {
  if (!dateInput) return "N/A";
  if (typeof dateInput === "string" && dateInput.includes("/Date(")) {
    const ms = parseInt(dateInput.match(/\d+/)[0]);
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return new Date(dateInput).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#059669] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#64748B] animate-pulse font-medium">Running Intelligent Matching...</p>
        </div>
      </div>
    );
  }

  const { summary, buckets } = data;

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
        invoice_id: item.xero_invoice.InvoiceID
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
        invoice_id: item.InvoiceID
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
  const getFilteredItems = () => {
    let items = [...buckets[activeTab]];

    // 1. Unified Text Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      items = items.filter(item => {
        const d = getNormData(item);
        return (
          d.desc.toLowerCase().includes(s) ||
          d.name.toLowerCase().includes(s) ||
          d.ref.toLowerCase().includes(s) ||
          d.amount.toString().includes(s)
        );
      });
    }

    // 2. Date Range Clipping
    if (dateRange.start || dateRange.end) {
      items = items.filter(item => {
        const d = getNormData(item).date;
        if (dateRange.start && d < new Date(dateRange.start)) return false;
        if (dateRange.end && d > new Date(dateRange.end)) return false;
        return true;
      });
    }

    // 3. Amount Magnitude Filter (Uses absolute value for bank transactions)
    if (amountRange.min || amountRange.max) {
      items = items.filter(item => {
        const amt = Math.abs(getNormData(item).amount);
        if (amountRange.min && amt < parseFloat(amountRange.min)) return false;
        if (amountRange.max && amt > parseFloat(amountRange.max)) return false;
        return true;
      });
    }

    // 4. Deterministic Sort
    items.sort((a, b) => {
      const dA = getNormData(a);
      const dB = getNormData(b);
      if (sortBy === "amount-asc") return dA.amount - dB.amount;
      if (sortBy === "amount-desc") return dB.amount - dA.amount;
      if (sortBy === "date-asc") return dA.date - dB.date;
      return dB.date - dA.date;
    });

    return items;
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Manual Match Modal */}
      {manualMatchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-serif font-bold text-xl text-[#1A1A1A]">Manual Match</h3>
                <p className="text-xs text-[#64748B] font-medium mt-1">Linking: {manualMatchTarget.description} ({manualMatchTarget.amount.toFixed(2)})</p>
              </div>
              <button onClick={() => { setManualMatchTarget(null); setModalSearch(""); }} className="p-2 hover:bg-white rounded-full transition shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
            </div>
            
            {/* Search Section for Modal */}
            <div className="px-6 py-4 bg-white border-b border-gray-100">
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <input 
                  type="text"
                  placeholder="Search contact, reference or amount..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                      <p className="text-gray-400">No matching unmatched invoices found.</p>
                      {modalSearch && <button onClick={() => setModalSearch("")} className="text-emerald-600 text-sm font-bold mt-2 hover:underline">Clear Search</button>}
                    </div>
                  );
                }

                return items.map(inv => (
                  <div key={inv.InvoiceID} className="p-4 rounded-2xl border border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/20 transition group flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-[#64748B] mb-1">{inv.InvoiceNumber} • {formatDate(inv.DateString || inv.Date)}</p>
                      <p className="font-bold text-[#1A1A1A]">{inv.Contact?.Name}</p>
                      <p className="text-lg font-black text-[#1A1A1A]">{inv.Total.toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => handleAction("approve", manualMatchTarget.id, inv.InvoiceID)}
                      disabled={isMatching}
                      className="bg-[#059669] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      Match This
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/upload")} className="text-[#64748B] hover:text-[#1A1A1A] transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="font-serif font-bold text-xl text-[#1A1A1A]">Reconciliation Report</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">Upload ID: {uploadId.slice(0,8)}...</span>
            <button 
              onClick={handleConfirmAll}
              disabled={isMatching || buckets.matched.length === 0}
              className="bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
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
            { label: "Matched", count: summary.matched_count, color: "emerald", icon: "✓" },
            { label: "Possible", count: summary.possible_count, color: "amber", icon: "!" },
            { label: "Bank (Unmatched)", count: summary.unmatched_bank_count, color: "red", icon: "×" },
            { label: "Xero (Unmatched)", count: summary.unmatched_xero_count, color: "blue", icon: "?" },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-${stat.color === 'blue' ? 'blue' : stat.color === 'amber' ? 'amber' : stat.color === 'red' ? 'red' : 'emerald'}-500`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-3xl font-extrabold text-${stat.color === 'blue' ? 'blue-600' : stat.color === 'amber' ? 'amber-600' : stat.color === 'red' ? 'red-600' : 'emerald-600'}`}>{stat.count}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg bg-${stat.color === 'blue' ? 'blue-50' : stat.color === 'amber' ? 'amber-50' : stat.color === 'red' ? 'red-50' : 'emerald-50'} text-${stat.color === 'blue' ? 'blue-600' : stat.color === 'amber' ? 'amber-600' : stat.color === 'red' ? 'red-600' : 'emerald-600'} flex items-center justify-center font-bold`}>{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8 space-y-6">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            {/* Bucket Navigation Tabs */}
            <div className="flex gap-1 bg-gray-50 p-1.5 rounded-2xl w-full lg:w-fit overflow-x-auto scrollbar-hide">
              {["matched", "possible", "unmatched_bank", "unmatched_xero"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setSearchTerm(""); }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap uppercase tracking-widest ${
                    activeTab === tab 
                    ? "bg-white text-[#059669] shadow-md shadow-emerald-500/10 scale-[1.02]" 
                    : "text-[#64748B] hover:text-[#1A1A1A] hover:bg-gray-100/50"
                  }`}
                >
                  {tab.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative group flex-1 sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400 group-focus-within:text-[#059669] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                  type="text" 
                  placeholder={`Search...`}
                  className="w-full bg-gray-50 border-none pl-11 pr-4 py-3 rounded-2xl text-sm font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-[#059669]/20 focus:bg-white transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="relative sm:w-48">
                <select 
                  className="w-full appearance-none bg-gray-50 border-none pl-4 pr-10 py-3 rounded-2xl text-sm font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#059669]/20 focus:bg-white transition-all cursor-pointer shadow-inner"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Range Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">Start Date</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full bg-gray-50 border-none px-4 py-2.5 rounded-xl text-xs font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#059669]/20 transition-all shadow-inner"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">End Date</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full bg-gray-50 border-none px-4 py-2.5 rounded-xl text-xs font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#059669]/20 transition-all shadow-inner"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">Min Amount ($)</label>
              <input type="number" placeholder="0.00" value={amountRange.min} onChange={(e) => setAmountRange(prev => ({...prev, min: e.target.value}))} className="w-full bg-gray-50 border-none px-4 py-2.5 rounded-xl text-xs font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#059669]/20 transition-all shadow-inner"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">Max Amount ($)</label>
              <input type="number" placeholder="999,999" value={amountRange.max} onChange={(e) => setAmountRange(prev => ({...prev, max: e.target.value}))} className="w-full bg-gray-50 border-none px-4 py-2.5 rounded-xl text-xs font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#059669]/20 transition-all shadow-inner"/>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-24 text-center">
              <p className="text-[#64748B] font-medium">No results found for your search/filters.</p>
              <button onClick={() => { setSearchTerm(""); setDateRange({start:"",end:""}); setAmountRange({min:"",max:""}); }} className="mt-4 text-[#059669] text-sm font-bold hover:underline">Clear all filters</button>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300">
                {activeTab === "matched" || activeTab === "possible" ? (
                  <div className="flex flex-col">
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-50">
                      {/* Bank Side */}
                      <div className="flex-1 p-6 bg-gray-50/30">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">Bank Transaction</span>
                          <span className="text-xs text-[#64748B] font-medium">{item.bank_transaction.transaction_date}</span>
                        </div>
                        <p className="font-bold text-[#1A1A1A] mb-1 leading-tight">{item.bank_transaction.description}</p>
                        <p className="text-xl font-black text-[#1A1A1A]">${item.bank_transaction.amount.toFixed(2)}</p>
                      </div>

                      {/* Match Score Divider */}
                      <div className="px-6 py-4 md:py-0 flex items-center justify-center bg-white">
                        <div className="text-center">
                          {item.is_ambiguous && (
                            <div className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-black uppercase mb-1.5 whitespace-nowrap shadow-sm">
                              Ambiguous
                            </div>
                          )}
                          <div className={`text-sm font-black ${item.confidence >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {item.confidence}%
                          </div>
                          <div className="text-[10px] text-[#64748B] uppercase font-black tracking-tighter">Match</div>
                        </div>
                      </div>

                      {/* Xero Side */}
                      <div className="flex-1 p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Xero Invoice</span>
                          <span className="text-xs text-[#64748B] font-medium">
                            {item.xero_invoice.InvoiceNumber} • {formatDate(item.xero_invoice.DateString || item.xero_invoice.Date)}
                          </span>
                        </div>
                        <p className="font-bold text-[#1A1A1A] mb-1 leading-tight">{item.xero_invoice.Contact?.Name}</p>
                        <p className="text-xl font-black text-[#1A1A1A]">${(item.xero_invoice.Total || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    {/* Actions Footer */}
                    <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {item.is_manual ? "● Manually Verified" : activeTab === "matched" ? "● Auto-Suggested" : "● Needs Review"}
                      </span>
                      <div className="flex gap-2">
                        {activeTab === "possible" ? (
                          <>
                            <button 
                              onClick={() => handleAction("reject", item.bank_transaction.id, item.xero_invoice.InvoiceID)}
                              disabled={isMatching}
                              className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleAction("approve", item.bank_transaction.id, item.xero_invoice.InvoiceID)}
                              disabled={isMatching}
                              className="px-5 py-2 text-xs font-bold bg-[#059669] text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition disabled:opacity-50"
                            >
                              Approve Match
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleAction("unreconcile", item.bank_transaction.id)}
                            disabled={isMatching}
                            className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-900 rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Unlink
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : activeTab === "unmatched_bank" ? (
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Unmatched</span>
                        <span className="text-xs text-[#64748B] font-medium">{item.transaction_date}</span>
                      </div>
                      <p className="font-bold text-[#1A1A1A] leading-tight">{item.description}</p>
                    </div>
                    <div className="text-right ml-6">
                      <p className="text-2xl font-black text-[#1A1A1A] mb-2">${item.amount.toFixed(2)}</p>
                      <button 
                        onClick={() => setManualMatchTarget(item)}
                        className="bg-white border border-gray-200 text-[#059669] px-4 py-2 rounded-xl text-xs font-bold hover:border-emerald-500 hover:bg-emerald-50 transition shadow-sm"
                      >
                        Find Match Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">Outstanding</span>
                        <span className="text-xs text-[#64748B] font-medium">
                          {item.InvoiceNumber} • {formatDate(item.DateString || item.Date)}
                        </span>
                      </div>
                      <p className="font-bold text-[#1A1A1A] leading-tight">{item.Contact?.Name}</p>
                    </div>
                    <div className="text-right ml-6">
                      <p className="text-2xl font-black text-[#1A1A1A] mb-2">${(item.Total || 0).toFixed(2)}</p>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full font-black uppercase tracking-wider">Unpaid</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
