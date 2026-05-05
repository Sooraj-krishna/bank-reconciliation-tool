import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";

export default function Reconcile() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("matched");

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await api.get(`/api/reconcile/${uploadId}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to run reconciliation.");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [uploadId]);

  if (loading) {
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

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

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
            <button className="bg-[#059669] text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-emerald-700 transition">Confirm All Matches</button>
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
            <div key={stat.label} className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-${stat.color}-500`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-3xl font-extrabold text-${stat.color}-600`}>{stat.count}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center font-bold`}>{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bucket Navigation Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-100/50 p-1 rounded-xl w-fit">
          {["matched", "possible", "unmatched_bank", "unmatched_xero"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab 
                ? "bg-white text-[#1A1A1A] shadow-sm" 
                : "text-[#64748B] hover:text-[#1A1A1A]"
              }`}
            >
              {tab.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {buckets[activeTab].length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
              <p className="text-[#64748B]">No items in this bucket.</p>
            </div>
          ) : (
            buckets[activeTab].map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:border-emerald-200 transition-all">
                {activeTab === "matched" || activeTab === "possible" ? (
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-50">
                    {/* Bank Side */}
                    <div className="flex-1 p-6 bg-gray-50/30">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">Bank Transaction</span>
                        <span className="text-xs text-[#64748B] font-medium">{item.bank_transaction.transaction_date}</span>
                      </div>
                      <p className="font-bold text-[#1A1A1A] mb-1">{item.bank_transaction.description}</p>
                      <p className="text-xl font-black text-[#1A1A1A]">{item.bank_transaction.amount.toFixed(2)}</p>
                    </div>

                    {/* Match Score Divider */}
                    <div className="px-6 py-2 md:py-0 flex items-center justify-center bg-white">
                      <div className="text-center">
                        <div className={`text-xs font-bold ${item.confidence >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {item.confidence}%
                        </div>
                        <div className="text-[10px] text-[#64748B] uppercase font-bold">Confidence</div>
                      </div>
                    </div>

                    {/* Xero Side */}
                    <div className="flex-1 p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Xero Invoice</span>
                        <span className="text-xs text-[#64748B] font-medium">{item.xero_invoice.InvoiceNumber}</span>
                      </div>
                      <p className="font-bold text-[#1A1A1A] mb-1">{item.xero_invoice.Contact?.Name}</p>
                      <p className="text-xl font-black text-[#1A1A1A]">{(item.xero_invoice.Total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ) : activeTab === "unmatched_bank" ? (
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#64748B] font-medium mb-1">{item.transaction_date}</p>
                      <p className="font-bold text-[#1A1A1A]">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#1A1A1A]">{item.amount.toFixed(2)}</p>
                      <button className="text-xs text-[#059669] font-bold hover:underline">Find Match Manualy</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#64748B] font-medium mb-1">{item.InvoiceNumber} • {item.DateString?.slice(0,10)}</p>
                      <p className="font-bold text-[#1A1A1A]">{item.Contact?.Name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#1A1A1A]">{(item.Total || 0).toFixed(2)}</p>
                      <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold uppercase">Unpaid</span>
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
