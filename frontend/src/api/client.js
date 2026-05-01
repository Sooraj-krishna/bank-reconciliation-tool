import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.PROD ? "/api" : "http://127.0.0.1:8000"),
});

export default api;