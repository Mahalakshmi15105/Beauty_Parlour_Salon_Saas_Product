import React, { createContext, useContext, useState, useEffect } from "react";
import { THEMES, DEFAULT_THEME, getTheme, applyTheme, applyAccentColor } from "../themes/theme";
import API from "../services/api";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Initialize from localStorage or default
    return localStorage.getItem('selected_theme') || DEFAULT_THEME;
  });

  const [accentColor, setAccentColor] = useState(() => {
    // Initialize accent color from localStorage or default
    return localStorage.getItem('accent_color') || '#EC4899';
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Apply accent color first on mount (this ensures custom accent is used)
    applyAccentColor(accentColor);

    // Fetch tenant settings on load if logged in to sync with backend
    const token = localStorage.getItem("token");
    if (token) {
      API.get("/settings")
        .then((res) => {
          const thm = res.data.data?.theme_settings || res.data?.theme_settings;
          if (thm) {
            const backendAccent = thm.primary_color || '#EC4899';
            // Sync backend accent color with local state
            if (backendAccent && backendAccent !== accentColor) {
              setAccentColor(backendAccent);
              applyAccentColor(backendAccent);
            }
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
      applyTheme(themeId);
    }
  };

  const changeAccentColor = (color) => {
    setAccentColor(color);
    applyAccentColor(color);
  };

  const saveAccentColorToBackend = async (color) => {
    setLoading(true);
    try {
      await API.put("/settings", {
        theme_settings: {
          theme_name: currentTheme,
          primary_color: color,
          secondary_color: '#F472B6',
          accent_color: 'rgba(236, 72, 153, 0.08)',
        },
      });
    } catch (err) {
      console.error("Failed to save accent color to backend:", err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTheme = () => {
    return getTheme(currentTheme);
  };

  const getChartColors = () => {
    const theme = getCurrentTheme();
    // Override primary color with custom accent if set
    const customAccent = localStorage.getItem('accent_color');
    if (customAccent) {
      return {
        ...theme.chartColors,
        primary: customAccent,
      };
    }
    return theme.chartColors;
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
