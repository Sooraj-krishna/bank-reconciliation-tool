/**
 * @file ErrorAlert.jsx
 * @description A modal popup component that displays an error message
 *   to the user. It auto-dismisses after 4 seconds and also provides
 *   a manual "Close" button. Rendered as a full-screen overlay.
 */

import { useEffect } from "react";

/**
 * ErrorAlert - Displays an error message in a centered modal overlay.
 *
 * @param {Object} props
 * @param {string} props.message - The error message to display.
 * @param {function} props.onClose - Callback invoked to dismiss the alert.
 * @returns {JSX.Element|null} The modal overlay, or null if not rendered.
 */
export default function ErrorAlert({ message, onClose }) {

  /**
   * Auto-close the alert 4 seconds after mounting.
   * The cleanup function clears the timer if the component unmounts
   * before the timeout fires, preventing memory leaks.
   */
  useEffect(() => {
    // Start a 4-second countdown timer
    const timer = setTimeout(() => {
      onClose(); // invoke parent-provided callback to dismiss the alert
    }, 4000);

    // Cleanup: clear the timer on unmount or when onClose changes
    return () => clearTimeout(timer);

  }, [onClose]); // re-run effect if onClose reference changes


  return (
    // Full-screen dark overlay; z-50 ensures it renders above all other content
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">

      {/* Centered white card with rounded corners and shadow for depth */}
      <div className="bg-white p-6 rounded-xl shadow-xl w-[320px] text-center">

        {/* Alert title with warning icon */}
        <h3 className="text-lg font-semibold mb-2 text-red-500">
          ⚠️ Error
        </h3>

        {/* The dynamic error message passed via props */}
        <p className="text-gray-700">
          {message}
        </p>

        {/* Manual dismiss button */}
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
        >
          Close
        </button>

      </div>
    </div>
  );
}


/*
KEY IDEAS:

1. Props:
   - message → dynamic error text supplied by the parent
   - onClose → function from parent to dismiss the alert

2. useEffect:
   - runs once when the component mounts
   - sets a 4-second auto-dismiss timer with cleanup to prevent leaks

3. Tailwind classes:
   - fixed inset-0 → stretches the overlay to fill the viewport
   - bg-black/40 → semi-transparent black backdrop
   - shadow-xl → elevated card appearance

4. Reusability:
   This component is stateless (aside from the timer) and can be
   dropped into any part of the application that needs to show errors.
*/
