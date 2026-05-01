/**
 * @file App.jsx
 * @description Root component of the application. Wraps the entire component
 *   tree in ErrorBoundary (for graceful error handling) and AppProvider
 *   (for shared state management via React Context).
 */

import ErrorBoundary from "./components/ErrorBoundary";
import { AppProvider } from "./contexts/AppContext";
import Home from "./pages/Home";

/**
 * App - The top-level component that sets up global providers.
 * @returns {JSX.Element} The composed application tree.
 */
function App() {
  return (
    // ErrorBoundary catches runtime errors in any child component
    <ErrorBoundary>
      {/* AppProvider exposes shared state (error, session, connection) to all descendants */}
      <AppProvider>
        <Home />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
