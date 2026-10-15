// In-memory and SessionStorage cache for Billing screen master data
// Enables 0.0ms instant load for categories, services, products, employees, and settings.

const BILLING_CACHE_KEY = "salon_billing_master_cache_v1";
const BILLING_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes fresh TTL

let inMemoryBillingCache = null;
let inMemoryTimestamp = 0;

export const getCachedBillingData = () => {
  // 1. Check in-memory state first (0.0ms)
  if (inMemoryBillingCache && Date.now() - inMemoryTimestamp < BILLING_CACHE_TTL_MS) {
    return inMemoryBillingCache;
  }

  // 2. Check localStorage (persists across tab reloads, restarts, and sessions)
  try {
    const raw = localStorage.getItem(BILLING_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && Date.now() - parsed.timestamp < BILLING_CACHE_TTL_MS) {
        inMemoryBillingCache = parsed.data;
        inMemoryTimestamp = parsed.timestamp;
        return inMemoryBillingCache;
      }
    }
  } catch (err) {
    console.debug("Billing localStorage cache read skipped:", err);
  }

  // 3. Check sessionStorage
  try {
    const raw = sessionStorage.getItem(BILLING_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && Date.now() - parsed.timestamp < BILLING_CACHE_TTL_MS) {
        inMemoryBillingCache = parsed.data;
        inMemoryTimestamp = parsed.timestamp;
        return inMemoryBillingCache;
      }
    }
  } catch (err) {
    console.debug("Billing session cache read skipped:", err);
  }

  return inMemoryBillingCache || null;
};

export const setCachedBillingData = (data) => {
  if (!data || typeof data !== "object") return;

  inMemoryBillingCache = { ...inMemoryBillingCache, ...data };
  inMemoryTimestamp = Date.now();

  const payload = JSON.stringify({
    timestamp: inMemoryTimestamp,
    data: inMemoryBillingCache,
  });

  try {
    localStorage.setItem(BILLING_CACHE_KEY, payload);
  } catch (err) {
    console.debug("Billing localStorage cache write skipped:", err);
  }

  try {
    sessionStorage.setItem(BILLING_CACHE_KEY, payload);
  } catch (err) {
    console.debug("Billing session cache write skipped:", err);
  }
};

export const invalidateBillingCache = () => {
  inMemoryBillingCache = null;
  inMemoryTimestamp = 0;
  try {
    localStorage.removeItem(BILLING_CACHE_KEY);
    sessionStorage.removeItem(BILLING_CACHE_KEY);
  } catch (err) {}
};
