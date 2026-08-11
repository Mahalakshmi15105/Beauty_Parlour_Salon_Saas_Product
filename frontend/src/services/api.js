import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "https://salon-backend.smartgonext.com/api/v1";

const API = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  // Backend may be asleep - allow extra time for it to wake (systemd restart)
  timeout: 30000, // 30 seconds
});

// Request interceptor to attach JWT token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auto-Retry counter to wake a sleeping backend
let wakeRetryCount = 0;
const MAX_WAKE_RETRIES = 2; // Try wake request 2 extra times

/**
 * Sends a lightweight request to the backend root to trigger a wake-up.
 * The backend (systemd) auto-restarts on connection; the first request
 * after sleep will fail once, then succeed on retry.
 */
async function wakeBackend() {
  try {
    // Use fetch with a short timeout to avoid hanging
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    // Fetch the base URL without auth - pure connection probe
    const base = API_BASE.replace(/\/api\/v1\/?$/, "");
    await fetch(`${base}/api/v1/health`, { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch (e) {
    // Even a failed connection means the OS is re-routing - retry will work
    // systemd takes 1-3 seconds to restart the service
    await new Promise((r) => setTimeout(r, 3000));
    return false;
  }
}

// Response interceptor with auto-wake
API.interceptors.response.use(
  (response) => {
    wakeRetryCount = 0; // Reset on success
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the backend is asleep/unreachable, try to wake it and retry
    const isNetworkError =
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "ERR_NETWORK" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNREFUSED" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("timeout");

    if (isNetworkError && wakeRetryCount < MAX_WAKE_RETRIES) {
      wakeRetryCount += 1;
      console.warn(
        `Backend appears to be asleep. Wake attempt ${wakeRetryCount}/${MAX_WAKE_RETRIES}...`
      );

      // Trigger wake
      const woke = await wakeBackend();

      if (woke || wakeRetryCount >= MAX_WAKE_RETRIES) {
        // Give systemd a moment to finish starting before retrying
        await new Promise((r) => setTimeout(r, 2000));

        // Retry the original request
        try {
          const retryResponse = await API(originalRequest);
          return retryResponse;
        } catch (retryError) {
          // Consume the retry error and report the original issue
          return Promise.reject(retryError);
        }
      }
    }

    const responseErr = {
      success: false,
      error_code: "NETWORK_ERROR",
      message: "An error occurred communicating with the server.",
      errors: [],
    };

    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("app_currency_code");
      localStorage.removeItem("app_currency_symbol");
      localStorage.removeItem("app_language");
    }

    if (error.response && error.response.data) {
      // Use structured backend error format if available
      return Promise.reject(error.response.data);
    }

    return Promise.reject(responseErr);
  }
);

export default API;