/**
 * @file Home.jsx
 * @description The landing / home page of the Bank Reconciliation Tool.
 *   Displays connection status, shows error alerts, and
 *   provides a button to start Xero OAuth login.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import { useAppContext } from "../hooks/useAppContext";

/**
 * Home - The main landing page component.
 *
 * @returns {JSX.Element} The home page UI.
 */
export default function Home() {
  const { error, clearError, isConnected, checkXeroSession } = useAppContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Xero session on mount
    checkXeroSession();

    // Redirect to dashboard if already connected
    if (isConnected) {
      navigate("/dashboard");
    }

    // Set loading to false after a short delay for UX
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [checkXeroSession, isConnected, navigate]);

  const handleConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8000')}/auth/login`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {error && <ErrorAlert message={error} onClose={clearError} />}

      <div className="bg-white shadow-xl rounded-2xl p-8 w-[420px] text-center">
        <h1 className="text-2xl font-bold mb-2">Bank Reconciliation Tool</h1>
        <p className="text-gray-500 mb-6">Connect your data and reconcile transactions efficiently</p>

        {loading ? (
          <p className="text-gray-400 animate-pulse">Checking connection...</p>
        ) : isConnected ? (
          <p className="text-green-500 font-medium mb-4">Connected to Xero</p>
        ) : (
          <p className="text-gray-500 font-medium mb-4">Not connected to Xero</p>
        )}

        <button
          onClick={handleConnect}
          className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Connect to Xero
        </button>
      </div>
    </div>
  );
}
