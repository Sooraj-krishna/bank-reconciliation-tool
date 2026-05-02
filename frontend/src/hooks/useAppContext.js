/**
 * @file useAppContext.js
 * @description Custom hook to consume the AppContext.
 *   Separated from AppContext.jsx to satisfy react-refresh rules
 *   (files should only export components for fast refresh).
 */

import { useContext } from "react";
import { AppContext } from "../contexts/AppContext";

/**
 * Custom hook to consume the AppContext.
 * Throws a helpful error if used outside of an AppProvider.
 *
 * @returns {{
 *   error: string|null,
 *   showError: function,
 *   clearError: function,
 *   isConnected: boolean,
 *   setIsConnected: function,
 *   sessionId: string|null,
 *   setSessionId: function,
 *   checkBackendConnection: function
 * }} The full context value.
 */
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
