/**
 * @file Dashboard.jsx
 * @description Dashboard page displayed after successful Xero connection.
 *   Fetches and displays invoices from Xero in a table.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";
import { useAppContext } from "../hooks/useAppContext";

/**
 * Dashboard - Displays Xero invoices after successful connection.
 * @returns {JSX.Element} The dashboard UI.
 */
export default function Dashboard() {
  const { error, showError, clearError, isConnected, setIsConnected } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
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
        console.error("Error fetching invoices:", err);
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
      setIsConnected(false);
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
      // Even if the backend call fails, we should clear local state and redirect
      setIsConnected(false);
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-400 animate-pulse">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleDisconnect}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
          >
            Disconnect Xero
          </button>
        </div>

        {error && <ErrorAlert message={error} onClose={clearError} />}

        <div className="bg-white shadow-xl rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">
            Xero Invoices ({invoices.length})
          </h2>

          {invoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No invoices found in your Xero organisation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.InvoiceID} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{invoice.InvoiceNumber || "N/A"}</td>
                      <td className="py-3 px-4">{invoice.Contact?.Name || "N/A"}</td>
                      <td className="py-3 px-4">
                        {invoice.Date ? new Date(invoice.Date).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        {invoice.DueDate ? new Date(invoice.DueDate).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {invoice.Total ?? 0} {invoice.CurrencyCode || ""}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.Status === "AUTHORISED"
                            ? "bg-green-100 text-green-800"
                            : invoice.Status === "PAID"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {invoice.Status || "N/A"}
                        </span>
                      </td>
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
