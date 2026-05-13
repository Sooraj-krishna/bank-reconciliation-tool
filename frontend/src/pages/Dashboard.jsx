import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";
import ThemeToggle from "../components/ThemeToggle";
import { useAppContext } from "../hooks/useAppContext";

const StatusBadge = ({ status }) => {
  const styles = {
    AUTHORISED: 'bg-amber-100 text-amber-800 border-amber-200',
    PAID: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    VOIDED: 'bg-red-100 text-red-800 border-red-200',
    DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
    SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'PAID' ? 'bg-cyan-500' : status === 'AUTHORISED' ? 'bg-amber-500' : 'bg-gray-400'}`} />
      {status || "N/A"}
    </span>
  );
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

const formatDate = (dateInput) => {
  if (!dateInput) return "N/A";
  // Handle Xero's /Date(1714915200000+0000)/ format
  if (typeof dateInput === "string" && dateInput.includes("/Date(")) {
    const match = dateInput.match(/\d+/);
    if (!match) return "N/A";
    const ms = parseInt(match[0]);
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // Handle standard date strings
  const date = new Date(dateInput);
  return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const StatCard = ({ label, value, sub }) => (
  <div className="bg-app-surface rounded-xl border border-app-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
    <p className="text-sm text-app-text-muted mb-1 font-bold uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-black text-app-text">{value}</p>
    {sub && <p className="text-xs text-app-text-muted mt-1 font-medium italic">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const { error, showError, clearError, isConnected, setIsConnected } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [sortField, setSortField] = useState('Date');
  const [sortDir, setSortDir] = useState('desc');
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const response = await api.get("/api/invoices");
        if (!cancelled) {
          const data = response.data;
          setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 401) {
            showError("Xero session expired. Please reconnect.");
            setIsConnected(false);
            navigate("/");
          } else {
            showError("Failed to fetch invoices from Xero. Please try again.");
            setInvoices([]);
            setLoading(false);
          }
        }
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [navigate, showError, setIsConnected]);

  const handleDisconnect = async () => {
    try {
      await api.get("/auth/logout");
    } finally {
      setIsConnected(false);
      navigate("/");
    }
  };

  // Safely compute stats and filter data
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  // Filter Logic
  const filtered = safeInvoices.filter(inv => {
    // 1. Status Filter
    if (statusFilter !== "ALL" && inv.Status !== statusFilter) return false;

    // 2. Search Term (Name, Invoice #, Reference)
    const s = searchTerm.toLowerCase();
    if (s && !(
      inv.Contact?.Name?.toLowerCase().includes(s) ||
      inv.InvoiceNumber?.toLowerCase().includes(s) ||
      inv.Reference?.toLowerCase().includes(s) ||
      inv.Total?.toString().includes(s)
    )) return false;

    // 3. Date Range
    const dStr = inv.Date || inv.DateString;
    if (dateRange.start || dateRange.end) {
      let invDate;
      if (dStr && dStr.includes("/Date(")) {
        const ms = parseInt(dStr.match(/\d+/)[0]);
        invDate = new Date(ms);
      } else {
        invDate = new Date(dStr);
      }
      
      if (dateRange.start && invDate < new Date(dateRange.start)) return false;
      if (dateRange.end && invDate > new Date(dateRange.end)) return false;
    }

    return true;
  });

  // Sort Logic
  const sorted = [...filtered].sort((a, b) => {
    // 1. If searching, prioritize relevance (Exact > Starts With > Contains)
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const nameA = (a.Contact?.Name || "").toLowerCase();
      const nameB = (b.Contact?.Name || "").toLowerCase();
      const invA = (a.InvoiceNumber || "").toLowerCase();
      const invB = (b.InvoiceNumber || "").toLowerCase();

      // Helper to check for exact or prefix matches
      const getPriority = (name, inv) => {
        if (name === s || inv === s) return 2; // Exact match
        if (name.startsWith(s) || inv.startsWith(s)) return 1; // Starts with
        return 0; // Substring match
      };

      const priA = getPriority(nameA, invA);
      const priB = getPriority(nameB, invB);

      if (priA !== priB) return priB - priA; // Higher priority moves up
    }

    // 2. Secondary Sort: Use selected field (Date/Amount)
    const field = sortField === 'Amount' ? (a.Total ?? 0) - (b.Total ?? 0) : new Date(a[sortField]) - new Date(b[sortField]);
    return sortDir === 'asc' ? field : -field;
  });

  const totalAmount = safeInvoices.reduce((sum, inv) => {
    const isOutflow = inv.Type === 'ACCPAY' || inv.Type === 'ACCRECCREDIT';
    return sum + (isOutflow ? -(inv.Total ?? 0) : (inv.Total ?? 0));
  }, 0);
  const paid = safeInvoices.filter(i => i.Status === 'PAID');
  const authorised = safeInvoices.filter(i => i.Status === 'AUTHORISED');

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-app-emerald border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-app-text-muted animate-pulse font-bold">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors duration-300">
      {error && <ErrorAlert message={error} onClose={clearError} />}

      {/* Header */}
      <header className="bg-app-surface/90 backdrop-blur-md border-b border-app-border sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-serif font-bold text-2xl text-app-text tracking-tight">BankSync</div>
            <span className="text-[10px] bg-app-emerald/10 text-app-emerald px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-app-emerald/20">Connected to Xero</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => navigate("/upload")}
              className="text-sm bg-app-emerald text-white px-4 py-2 rounded-full hover:opacity-90 transition flex items-center gap-2 font-bold shadow-lg shadow-app-emerald/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Statement
            </button>
            <button onClick={handleDisconnect} className="text-sm text-red-500 hover:text-red-700 font-medium transition flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Disconnect
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif font-bold text-3xl text-app-text tracking-tight">Invoices</h1>
          <p className="text-app-text-muted mt-1 font-medium">Manage and review your Xero invoices</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Invoices" value={safeInvoices.length} />
          <StatCard 
            label="Net Position" 
            value={(totalAmount < 0 ? "-" : "+") + " $" + Math.abs(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} 
          />
          <StatCard label="Paid" value={paid.length} sub={paid.reduce((s, i) => s + (i.Total ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          <StatCard label="Awaiting Payment" value={authorised.length} sub={authorised.reduce((s, i) => s + (i.Total ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
        </div>

        {/* Filters */}
        <div className="bg-app-surface rounded-xl border border-app-border p-4 mb-8 shadow-sm flex flex-wrap items-center gap-4 transition-all">
          <div className="flex-1 min-w-[240px] relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <input 
              type="text"
              placeholder="Search contact, reference or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-app-surface border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-emerald/20 focus:border-app-emerald transition-all text-app-text"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Status</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-emerald/20 focus:border-app-emerald transition-all text-app-text"
            >
              <option value="ALL">All Status</option>
              <option value="PAID">Paid</option>
              <option value="AUTHORISED">Awaiting Payment</option>
              <option value="DRAFT">Draft</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Dates</span>
            <div className="flex items-center bg-app-surface border border-app-border rounded-xl px-2">
              <input 
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent border-none py-2 px-1 text-xs focus:ring-0 text-app-text"
              />
              <span className="text-app-border">→</span>
              <input 
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent border-none py-2 px-1 text-xs focus:ring-0 text-app-text"
              />
            </div>
            {(dateRange.start || dateRange.end || searchTerm || statusFilter !== "ALL") && (
              <button 
                onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); setDateRange({ start: "", end: "" }); }}
                className="text-xs text-red-500 hover:text-red-700 font-bold ml-2 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
            <h2 className="font-bold text-app-text">Invoices ({sorted.length})</h2>
            <div className="text-xs text-app-text-muted font-bold uppercase tracking-widest">
              Sorted by {sortField} ({sortDir})
            </div>
          </div>

          {safeInvoices.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-app-border mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-app-text-muted font-medium">No invoices found in your Xero organisation.</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-app-border mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-app-text-muted font-medium">No invoices match your current filters.</p>
              <button 
                onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); setDateRange({ start: "", end: "" }); }}
                className="text-app-emerald font-bold mt-2 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-app-muted/50 text-xs text-app-text-muted uppercase tracking-widest">
                    {['Invoice #', 'Contact', 'Date', 'Due Date', 'Amount', 'Status'].map((h, i) => (
                      <th key={h} className="py-3 px-6 text-left font-bold cursor-pointer hover:text-app-text transition"
                        onClick={() => { setSortField(['InvoiceNumber', 'Contact', 'Date', 'DueDate', 'Total', 'Status'][i]); setSortDir(f => f === 'asc' ? 'desc' : 'asc'); }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((inv, idx) => (
                    <tr key={inv.InvoiceID} className="border-t border-app-border hover:bg-app-muted/50 transition group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeBadge type={inv.Type} />
                          <span className="font-bold text-app-text group-hover:text-app-emerald transition">{inv.InvoiceNumber || "N/A"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-app-text-muted font-medium">{inv.Contact?.Name || "N/A"}</td>
                      <td className="py-4 px-6 text-sm text-app-text-muted">
                        {formatDate(inv.Date || inv.DateString)}
                      </td>
                      <td className="py-4 px-6 text-sm text-app-text-muted">
                        {formatDate(inv.DueDate || inv.DueDateString)}
                      </td>
                      <td className="py-4 px-6">
                        {formatAmount(inv.Total || 0, inv.Type)}
                      </td>
                      <td className="py-4 px-6"><StatusBadge status={inv.Status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
