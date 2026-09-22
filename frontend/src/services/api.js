import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api/v1" : "https://salon-backend.smartgonext.com/api/v1");

const API = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

// Request interceptor to attach JWT token & active branch context
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeBranchId = localStorage.getItem("active_branch_id");
    if (activeBranchId) {
      config.headers["X-Branch-Id"] = activeBranchId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
API.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    // Clear auth tokens only for explicit JWT expiration/invalidation
    if (error.response && error.response.status === 401) {
      const errorCode = error.response.data?.error_code;
      if (
        errorCode === "TOKEN_EXPIRED" ||
        errorCode === "INVALID_TOKEN" ||
        error.response.data?.message?.includes("expired") ||
        error.response.data?.message?.includes("invalid")
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("app_currency_code");
        localStorage.removeItem("app_currency_symbol");
        localStorage.removeItem("app_language");
      }
    }

    if (error.response && error.response.data) {
      // Use structured backend error format if available
      return Promise.reject(error.response.data);
    }

    const fallbackErr = {
      success: false,
      error_code: "NETWORK_ERROR",
      message: error.message || "An error occurred communicating with the server.",
      errors: [],
    };

    return Promise.reject(fallbackErr);
  }
);

export default API;