import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";
import { useAppContext } from "../hooks/useAppContext";

const StatusBadge = ({ status }) => {
  const styles = {
    AUTHORISED: 'bg-amber-100 text-amber-800 border-amber-200',
    PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    VOIDED: 'bg-red-100 text-red-800 border-red-200',
    DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
    SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'PAID' ? 'bg-emerald-500' : status === 'AUTHORISED' ? 'bg-amber-500' : 'bg-gray-400'}`} />
      {status || "N/A"}
    </span>
  );
};

const StatCard = ({ label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
    <p className="text-sm text-[#64748B] mb-1">{label}</p>
    <p className="text-2xl font-bold text-[#1A1A1A]">{value}</p>
    {sub && <p className="text-xs text-[#64748B] mt-1">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const { error, showError, clearError, isConnected, setIsConnected } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [sortField, setSortField] = useState('Date');
  const [sortDir, setSortDir] = useState('desc');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const response = await api.get("/api/invoices");
        if (!cancelled) {
          setInvoices(response.data.invoices || []);
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

  const sorted = [...invoices].sort((a, b) => {
    const field = sortField === 'Amount' ? (a.Total ?? 0) - (b.Total ?? 0) : new Date(a[sortField]) - new Date(b[sortField]);
    return sortDir === 'asc' ? field : -field;
  });

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.Total ?? 0), 0);
  const paid = invoices.filter(i => i.Status === 'PAID');
  const authorised = invoices.filter(i => i.Status === 'AUTHORISED');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#059669] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#64748B] animate-pulse">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {error && <ErrorAlert message={error} onClose={clearError} />}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-serif font-bold text-xl text-[#1A1A1A]">BankSync</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">Connected to Xero</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/upload")}
              className="text-sm bg-[#059669] text-white px-4 py-2 rounded-full hover:bg-emerald-700 transition flex items-center gap-2"
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
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-serif font-bold text-3xl text-[#1A1A1A]">Invoices</h1>
          <p className="text-[#64748B] mt-1">Manage and review your Xero invoices</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Invoices" value={invoices.length} />
          <StatCard label="Total Amount" value={`£${totalAmount.toLocaleString()}`} />
          <StatCard label="Paid" value={paid.length} sub={`£${paid.reduce((s, i) => s + (i.Total ?? 0), 0).toLocaleString()}`} />
          <StatCard label="Awaiting Payment" value={authorised.length} sub={`£${authorised.reduce((s, i) => s + (i.Total ?? 0), 0).toLocaleString()}`} />
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1A1A]">All Invoices ({invoices.length})</h2>
            <div className="text-sm text-[#64748B]">
              Sorted by {sortField} ({sortDir})
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[#64748B]">No invoices found in your Xero organisation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 text-xs text-[#64748B] uppercase tracking-wider">
                    {['Invoice #', 'Contact', 'Date', 'Due Date', 'Amount', 'Status'].map((h, i) => (
                      <th key={h} className="py-3 px-6 text-left font-medium cursor-pointer hover:text-[#1A1A1A] transition"
                        onClick={() => { setSortField(['InvoiceNumber', 'Contact', 'Date', 'DueDate', 'Total', 'Status'][i]); setSortDir(f => f === 'asc' ? 'desc' : 'asc'); }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((inv, idx) => (
                    <tr key={inv.InvoiceID} className="border-t border-gray-50 hover:bg-[#FDFBF7] transition group">
                      <td className="py-4 px-6">
                        <span className="font-medium text-[#1A1A1A] group-hover:text-[#059669] transition">{inv.InvoiceNumber || "N/A"}</span>
                      </td>
                      <td className="py-4 px-6 text-sm text-[#64748B]">{inv.Contact?.Name || "N/A"}</td>
                      <td className="py-4 px-6 text-sm text-[#64748B]">
                        {inv.Date ? new Date(inv.Date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A"}
                      </td>
                      <td className="py-4 px-6 text-sm text-[#64748B]">
                        {inv.DueDate ? new Date(inv.DueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A"}
                      </td>
                      <td className="py-4 px-6 font-semibold text-[#1A1A1A]">
                        {inv.CurrencyCode || "£"}{(inv.Total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
