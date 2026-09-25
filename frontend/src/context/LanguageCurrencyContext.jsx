import React, { createContext, useContext, useState, useEffect } from "react";
import API from "../services/api";
import { TRANSLATIONS, SUPPORTED_CURRENCIES } from "../utils/translations";

const LanguageCurrencyContext = createContext();

export function LanguageCurrencyProvider({ children }) {
  const [currencyCode, setCurrencyCode] = useState(() => localStorage.getItem("app_currency_code") || "INR");
  const [currencySymbol, setCurrencySymbol] = useState(() => localStorage.getItem("app_currency_symbol") || "₹");
  const [language, setLanguage] = useState(() => localStorage.getItem("app_language") || "English");
  const [parlourName, setParlourName] = useState(() => localStorage.getItem("app_parlour_name") || "");

  // Fetch settings from API on initial load / login
  const fetchTenantSettings = () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    API.get("/settings")
      .then((res) => {
        const reg = res.data?.regional_settings || {};
        const biz = res.data?.business_profile || {};
        const code = reg.currency_code || reg.currency || "INR";
        const sym = reg.currency_symbol || "₹";
        const lang = reg.language || "English";
        const name = biz.name || res.data?.parlour_name || localStorage.getItem("app_parlour_name") || "";

        setCurrencyCode(code);
        setCurrencySymbol(sym);
        setLanguage(lang);
        if (name) {
          setParlourName(name);
          localStorage.setItem("app_parlour_name", name);
        }

        localStorage.setItem("app_currency_code", code);
        localStorage.setItem("app_currency_symbol", sym);
        localStorage.setItem("app_language", lang);
      })
      .catch((err) => {
        console.warn("Could not load tenant regional settings:", err);
      });
  };

  useEffect(() => {
    fetchTenantSettings();
  }, []);

  // Symbol-only formatCurrency (No exchange rate conversion)
  const formatCurrency = (amount) => {
    const numericVal = parseFloat(amount || 0);
    const formattedNum = numericVal.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${currencySymbol}${formattedNum}`;
  };

  // UI Translation lookup function
  const t = (key) => {
    const langDict = TRANSLATIONS[language] || TRANSLATIONS["English"];
    return langDict[key] || TRANSLATIONS["English"][key] || key;
  };

  // Update Currency via API and local state
  const updateCurrency = async (code, symbol) => {
    setCurrencyCode(code);
    setCurrencySymbol(symbol);
    localStorage.setItem("app_currency_code", code);
    localStorage.setItem("app_currency_symbol", symbol);

    try {
      await API.put("/settings/currency", {
        currency_code: code,
        currency_symbol: symbol,
      });
    } catch (err) {
      console.error("Failed to persist currency setting:", err);
    }
  };

  // Update Language via API and local state
  const updateLanguage = async (lang) => {
    setLanguage(lang);
    localStorage.setItem("app_language", lang);

    try {
      await API.put("/settings/language", {
        language: lang,
      });
    } catch (err) {
      console.error("Failed to persist language setting:", err);
    }
  };

  return (
    <LanguageCurrencyContext.Provider
      value={{
        currencyCode,
        currencySymbol,
        language,
        parlourName,
        formatCurrency,
        t,
        updateCurrency,
        updateLanguage,
        fetchTenantSettings,
        SUPPORTED_CURRENCIES,
      }}
    >
      {children}
    </LanguageCurrencyContext.Provider>
  );
}

export function useLanguageCurrency() {
  const context = useContext(LanguageCurrencyContext);
  if (!context) {
    throw new Error("useLanguageCurrency must be used within a LanguageCurrencyProvider");
  }
  return context;
}
