import React, { createContext, useContext, useState, useEffect } from "react";
import { THEMES, DEFAULT_THEME, getTheme, applyTheme, applyAccentColor } from "../themes/theme";
import API from "../services/api";

const ThemeContext = createContext();

// Helper to get tenant-specific localStorage keys
const getTenantKey = (key) => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const tenantId = user.tenant_id || user.parlour_id || "default";
  return `${key}_${tenantId}`;
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Initialize from tenant-specific localStorage or default
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tenantId = user.tenant_id || user.parlour_id || "default";
    return localStorage.getItem(`selected_theme_${tenantId}`) || DEFAULT_THEME;
  });

  const [accentColor, setAccentColor] = useState(() => {
    // Initialize accent color from tenant-specific localStorage or default
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tenantId = user.tenant_id || user.parlour_id || "default";
    return localStorage.getItem(`accent_color_${tenantId}`) || '#EC4899';
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Apply both theme and accent color on mount
    applyTheme(currentTheme, accentColor);

    // Fetch tenant settings on load if logged in to sync with backend
    const token = localStorage.getItem("token");
    if (token) {
      API.get("/settings")
        .then((res) => {
          const thm = res.data.data?.theme_settings || res.data?.theme_settings;
          if (thm) {
            // Map backend theme names to frontend theme IDs (Sunlight or Starlight)
            const backendThemeName = thm.theme_name || 'light';
            let frontendThemeId = DEFAULT_THEME;
            
            if (backendThemeName === 'dark' || backendThemeName === 'Dark' || backendThemeName === 'Starlight') {
              frontendThemeId = 'dark';
            } else {
              frontendThemeId = 'light';
            }

            const backendAccent = thm.primary_color || '#EC4899';
            
            // Sync both theme and accent color from backend
            if (frontendThemeId && frontendThemeId !== currentTheme) {
              setCurrentTheme(frontendThemeId);
            }
            if (backendAccent && backendAccent !== accentColor) {
              setAccentColor(backendAccent);
            }
            
            // Apply both
            applyTheme(frontendThemeId, backendAccent);
          }
        })
        .catch(() => {
          // Ignore network errors on init
        });
    }
  }, []);

  const changeTheme = (themeId) => {
    if (THEMES[themeId]) {
      setCurrentTheme(themeId);
      applyTheme(themeId, accentColor);
      // Save to backend
      saveThemeToBackend(themeId, accentColor);
    }
  };

  const changeAccentColor = (color) => {
    setAccentColor(color);
    applyAccentColor(color);
    // Save to backend
    saveThemeToBackend(currentTheme, color);
  };

  const saveThemeToBackend = async (themeId, color) => {
    setLoading(true);
    try {
      await API.put("/settings", {
        theme_settings: {
          theme_name: themeId,
          primary_color: color,
          secondary_color: '#F472B6',
          accent_color: 'rgba(236, 72, 153, 0.08)',
        },
      });
    } catch (err) {
      console.error("Failed to save theme settings to backend:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveAccentColorToBackend = async (color) => {
    // This is now handled by changeAccentColor, but kept for compatibility
    await saveThemeToBackend(currentTheme, color);
  };

  const getCurrentTheme = () => {
    return getTheme(currentTheme);
  };

  const getChartColors = () => {
    const theme = getCurrentTheme();
    // Use the current accent color from state (already tenant-specific)
    return {
      ...theme.chartColors,
      primary: accentColor,
    };
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        accentColor,
        themes: THEMES,
        changeTheme,
        changeAccentColor,
        saveAccentColorToBackend,
        getCurrentTheme,
        getChartColors,
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
      currentTheme: DEFAULT_THEME,
      accentColor: '#EC4899',
      themes: THEMES,
      changeTheme: () => {},
      changeAccentColor: () => {},
      saveAccentColorToBackend: () => {},
      getCurrentTheme: () => getTheme(DEFAULT_THEME),
      getChartColors: () => getTheme(DEFAULT_THEME).chartColors,
      loading: false,
    };
  }
  return context;
}
