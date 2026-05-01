import { useEffect } from "react";

export default function ErrorAlert({ message, onClose }) {

  // useEffect runs when component mounts
  // Used here to auto-close popup after 4 seconds
  useEffect(() => {

    // Start timer
    const timer = setTimeout(() => {
      onClose(); // call parent function to close popup
    }, 4000);

    // Cleanup function (important to avoid memory leaks)
    return () => clearTimeout(timer);

  }, [onClose]); // dependency array


  return (
    // Full screen overlay (dark background)
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">

      {/* Popup box */}
      <div className="bg-white p-6 rounded-xl shadow-xl w-[320px] text-center">

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2 text-red-500">
          ⚠️ Error
        </h3>

        {/* Dynamic error message */}
        <p className="text-gray-700">
          {message}
        </p>

        {/* Close button */}
        <button
          onClick={onClose} // closes popup
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
   - message → dynamic text
   - onClose → function from parent

2. useEffect:
   - runs once when component appears
   - auto closes popup

3. Tailwind classes:
   - fixed inset-0 → full screen overlay
   - bg-black/40 → transparent black background
   - shadow-xl → depth effect

4. Reusability:
   This component can be used anywhere in your app
*/