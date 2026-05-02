/**
 * @file Home.jsx
 * @description The landing / home page of the Bank Reconciliation Tool.
 *   On mount it checks backend connectivity via a health-check endpoint,
 *   displays the connection status, shows any global error alerts, and
 *   provides a button that redirects the user to the Xero OAuth login flow.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import { useAppContext } from "../contexts/AppContext";

/**
 * Home - The main landing page component.
 *
 * Responsibilities:
 *   1. Check backend connectivity via shared AppContext.
 *   2. Display the connection status.
 *   3. Show an ErrorAlert if a global error is set in AppContext.
 *   4. Provide a "Connect to Xero" button that navigates to the OAuth login URL.
 *   5. Redirect to Dashboard if already connected.
 *
 * @returns {JSX.Element} The home page UI.
 */
export default function Home() {
  // Pull shared state and mutators from the global AppContext
  const { error, showError, clearError, isConnected, sessionId, checkBackendConnection } = useAppContext();
  const navigate = useNavigate();
  // Local loading state while the health check is in flight
  const [loading, setLoading] = useState(true);

  /**
   * Health-check effect: runs once on mount.
   * Uses shared checkBackendConnection from context.
   * Redirects to dashboard if session exists.
   */
  useEffect(() => {
    checkBackendConnection();
    setLoading(false);
    
    // If already connected with session, redirect to dashboard
    if (sessionId) {
      navigate("/dashboard");
    }
  }, [checkBackendConnection, sessionId, navigate]);

  const handleConnect = () => {
    // Redirect to backend OAuth login
    window.location.href = `${import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')}/auth/login`;
  };

  return (
    // Full-page centered card layout
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {/* Conditionally render the global error alert when an error exists */}
      {error && (
        <ErrorAlert
          message={error}
          onClose={clearError} // dismisses the error in AppContext
        />
      )}

      {/* Main content card */}
      <div className="bg-white shadow-xl rounded-2xl p-8 w-[420px] text-center">
        <h1 className="text-2xl font-bold mb-2">
          Bank Reconciliation Tool
        </h1>

        <p className="text-gray-500 mb-6">
          Connect your data and reconcile transactions efficiently
        </p>

        {/* Show loading pulse while health check is pending; otherwise show status */}
        {loading ? (
          <p className="text-gray-400 animate-pulse">
            Checking backend...
          </p>
        ) : isConnected ? (
          <p className="text-green-500 font-medium mb-4">
            Backend Connected
          </p>
        ) : (
          <p className="text-red-500 font-medium mb-4">
            Backend Disconnected
          </p>
        )}

        {/*
         * "Connect to Xero" button.
         * Redirects the browser to the backend's OAuth login endpoint.
         * The base URL mirrors the logic in api/client.js.
         */}
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
