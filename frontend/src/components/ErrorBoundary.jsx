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
        // Centered fallback card on a light gray background
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white shadow-xl rounded-2xl p-8 w-[420px] text-center">
            <h1 className="text-2xl font-bold mb-2 text-red-600">Something went wrong</h1>
            {/* Display the error message, with a generic fallback if unavailable */}
            <p className="text-gray-500 mb-4">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            {/* Reset the error state so the children re-render (retry) */}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
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
