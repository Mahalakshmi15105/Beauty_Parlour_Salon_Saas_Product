import React, { createContext, useContext, useState, useEffect } from "react";
import API from "../services/api";

export const PRESET_THEMES = [
  { name: "Default Pink", color: "#EC4899" },
  { name: "Royal Blue", color: "#2563EB" },
  { name: "Emerald Green", color: "#059669" },
  { name: "Purple", color: "#7C3AED" },
  { name: "Orange", color: "#EA580C" },
  { name: "Red", color: "#DC2626" },
  { name: "Black & Gold", color: "#D97706" },
  { name: "Teal", color: "#0D9488" },
];

export function hexToRgba(hex, opacity) {
  if (!hex || typeof hex !== "string") return `rgba(236, 72, 153, ${opacity})`;
  let c = hex.replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length !== 6) return `rgba(236, 72, 153, ${opacity})`;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function adjustHexBrightness(hex, percent) {
  if (!hex || typeof hex !== "string") return "#DB2777";
  let c = hex.replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length !== 6) return "#DB2777";
  let num = parseInt(c, 16);
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = ((num >> 8) & 0x00ff) + amt;
  let B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

const ThemeContext = createContext();

export function applyThemeToDom(primaryHex) {
  if (!primaryHex) primaryHex = "#EC4899";
  const hoverHex = adjustHexBrightness(primaryHex, -15);
  const lightRgba = hexToRgba(primaryHex, 0.08);
  const borderRgba = hexToRgba(primaryHex, 0.18);

  const root = document.documentElement;
  root.style.setProperty("--primary-color", primaryHex);
  root.style.setProperty("--primary-hover-color", hoverHex);
  root.style.setProperty("--primary-light-color", lightRgba);
  root.style.setProperty("--primary-border-soft", borderRgba);
}

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState("Default Pink");
  const [primaryColor, setPrimaryColor] = useState("#EC4899");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Apply initial default theme color immediately on mount
    applyThemeToDom(primaryColor);

    // Fetch tenant settings on load if logged in
    const token = localStorage.getItem("token");
    if (token) {
      API.get("/settings")
        .then((res) => {
          const thm = res.data.data?.theme_settings || res.data?.theme_settings;
          if (thm) {
            const name = thm.theme_name || "Default Pink";
            const color = thm.primary_color || "#EC4899";
            setThemeName(name);
            setPrimaryColor(color);
            applyThemeToDom(color);
          }
        })
        .catch(() => {
          // Ignore network errors on init
        });
    }
  }, []);

  const changeTheme = async (name, color, saveToBackend = true) => {
    setThemeName(name);
    setPrimaryColor(color);
    applyThemeToDom(color);

    if (saveToBackend) {
      setLoading(true);
      try {
        await API.put("/settings", {
          theme_settings: {
            theme_name: name,
            primary_color: color,
            secondary_color: adjustHexBrightness(color, 15),
            accent_color: hexToRgba(color, 0.08),
          },
        });
      } catch (err) {
        console.error("Failed to save theme setting:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        themeName,
        primaryColor,
        presetThemes: PRESET_THEMES,
        changeTheme,
        applyThemeToDom,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      themeName: "Default Pink",
      primaryColor: "#EC4899",
      presetThemes: PRESET_THEMES,
      changeTheme: () => {},
      applyThemeToDom: () => {},
      loading: false,
    };
  }
  return context;
}
