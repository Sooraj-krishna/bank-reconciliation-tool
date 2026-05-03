/**
 * @file client.js
 * @description Configures and exports a pre-configured Axios instance for
 *   making HTTP requests to the backend API. The base URL is determined
 *   dynamically from environment variables, with sensible defaults for
 *   both development and production environments.
 */

import axios from "axios";

/**
 * Pre-configured Axios client.
 *
 * baseURL resolution order:
 *   1. VITE_API_BASE_URL env var (explicit override)
 *   2. In production → "/api" (relative path, assumes Vercel rewrite)
 *   3. In development → "http://localhost:8000" (local FastAPI server)
 *
 * withCredentials: true → sends cookies (for session auth)
 */
const getBaseURL = () => {
  // Explicit override via env var
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Production: assume Vercel rewrite handles /api/proxy → backend
  if (import.meta.env.PROD) {
    return "/api/proxy";
  }

  // Development: local backend
  return "http://localhost:8000";
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

export default api;
