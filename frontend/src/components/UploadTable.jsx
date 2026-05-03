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

  // Sort rows by date - default descending (newest first)
  const sorted = [...rows].sort((a, b) => {
    const cmp = a.transaction_date.localeCompare(b.transaction_date);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  // Format amount as currency with 2 decimal places
  const formatAmount = (amt) => {
    const prefix = amt < 0 ? '-£' : '£';
    return `${prefix}${Math.abs(amt).toFixed(2)}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Table header with row count and controls */}
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[#1A1A1A]">
            Cleaned Transactions ({rows.length})
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Sorted by date ({sortDir === 'desc' ? 'newest first' : 'oldest first'})
            {rows.filter(r => r.is_duplicate).length > 0 && (
              <span className="ml-2 text-amber-600">
                • {rows.filter(r => r.is_duplicate).length} duplicate(s) flagged
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="text-xs text-[#64748B] hover:text-[#1A1A1A] transition flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={sortDir === 'desc' ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
            </svg>
            Sort
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-[#64748B] hover:text-red-500 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#64748B]">No valid rows found in this upload.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-xs text-[#64748B] uppercase tracking-wider">
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
                  className={`border-t border-gray-50 hover:bg-[#FDFBF7] transition group ${
                    row.is_duplicate ? 'bg-amber-50/30' : ''
                  }`}
                  title={row.raw_description ? `Original: ${row.raw_description}` : ''}
                >
                  <td className="py-4 px-6 text-sm text-[#1A1A1A] font-medium">
                    {row.transaction_date}
                  </td>
                  <td className="py-4 px-6 text-sm text-[#64748B]">
                    <div>
                      <span className="group-hover:text-[#059669] transition">{row.description || 'N/A'}</span>
                      {/* Show raw description as subtitle if different from cleaned */}
                      {row.raw_description && row.raw_description !== row.description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{row.raw_description}</p>
                      )}
                    </div>
                  </td>
                  <td className={`py-4 px-6 text-sm font-semibold text-right ${
                    row.amount < 0 ? 'text-red-600' : 'text-[#1A1A1A]'
                  }`}>
                    {formatAmount(row.amount)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.is_duplicate ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
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
