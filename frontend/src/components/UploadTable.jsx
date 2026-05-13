/**
 * @file UploadTable.jsx
 * @description Displays cleaned bank statement rows in a sortable table.
 *   Shows date, description, amount, and duplicate status with appropriate styling.
 *   Matches Dashboard.jsx design system (white card, hover states, #64748B text).
 */

import { useState } from "react";

/**
 * UploadTable - Renders bank statement rows in a clean table.
 *
 * @param {Object} props
 * @param {Array} props.rows - Array of row objects with transaction_date, description, amount, is_duplicate
 * @param {Function} props.onClose - Callback to close/dismiss the table view
 */
export default function UploadTable({ rows, onClose }) {
  const [sortDir, setSortDir] = useState('desc');
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [amountRange, setAmountRange] = useState({ min: "", max: "" });

  // Filtering Logic
  const filtered = rows.filter(row => {
    // 1. Text Search (Description, Raw Description, Amount)
    const s = searchTerm.toLowerCase();
    if (s && !(
      row.description?.toLowerCase().includes(s) ||
      row.raw_description?.toLowerCase().includes(s) ||
      row.amount.toString().includes(s)
    )) return false;

    // 2. Date Range Clipping
    if (dateRange.start && row.transaction_date < dateRange.start) return false;
    if (dateRange.end && row.transaction_date > dateRange.end) return false;

    // 3. Amount Magnitude Filter
    const absAmt = Math.abs(row.amount);
    if (amountRange.min && absAmt < parseFloat(amountRange.min)) return false;
    if (amountRange.max && absAmt > parseFloat(amountRange.max)) return false;

    return true;
  });

  // Sort rows by relevance (if searching) and then date
  const sorted = [...filtered].sort((a, b) => {
    // 1. Relevance Sorting (Priority: Exact > Starts With > Contains)
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const descA = (a.description || "").toLowerCase();
      const descB = (b.description || "").toLowerCase();
      
      const getPriority = (d) => {
        if (d === s) return 2;
        if (d.startsWith(s)) return 1;
        return 0;
      };
      
      const priA = getPriority(descA);
      const priB = getPriority(descB);
      if (priA !== priB) return priB - priA;
    }

    // 2. Standard Date Sort
    const cmp = a.transaction_date.localeCompare(b.transaction_date);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  // Format amount with 2 decimal places (removed currency symbol)
  const formatAmount = (amt) => {
    return amt.toFixed(2);
  };

  return (
    <div className="w-full bg-app-surface rounded-xl border border-app-border shadow-sm overflow-hidden transition-all">
      {/* Table header with row count and controls */}
      <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-app-text">
            Cleaned Transactions ({sorted.length})
          </h2>
          <p className="text-xs text-app-text-muted mt-1">
            Sorted by date ({sortDir === 'desc' ? 'newest first' : 'oldest first'})
            {filtered.filter(r => r.is_duplicate).length > 0 && (
              <span className="ml-2 text-amber-600">
                • {filtered.filter(r => r.is_duplicate).length} duplicate(s) flagged
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="text-xs text-app-text-muted hover:text-app-text transition flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={sortDir === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
            </svg>
            Sort
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-app-text-muted hover:text-red-500 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Internal Filter Bar */}
      <div className="px-6 py-5 bg-app-muted/40 border-b border-app-border flex flex-wrap items-center gap-6 transition-all">
        {/* Search Box */}
        <div className="flex-1 min-w-[240px] relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input 
            type="text"
            placeholder="Search description or amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-app-muted border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-emerald/20 focus:bg-app-surface transition-all shadow-sm text-app-text placeholder:text-app-text-muted"
          />
        </div>

        {/* Date Filter Box */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Dates</span>
          <div className="flex items-center h-11 bg-app-muted border border-app-border rounded-xl px-2 shadow-sm">
            <input 
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent border-none h-full py-0 px-1 text-xs focus:ring-0 text-app-text [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-app-text-muted mx-1">→</span>
            <input 
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent border-none h-full py-0 px-1 text-xs focus:ring-0 text-app-text [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>

        {/* Amount Filter Box */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Amount</span>
          <div className="flex items-center h-11 bg-app-muted border border-app-border rounded-xl px-3 gap-2 shadow-sm">
            <input 
              type="number"
              placeholder="Min"
              value={amountRange.min}
              onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value }))}
              className="w-16 bg-transparent border-none p-0 text-xs focus:ring-0 text-app-text placeholder:text-app-text-muted"
            />
            <span className="text-app-text-muted">-</span>
            <input 
              type="number"
              placeholder="Max"
              value={amountRange.max}
              onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value }))}
              className="w-16 bg-transparent border-none p-0 text-xs focus:ring-0 text-app-text placeholder:text-app-text-muted"
            />
          </div>
          {(searchTerm || dateRange.start || dateRange.end || amountRange.min || amountRange.max) && (
            <button 
              onClick={() => { setSearchTerm(""); setDateRange({ start: "", end: "" }); setAmountRange({ min: "", max: "" }); }}
              className="text-xs text-red-500 hover:text-red-700 font-bold ml-2 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-app-text-muted">No valid rows found in this upload.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-app-muted/50 text-xs text-app-text-muted uppercase tracking-wider">
                <th className="py-3 px-6 text-left font-medium">Date</th>
                <th className="py-3 px-6 text-left font-medium">Description</th>
                <th className="py-3 px-6 text-right font-medium">Amount</th>
                <th className="py-3 px-6 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={`border-t border-app-border hover:bg-app-muted/50 transition group ${
                    row.is_duplicate ? 'bg-amber-500/5' : ''
                  }`}
                  title={row.raw_description ? `Original: ${row.raw_description}` : ''}
                >
                  <td className="py-4 px-6 text-sm text-app-text font-medium">
                    {row.transaction_date}
                  </td>
                  <td className="py-4 px-6 text-sm text-app-text-muted">
                    <div>
                      <span className="group-hover:text-app-emerald transition">{row.description || 'N/A'}</span>
                      {/* Show raw description as subtitle if different from cleaned */}
                      {row.raw_description && row.raw_description !== row.description && (
                        <p className="text-xs text-app-text-muted/50 truncate max-w-xs">{row.raw_description}</p>
                      )}
                    </div>
                  </td>
                  <td className={`py-4 px-6 text-sm font-semibold text-right ${
                    row.amount < 0 ? 'text-red-500' : 'text-app-text'
                  }`}>
                    {formatAmount(row.amount)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.is_duplicate ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                        Unique
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
