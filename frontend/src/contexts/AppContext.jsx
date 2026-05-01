/**
 * @file AppContext.jsx
 * @description Creates a React Context that holds global application state:
 *   error messages, backend connection status, and session ID. Provides
 *   a custom hook (useAppContext) and a provider component (AppProvider)
 *   so any descendant can read and update this shared state.
 */

import { createContext, useContext, useState, useCallback } from "react";

// Create the context object; components will subscribe to this.
const AppContext = createContext();

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
 *   setSessionId: function
 * }} The full context value.
 */
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

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
  const [sessionId, setSessionId] = useState(null);

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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
