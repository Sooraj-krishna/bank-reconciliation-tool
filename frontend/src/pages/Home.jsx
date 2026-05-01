import { useEffect, useState } from "react";
import api from "../api/client";        // Axios instance
import ErrorAlert from "../components/ErrorAlert"; // reusable popup

export default function Home() {

  // State to store error message
  const [error, setError] = useState(null);

  // State to track loading
  const [loading, setLoading] = useState(true);


  // Runs when component loads
  useEffect(() => {

    // Call backend API
    api.get("/health")

      // Success case
      .then((res) => {
        console.log("Backend response:", res.data);

        // Stop loading
        setLoading(false);
      })

      // Error case
      .catch((err) => {
        console.error("Error:", err);

        // Set dynamic error message
        setError("Unable to connect to backend. Please try again.");

        // Stop loading
        setLoading(false);
      });

  }, []); // empty dependency → run once


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">

      {/* Show error popup ONLY if error exists */}
      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)} // clear error
        />
      )}

      {/* Main card */}
      <div className="bg-white shadow-xl rounded-2xl p-8 w-[420px] text-center">

        {/* Title */}
        <h1 className="text-2xl font-bold mb-2">
          💳 Bank Reconciliation Tool
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 mb-6">
          Connect your data and reconcile transactions efficiently
        </p>

        {/* Loading OR success message */}
        { loading ? (
          <p className="text-gray-400 animate-pulse">
            Checking backend...
          </p>
        ) : (
          <p className="text-green-500 font-medium mb-4">
            ✅ Backend Connected
          </p>
        )}

        {/* Button (future OAuth action) */}
        <button
          className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200"
        >
          Connect to Xero
        </button>

      </div>
    </div>
  );
}