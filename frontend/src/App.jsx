import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppProvider } from "./contexts/AppContext.jsx";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Reconcile from "./pages/Reconcile";

function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

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
          
          {/* High-End Theme Toggle FAB */}
          <button 
            onClick={() => setIsDark(!isDark)}
            className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
            aria-label="Toggle Theme"
          >
            <div className="relative w-6 h-6">
              {/* Sun Icon */}
              <svg className={`absolute inset-0 w-6 h-6 text-amber-400 transition-all duration-500 ${isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 7a5 5 0 100 10 5 5 0 000-10zM2 13h2a1 1 0 100-2H2a1 1 0 100 2zm18 0h2a1 1 0 100-2h-2a1 1 0 100 2zM11 2v2a1 1 0 100 2V2a1 1 0 100-2zm0 18v2a1 1 0 100 2v-2a1 1 0 100-2zM5.99 4.58a1 1 0 111.41 1.41L5.99 4.58zm12.02 12.02a1 1 0 111.41 1.41l-1.41-1.41zM5.99 19.42a1 1 0 101.41-1.41l-1.41 1.41zm12.02-12.02a1 1 0 101.41-1.41l-1.41 1.41z" />
              </svg>
              {/* Moon Icon */}
              <svg className={`absolute inset-0 w-6 h-6 text-indigo-400 transition-all duration-500 ${isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.3 22h-.1c-1.1 0-2.2-.1-3.3-.3-1.1-.2-2.2-.6-3.2-1.1-1-.5-1.9-1.1-2.8-1.9-.8-.8-1.4-1.7-1.9-2.8-.5-1-.8-2.1-1-3.2-.2-1.1-.3-2.2-.3-3.3 0-1.1.1-2.2.3-3.3.2-1.1.6-2.2 1.1-3.2.5-1 1.1-1.9 1.9-2.8.8-.8 1.7-1.4 2.8-1.9 1-.5 2.1-.8 3.2-1 1.1-.2 2.2-.3 3.2-1 1.1-.2 2.2-.3 3.3-.3.3 0 .6 0 .9.1-2 .7-3.6 2.1-4.5 3.9-.9 1.8-.9 3.8-.2 5.7.7 1.9 2.1 3.4 3.9 4.4 1.8.9 3.8.9 5.7.2 1.9-.7 3.4-2.1 4.4-3.9.9-1.8.9-3.8.2-5.7-.3-.7-.7-1.3-1.2-1.9 1.2.5 2.3 1.2 3.2 2.1.8.8 1.5 1.7 1.9 2.8.5 1 .8 2.1 1 3.2.2 1.1.3 2.2.3 3.3 0 1.1-.1 2.2-.3 3.3-.2 1.1-.6 2.2-1.1 3.2-.5 1-1.1 1.9-1.9 2.8-.8.8-1.7 1.4-2.8 1.9-1 .5-2.1.8-3.2 1-1.1.2-2.2.3-3.3.3z" />
              </svg>
            </div>
          </button>
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
