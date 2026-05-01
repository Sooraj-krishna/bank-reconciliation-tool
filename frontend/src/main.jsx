/**
 * @file main.jsx
 * @description Application entry point. Mounts the React app into the DOM
 *   inside a StrictMode wrapper for development-time checks and best practices.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Create a React root attached to the <div id="root"> element in index.html,
// then render the App component wrapped in StrictMode.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
