// Theme definitions for SmartGoNext Parlour Management System
// Light theme preserves the original White + Pink design

// Helper to get tenant-specific localStorage keys
const getTenantKey = (key) => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const tenantId = user.tenant_id || user.parlour_id || "default";
  return `${key}_${tenantId}`;
};

export const THEMES = {
  light: {
    name: 'Sunlight',
    icon: 'sun',
    colors: {
      background: '#FAFAFC',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      navbar: '#FFFFFF',
      card: '#FFFFFF',
      border: '#ECECEC',
      inputBg: '#FFFFFF',
      inputBorder: '#ECECEC',
      hoverBg: '#F4F4F6',
      accent: '#FDF2F8',
      primary: '#EC4899',
      primaryHover: '#DB2777',
      primaryLight: '#FDF2F8',
      primaryBorderSoft: 'rgba(236, 72, 153, 0.18)',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      borderSoft: '#ECECEC',
      goldAccent: '#D4AF37',
      goldLight: '#FEF3C7',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#EC4899',
      secondary: '#F472B6',
      tertiary: '#10B981',
      quaternary: '#F59E0B',
      quinary: '#64748B',
      background: '#FFFFFF',
      grid: '#ECECEC',
      text: '#0F172A',
    }
  },
  dark: {
    name: 'Starlight',
    icon: 'moon',
    colors: {
      background: '#0F172A',
      surface: '#1E293B',
      sidebar: '#1E293B',
      navbar: '#1E293B',
      card: '#1E293B',
      border: '#334155',
      inputBg: '#0F172A',
      inputBorder: '#334155',
      hoverBg: '#334155',
      accent: '#1E1B4B',
      primary: '#EC4899',
      primaryHover: '#DB2777',
      primaryLight: 'rgba(236, 72, 153, 0.15)',
      primaryBorderSoft: 'rgba(236, 72, 153, 0.3)',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      borderSoft: '#334155',
      goldAccent: '#F59E0B',
      goldLight: 'rgba(245, 158, 11, 0.15)',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#EC4899',
      secondary: '#F472B6',
      tertiary: '#38BDF8',
      quaternary: '#F59E0B',
      quinary: '#10B981',
      background: '#1E293B',
      grid: '#334155',
      text: '#F8FAFC',
    }
  }
};

export const DEFAULT_THEME = 'light';

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

export function applyTheme(themeId, accentColorOverride = null) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  
  // Get tenant ID for localStorage access
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const tenantId = user.tenant_id || user.parlour_id || "default";
  
  // Get the accent color - prioritize override, then localStorage, then theme default
  let accentColor;
  if (accentColorOverride) {
    accentColor = accentColorOverride;
  } else {
    const storedAccentColor = localStorage.getItem(`accent_color_${tenantId}`);
    accentColor = storedAccentColor || theme.colors.primary;
  }
  
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
    
    // If this is a primary color, use the accent color override
    if (key === 'primary' || key === 'primaryHover') {
      root.style.setProperty(cssVar, accentColor);
    } else {
      root.style.setProperty(cssVar, value);
    }
  });
  
  // Store in tenant-specific localStorage
  localStorage.setItem(`selected_theme_${tenantId}`, themeId);
  
  return theme;
}

export function applyAccentColor(accentColor) {
  const root = document.documentElement;
  
  // Get tenant ID and save to tenant-specific localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const tenantId = user.tenant_id || user.parlour_id || "default";
  localStorage.setItem(`accent_color_${tenantId}`, accentColor);
  
  // Get the current theme from tenant-specific localStorage
  const currentTheme = localStorage.getItem(`selected_theme_${tenantId}`) || DEFAULT_THEME;
  const theme = getTheme(currentTheme);
  
  // Apply the accent color to primary color variables
  root.style.setProperty('--color-primary', accentColor);
  root.style.setProperty('--color-primary-hover', accentColor);
  
  // Apply all other theme colors (backgrounds, text, etc.) - preserve theme mode
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
    // Skip primary and primary-hover as they're already set above
    if (key !== 'primary' && key !== 'primaryHover') {
      root.style.setProperty(cssVar, value);
    }
  });
}
