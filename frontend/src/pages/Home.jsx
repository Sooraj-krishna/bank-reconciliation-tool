/**
 * @file Home.jsx
 * @description The landing / home page of the Bank Reconciliation Tool.
 *   On mount it checks backend connectivity via a health-check endpoint,
 *   displays the connection status, shows any global error alerts, and
 *   provides a button that redirects the user to the Xero OAuth login flow.
 */

import { useEffect, useState } from "react";
import api from "../api/client";
import ErrorAlert from "../components/ErrorAlert";
import { useAppContext } from "../contexts/AppContext";

/**
 * Home - The main landing page component.
 *
 * Responsibilities:
 *   1. Ping the /health endpoint on mount to verify backend connectivity.
 *   2. Display a loading indicator while the check is in progress.
 *   3. Show an ErrorAlert if a global error is set in AppContext.
 *   4. Provide a "Connect to Xero" button that navigates to the OAuth login URL.
 *
 * @returns {JSX.Element} The home page UI.
 */
export default function Home() {
  // Pull shared state and mutators from the global AppContext
  const { error, showError, clearError, isConnected, setIsConnected } = useAppContext();
  // Local loading state while the health check is in flight
  const [loading, setLoading] = useState(true);

  /**
   * Health-check effect: runs once on mount.
   * Sends a GET request to /health to verify the backend is reachable.
   * On success → sets isConnected to true.
   * On failure → shows a user-facing error via the global context.
   */
  useEffect(() => {
    api.get("/health")
      .then((res) => {
        console.log("Backend response:", res.data);
        setIsConnected(true); // mark backend as reachable
        setLoading(false);    // hide the loading spinner
      })
      .catch((err) => {
        console.error("Error:", err);
        showError("Unable to connect to backend. Please try again.");
        setLoading(false);
      });
  }, [setIsConnected, showError]); // safe dependencies (stable references)

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
        ) : (
          <p className="text-green-500 font-medium mb-4">
            Backend Connected
          </p>
        )}

        {/*
         * "Connect to Xero" button.
         * Redirects the browser to the backend's OAuth login endpoint.
         * The base URL mirrors the logic in api/client.js.
         */}
        <button
          onClick={() => {
            window.location.href = `${import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')}/auth/login`;
          }}
          className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Connect to Xero
        </button>
      </div>
    </div>
  );
}
