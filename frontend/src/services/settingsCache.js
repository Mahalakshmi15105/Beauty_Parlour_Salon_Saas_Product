// Unified high-performance client cache for Salon Settings & Business Profile
// Enables 0.0ms instant load across Layout, Billing, ThermalReceipt, and Settings.
import API from "./api";

const SETTINGS_CACHE_KEY = "salon_settings_cache_v2";
const SETTINGS_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes fresh TTL

let inMemorySettings = null;
let inMemoryTimestamp = 0;
let inFlightSettingsPromise = null;

export const DEFAULT_RECEIPT_SETTINGS = {
  receipt_template: "Classic",
  paper_size: "80mm",
  show_logo: true,
  show_gst: true,
  show_address: true,
  show_phone: true,
  show_email: true,
  show_website: true,
  show_qr_code: false,
  show_qty: true,
  show_rate: true,
  show_mrp: true,
  show_tax: true,
  auto_print: false,
  thank_you_message: "Thank you for visiting. Please visit again.",
  receipt_header: "",
  receipt_footer: "",
};

export const DEFAULT_BUSINESS_PROFILE = {
  name: "Beauty Parlour",
  logo_url: "",
  owner_name: "",
  phone: "",
  alternate_phone: "",
  email: "",
  gst_number: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
  website: "",
  description: "",
  shop_name_typography: {
    enabled: false,
    font_family: "Outfit",
    font_size: 32,
    font_weight: "700",
    letter_spacing: 0,
  },
};

/**
 * Get cached settings synchronously (0.0ms instant access)
 */
export const getCachedSettings = () => {
  // 1. In-memory check (0.00ms)
  if (inMemorySettings && Date.now() - inMemoryTimestamp < SETTINGS_CACHE_TTL_MS) {
    return inMemorySettings;
  }

  // 2. localStorage check (persists across page reloads and tab restarts)
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data) {
        inMemorySettings = parsed.data;
        inMemoryTimestamp = parsed.timestamp || Date.now();
        return inMemorySettings;
      }
    }
  } catch (err) {
    console.debug("Settings localStorage read skipped:", err);
  }

  // 3. sessionStorage fallback
  try {
    const raw = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data) {
        inMemorySettings = parsed.data;
        inMemoryTimestamp = parsed.timestamp || Date.now();
        return inMemorySettings;
      }
    }
  } catch (err) {
    console.debug("Settings sessionStorage read skipped:", err);
  }

  return inMemorySettings || null;
};

/**
 * Save settings to memory + localStorage + sessionStorage
 */
export const setCachedSettings = (settingsData) => {
  if (!settingsData || typeof settingsData !== "object") return;

  const prev = inMemorySettings || {};
  inMemorySettings = {
    ...prev,
    ...settingsData,
    business_profile: {
      ...(prev.business_profile || {}),
      ...(settingsData.business_profile || {}),
    },
    receipt_settings: {
      ...(prev.receipt_settings || {}),
      ...(settingsData.receipt_settings || {}),
    },
    invoice_settings: {
      ...(prev.invoice_settings || {}),
      ...(settingsData.invoice_settings || {}),
    },
    regional_settings: {
      ...(prev.regional_settings || {}),
      ...(settingsData.regional_settings || {}),
    },
    theme_settings: {
      ...(prev.theme_settings || {}),
      ...(settingsData.theme_settings || {}),
    },
    billing_settings: {
      ...(prev.billing_settings || {}),
      ...(settingsData.billing_settings || {}),
    },
  };
  inMemoryTimestamp = Date.now();

  const payload = JSON.stringify({
    timestamp: inMemoryTimestamp,
    data: inMemorySettings,
  });

  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, payload);
    if (inMemorySettings.business_profile) {
      localStorage.setItem("salon_business_profile", JSON.stringify(inMemorySettings.business_profile));
      if (inMemorySettings.business_profile.name) {
        localStorage.setItem("app_parlour_name", inMemorySettings.business_profile.name);
      }
    }
    if (inMemorySettings.invoice_settings) {
      if (inMemorySettings.invoice_settings.tax_rate !== undefined) {
        localStorage.setItem("app_tax_rate", inMemorySettings.invoice_settings.tax_rate);
      }
      if (inMemorySettings.invoice_settings.tax_name) {
        localStorage.setItem("app_tax_name", inMemorySettings.invoice_settings.tax_name);
      }
    }
    if (inMemorySettings.regional_settings) {
      if (inMemorySettings.regional_settings.currency_symbol) {
        localStorage.setItem("app_currency_symbol", inMemorySettings.regional_settings.currency_symbol);
      }
      if (inMemorySettings.regional_settings.currency_code) {
        localStorage.setItem("app_currency_code", inMemorySettings.regional_settings.currency_code);
      }
      if (inMemorySettings.regional_settings.language) {
        localStorage.setItem("app_language", inMemorySettings.regional_settings.language);
      }
    }
  } catch (err) {
    console.debug("Settings localStorage write skipped:", err);
  }

  try {
    sessionStorage.setItem(SETTINGS_CACHE_KEY, payload);
  } catch (err) {}

  // Dispatch events so all active components sync instantly
  try {
    window.dispatchEvent(new CustomEvent("settings_updated", { detail: inMemorySettings }));
    window.dispatchEvent(new CustomEvent("branding_updated", { detail: inMemorySettings.business_profile }));
  } catch (e) {}
};

/**
 * Get Business Profile with 0ms guaranteed fallback to user info
 */
export const getCachedBusinessProfile = () => {
  const cached = getCachedSettings();
  if (cached && cached.business_profile && cached.business_profile.name) {
    return {
      ...DEFAULT_BUSINESS_PROFILE,
      ...cached.business_profile,
    };
  }

  // Fallback 1: localStorage legacy key
  try {
    const raw = localStorage.getItem("salon_business_profile");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.name) {
        return { ...DEFAULT_BUSINESS_PROFILE, ...parsed };
      }
    }
  } catch (e) {}

  // Fallback 2: user session info
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const name = user.branch_name || user.parlour_name || localStorage.getItem("app_parlour_name") || "Beauty Parlour";
    return {
      ...DEFAULT_BUSINESS_PROFILE,
      name,
    };
  } catch (e) {}

  return DEFAULT_BUSINESS_PROFILE;
};

/**
 * Get Receipt Settings with 0ms guaranteed default fallback
 */
export const getCachedReceiptSettings = () => {
  const cached = getCachedSettings();
  if (cached && cached.receipt_settings) {
    return {
      ...DEFAULT_RECEIPT_SETTINGS,
      ...cached.receipt_settings,
    };
  }
  return DEFAULT_RECEIPT_SETTINGS;
};

/**
 * Get Invoice Settings with 0ms guaranteed fallback
 */
export const getCachedInvoiceSettings = () => {
  const cached = getCachedSettings();
  if (cached && cached.invoice_settings) {
    return cached.invoice_settings;
  }
  return {
    invoice_prefix: "INV",
    tax_name: localStorage.getItem("app_tax_name") || "GST",
    tax_rate: parseFloat(localStorage.getItem("app_tax_rate") || "18.0"),
    show_logo: true,
  };
};

/**
 * Invalidate settings cache
 */
export const invalidateSettingsCache = () => {
  inMemorySettings = null;
  inMemoryTimestamp = 0;
  try {
    localStorage.removeItem(SETTINGS_CACHE_KEY);
    sessionStorage.removeItem(SETTINGS_CACHE_KEY);
  } catch (err) {}
};

/**
 * Fast SWR Fetcher with Request Deduplication:
 * If multiple components call this simultaneously on mount, only 1 HTTP request is made!
 */
export const fetchSettingsFast = ({ forceRefresh = false } = {}) => {
  // If in-flight request exists, reuse it
  if (inFlightSettingsPromise) {
    return inFlightSettingsPromise;
  }

  // If cache is fresh and not forcing refresh, return immediately
  const cached = getCachedSettings();
  if (!forceRefresh && cached && Date.now() - inMemoryTimestamp < SETTINGS_CACHE_TTL_MS) {
    return Promise.resolve(cached);
  }

  inFlightSettingsPromise = API.get("/settings")
    .then((res) => {
      const data = res?.data?.data || res?.data || res || {};
      setCachedSettings(data);
      return data;
    })
    .catch((err) => {
      console.warn("Fast settings fetch failed, using cached values:", err);
      return cached || {};
    })
    .finally(() => {
      inFlightSettingsPromise = null;
    });

  return inFlightSettingsPromise;
};
