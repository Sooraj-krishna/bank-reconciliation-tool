/**
 * @file ErrorBoundary.jsx
 * @description A React class component that catches JavaScript errors
 *   anywhere in its child component tree, logs them, and displays a
 *   fallback UI instead of crashing the entire application.
 *
 * This is the React-recommended pattern for graceful error handling
 * (functional components cannot yet use the Error Boundary lifecycle).
 */

import { Component } from "react";

/**
 * ErrorBoundary - Catches runtime errors in child components and
 * renders a friendly "Something went wrong" message with a retry button.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    // Track whether an error occurred and store the error object for display
    this.state = { hasError: false, error: null };
  }

  /**
   * React lifecycle method called when a descendant component throws.
   * Returning an object updates the state, triggering a re-render
   * with the fallback UI.
   *
   * @param {Error} error - The error that was thrown.
   * @returns {{hasError: boolean, error: Error}} Updated state.
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    // If an error was caught, render the fallback UI
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-app-bg transition-colors duration-300">
          <div className="bg-app-surface shadow-2xl rounded-3xl p-8 w-[420px] text-center border border-app-border">
            <h1 className="text-2xl font-serif font-black mb-2 text-red-500 tracking-tight uppercase">Something went wrong</h1>
            <p className="text-app-text-muted font-bold mb-6 italic">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-app-emerald text-white py-3 px-8 rounded-xl font-black shadow-lg shadow-app-emerald/20 hover:opacity-90 transition uppercase text-xs tracking-widest"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // No error → render children normally
    return this.props.children;
  }
}
