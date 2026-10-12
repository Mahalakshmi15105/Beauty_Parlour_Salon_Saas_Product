// In-memory and localStorage/sessionStorage persistent client cache for Employees
// Enables 0.0ms instant load for staff dropdowns and billing speed.

const EMPLOYEE_CACHE_KEY = "salon_employees_cache_v2";
const EMPLOYEE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes fresh TTL

let inMemoryEmployees = null;
let inMemoryTimestamp = 0;

export const getCachedEmployees = () => {
  // 1. Check in-memory state first (0.0ms)
  if (inMemoryEmployees && Array.isArray(inMemoryEmployees) && inMemoryEmployees.length > 0 && Date.now() - inMemoryTimestamp < EMPLOYEE_CACHE_TTL_MS) {
    return inMemoryEmployees;
  }

  // 2. Check localStorage (persists across tab reloads, restarts, and sessions)
  try {
    const raw = localStorage.getItem(EMPLOYEE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
        inMemoryEmployees = parsed.data;
        inMemoryTimestamp = parsed.timestamp || Date.now();
        return inMemoryEmployees;
      }
    }
  } catch (err) {
    console.debug("Employee localStorage read skipped:", err);
  }

  // 3. Fallback to sessionStorage
  try {
    const raw = sessionStorage.getItem(EMPLOYEE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
        inMemoryEmployees = parsed.data;
        inMemoryTimestamp = parsed.timestamp || Date.now();
        return inMemoryEmployees;
      }
    }
  } catch (err) {
    console.debug("Employee sessionStorage read skipped:", err);
  }

  return null;
};

export const setCachedEmployees = (employeesList) => {
  if (!Array.isArray(employeesList)) return;

  inMemoryEmployees = employeesList;
  inMemoryTimestamp = Date.now();

  const payload = JSON.stringify({
    timestamp: inMemoryTimestamp,
    data: employeesList,
  });

  try {
    localStorage.setItem(EMPLOYEE_CACHE_KEY, payload);
  } catch (err) {
    console.debug("Employee localStorage write skipped:", err);
  }

  try {
    sessionStorage.setItem(EMPLOYEE_CACHE_KEY, payload);
  } catch (err) {}
};

export const invalidateEmployeeCache = () => {
  inMemoryEmployees = null;
  inMemoryTimestamp = 0;
  try {
    localStorage.removeItem(EMPLOYEE_CACHE_KEY);
    sessionStorage.removeItem(EMPLOYEE_CACHE_KEY);
  } catch (err) {}
};
