/**
 * @file App.jsx
 * @description Root component of the application. Sets up React Router,
 *   ErrorBoundary (for graceful error handling), and AppProvider
 *   (for shared state management via React Context).
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppProvider } from "./contexts/AppContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";

/**
 * App - The top-level component that sets up routing and global providers.
 * @returns {JSX.Element} The composed application tree.
 */
function App() {
  return (
    // ErrorBoundary catches runtime errors in any child component
    <ErrorBoundary>
      {/* AppProvider exposes shared state (error, session, connection) to all descendants */}
      <AppProvider>
        {/* Router enables client-side routing between pages */}
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </Router>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
