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
 *   2. In production → "/api" (relative path, assumes reverse proxy)
 *   3. In development → "http://127.0.0.1:8000" (local FastAPI server)
 */
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.PROD ? "/api" : "http://127.0.0.1:8000"),
});

export default api;
