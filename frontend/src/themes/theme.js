// Theme definitions for SmartGoNext Parlour Management System
// Light theme preserves the original White + Pink design

export const THEMES = {
  light: {
    name: 'Light',
    icon: 'light',
    colors: {
      // Original White + Pink theme (exact original design)
      background: '#FDFBFD',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      navbar: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E2E8F0',
      inputBg: '#FFFFFF',
      inputBorder: '#E2E8F0',
      hoverBg: '#F1F5F9',
      accent: '#8B5CF6',
      primary: '#EC4899',
      primaryHover: '#DB2777',
      primaryLight: '#FDF2F8',
      primaryBorderSoft: 'rgba(236, 72, 153, 0.18)',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      borderSoft: 'rgba(0, 0, 0, 0.1)',
      goldAccent: '#D4AF37',
      goldLight: '#FEF3C7',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#EC4899',
      secondary: '#10B981',
      tertiary: '#F59E0B',
      quaternary: '#EF4444',
      quinary: '#64748B',
      background: '#FFFFFF',
      grid: '#E2E8F0',
      text: '#0F172A',
    }
  },
  dark: {
    name: 'Dark',
    icon: 'dark',
    colors: {
      // Dark luxury theme
      background: '#111827',
      surface: '#1F2937',
      sidebar: '#172033',
      navbar: '#111827',
      card: '#1F2937',
      border: '#374151',
      inputBg: '#1F2937',
      inputBorder: '#4B5563',
      hoverBg: '#374151',
      accent: '#A855F7',
      primary: '#EC4899',
      primaryHover: '#DB2777',
      primaryLight: 'rgba(236, 72, 153, 0.1)',
      primaryBorderSoft: 'rgba(236, 72, 153, 0.3)',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      borderSoft: 'rgba(236, 72, 153, 0.2)',
      goldAccent: '#D4AF37',
      goldLight: 'rgba(212, 175, 55, 0.1)',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#EC4899',
      secondary: '#A855F7',
      tertiary: '#06B6D4',
      quaternary: '#F59E0B',
      quinary: '#10B981',
      background: '#1F2937',
      grid: '#374151',
      text: '#F8FAFC',
    }
  },
  ocean: {
    name: 'Ocean',
    icon: 'ocean',
    colors: {
      // Professional blue theme
      background: '#F4F8FF',
      surface: '#FFFFFF',
      sidebar: '#1E3A8A',
      navbar: '#FFFFFF',
      card: '#FFFFFF',
      border: '#BFDBFE',
      inputBg: '#FFFFFF',
      inputBorder: '#BFDBFE',
      hoverBg: '#EFF6FF',
      accent: '#06B6D4',
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryLight: '#EFF6FF',
      primaryBorderSoft: 'rgba(37, 99, 235, 0.18)',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      borderSoft: 'rgba(37, 99, 235, 0.1)',
      goldAccent: '#D4AF37',
      goldLight: '#FEF3C7',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#2563EB',
      secondary: '#06B6D4',
      tertiary: '#10B981',
      quaternary: '#F59E0B',
      quinary: '#64748B',
      background: '#FFFFFF',
      grid: '#BFDBFE',
      text: '#0F172A',
    }
  },
  neon: {
    name: 'Neon',
    icon: 'neon',
    colors: {
      // Modern glass UI with soft glow
      background: '#151515',
      surface: '#202020',
      sidebar: '#1A1A1A',
      navbar: '#151515',
      card: '#202020',
      border: '#333333',
      inputBg: '#202020',
      inputBorder: '#404040',
      hoverBg: '#2A2A2A',
      accent: '#22D3EE',
      primary: '#8B5CF6',
      primaryHover: '#7C3AED',
      primaryLight: 'rgba(139, 92, 246, 0.1)',
      primaryBorderSoft: 'rgba(139, 92, 246, 0.3)',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      borderSoft: 'rgba(139, 92, 246, 0.2)',
      goldAccent: '#EC4899',
      goldLight: 'rgba(236, 72, 153, 0.1)',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#8B5CF6',
      secondary: '#22D3EE',
      tertiary: '#EC4899',
      quaternary: '#F59E0B',
      quinary: '#10B981',
      background: '#202020',
      grid: '#333333',
      text: '#F8FAFC',
    }
  }
};

export const DEFAULT_THEME = 'light';

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

export function applyTheme(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  
  // Check if user has a custom accent color
  const customAccentColor = localStorage.getItem('accent_color');
  
  // Apply all color variables with proper CSS variable naming
  const colorMapping = {
    background: 'background',
    surface: 'surface',
    sidebar: 'sidebar',
    navbar: 'navbar',
    card: 'card',
    border: 'border',
    inputBg: 'input-bg',
    inputBorder: 'input-border',
    hoverBg: 'hover-bg',
    accent: 'accent',
    primary: 'primary',
    primaryHover: 'primary-hover',
    primaryLight: 'primary-light',
    primaryBorderSoft: 'primary-border-soft',
    textPrimary: 'text-primary',
    textSecondary: 'text-secondary',
    borderSoft: 'border-soft',
    goldAccent: 'gold-accent',
    goldLight: 'gold-light',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  };
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVarName = colorMapping[key] || key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const cssVar = `--color-${cssVarName}`;
    
    // If this is the primary color and user has a custom accent, use the custom color
    if ((key === 'primary' || key === 'primaryHover') && customAccentColor) {
      root.style.setProperty(cssVar, customAccentColor);
    } else {
      root.style.setProperty(cssVar, value);
    }
  });
  
  // Store in localStorage
  localStorage.setItem('selected_theme', themeId);
  
  return theme;
}

export function applyAccentColor(accentColor) {
  const root = document.documentElement;
  
  // Save to localStorage
  localStorage.setItem('accent_color', accentColor);
  
  // Apply the accent color to primary color variables
  root.style.setProperty('--color-primary', accentColor);
  root.style.setProperty('--color-primary-hover', accentColor);
  
  // Re-apply the current theme to preserve theme mode while using new accent
  const currentTheme = localStorage.getItem('selected_theme') || DEFAULT_THEME;
  const theme = getTheme(currentTheme);
  
  // Apply only non-primary theme colors (backgrounds, text, etc.)
  const colorMapping = {
    background: 'background',
    surface: 'surface',
    sidebar: 'sidebar',
    navbar: 'navbar',
    card: 'card',
    border: 'border',
    inputBg: 'input-bg',
    inputBorder: 'input-border',
    hoverBg: 'hover-bg',
    accent: 'accent',
    primaryLight: 'primary-light',
    primaryBorderSoft: 'primary-border-soft',
    textPrimary: 'text-primary',
    textSecondary: 'text-secondary',
    borderSoft: 'border-soft',
    goldAccent: 'gold-accent',
    goldLight: 'gold-light',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  };
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVarName = colorMapping[key] || key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const cssVar = `--color-${cssVarName}`;
    // Skip primary and primary-hover to preserve custom accent
    if (key !== 'primary' && key !== 'primaryHover') {
      root.style.setProperty(cssVar, value);
    }
  });
}
