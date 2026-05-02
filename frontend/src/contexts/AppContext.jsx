/**
 * @file AppContext.jsx
 * @description AppProvider component that wraps the app and provides global state.
 *   The context itself is defined in AppContext.js (separate file for react-refresh).
 *   The useAppContext hook is in hooks/useAppContext.js
 */

import { useState, useCallback, useEffect } from "react";
import { AppContext } from "./AppContext.js";
import api from "../api/client";
import { getCookie } from "../utils/cookie";

/**
 * AppProvider - Wraps the app and provides global state via AppContext.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will
 *   have access to the context.
 * @returns {JSX.Element} The context provider wrapping children.
 */
export function AppProvider({ children }) {
  // Current active error message (null = no error)
  const [error, setError] = useState(null);
  // Whether the frontend has successfully pinged the backend
  const [isConnected, setIsConnected] = useState(false);
  // The current Xero session ID returned after OAuth login
  const [sessionId, setSessionId] = useState(() => {
    // Initialize from cookie on first render (lazy initialization)
    return getCookie("xero_session_id") || null;
  });

  /**
   * showError - Sets a global error message that triggers the ErrorAlert modal.
   * Wrapped in useCallback so its reference stays stable across renders.
   *
   * @param {string} message - The error message to display.
   */
  const showError = useCallback((message) => {
    setError(message);
  }, []);

  /**
   * clearError - Dismisses the current error by resetting the state to null.
   *
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * checkBackendConnection - Pings the backend /health endpoint
   * and updates isConnected state.
   */
  const checkBackendConnection = useCallback(() => {
    api.get("/health")
      .then((res) => {
        console.log("Backend response:", res.data);
        setIsConnected(true);
      })
      .catch((err) => {
        console.error("Backend connection error:", err);
        setIsConnected(false);
      });
  }, []);

  // Check backend connection on mount
  useEffect(() => {
    checkBackendConnection();
  }, [checkBackendConnection]);

  // Provide state and setters/mutators to all descendant components
  return (
    <AppContext.Provider
      value={{
        error,
        showError,
        clearError,
        isConnected,
        setIsConnected,
        sessionId,
        setSessionId,
        checkBackendConnection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
