import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppProvider } from "./contexts/AppContext.jsx";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Reconcile from "./pages/Reconcile";

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="min-h-screen transition-colors duration-300">
          <Router>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/reconcile/:uploadId" element={<Reconcile />} />
            </Routes>
          </Router>
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
