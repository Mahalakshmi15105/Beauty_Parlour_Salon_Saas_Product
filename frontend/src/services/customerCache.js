// In-memory and SessionStorage persistent client cache for customers
// Enables 0ms customer lookups, instant dropdown rendering, and offline resilience.

const CACHE_KEY = "salon_customers_cache_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh TTL

let memoryCache = null;
let memoryTimestamp = 0;

export const getCachedCustomers = () => {
  // 1. Check in-memory state first (0.0ms)
  if (memoryCache && Date.now() - memoryTimestamp < CACHE_TTL_MS) {
    return memoryCache;
  }

  // 2. Check sessionStorage (persists across page reloads & tab navigation)
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data) && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache = parsed.data;
        memoryTimestamp = parsed.timestamp;
        return memoryCache;
      }
    }
  } catch (err) {
    console.debug("Customer session cache read skipped:", err);
  }

  return null;
};

export const setCachedCustomers = (customersList) => {
  if (!Array.isArray(customersList)) return;

  memoryCache = customersList;
  memoryTimestamp = Date.now();

  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: memoryTimestamp,
        data: customersList,
      })
    );
  } catch (err) {
    // If sessionStorage quota exceeded on low-spec device, memoryCache still works
    console.debug("Session storage write skipped:", err);
  }
};

export const updateOrAddCachedCustomer = (newOrUpdatedCustomer) => {
  if (!newOrUpdatedCustomer || !newOrUpdatedCustomer.id) return;

  const current = getCachedCustomers() || [];
  const existingIdx = current.findIndex((c) => c.id === newOrUpdatedCustomer.id);

  let updated;
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...newOrUpdatedCustomer };
  } else {
    updated = [newOrUpdatedCustomer, ...current];
  }

  setCachedCustomers(updated);
  return updated;
};

export const invalidateCustomerCache = () => {
  memoryCache = null;
  memoryTimestamp = 0;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (err) {}
};
