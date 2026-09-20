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
    name: 'Glowe Sunlight',
    icon: 'sun',
    colors: {
      background: '#FFF7F2',
      surface: 'rgba(255, 255, 255, 0.85)',
      sidebar: 'rgba(255, 240, 235, 0.75)',
      navbar: 'rgba(255, 255, 255, 0.85)',
      card: 'rgba(255, 255, 255, 0.9)',
      border: 'rgba(255, 220, 215, 0.6)',
      inputBg: '#FFFFFF',
      inputBorder: '#FFD8E1',
      hoverBg: '#FFF0F3',
      accent: '#FF758F',
      primary: '#FF758F',
      primaryHover: '#FF4D6D',
      primaryLight: '#FFF0F3',
      primaryBorderSoft: 'rgba(255, 117, 143, 0.2)',
      textPrimary: '#4A2E35',
      textSecondary: '#8C6A75',
      borderSoft: 'rgba(255, 117, 143, 0.15)',
      goldAccent: '#D4AF37',
      goldLight: '#FFF8E7',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
    },
    chartColors: {
      primary: '#FF758F',
      secondary: '#FF9EAA',
      tertiary: '#10B981',
      quaternary: '#F59E0B',
      quinary: '#8C6A75',
      background: '#FFFFFF',
      grid: '#FFEBEF',
      text: '#4A2E35',
    }
  }
};

export const DEFAULT_THEME = 'light';

export function getTheme(themeId) {
  return THEMES['light'];
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
    } else if (key === 'primaryLight') {
      root.style.setProperty(cssVar, `${accentColor}1A`); // 10% opacity
    } else if (key === 'primaryBorderSoft' || key === 'borderSoft') {
      root.style.setProperty(cssVar, `${accentColor}33`); // 20% opacity
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
  root.style.setProperty('--color-accent', accentColor);
  root.style.setProperty('--color-primary-light', `${accentColor}1A`);
  root.style.setProperty('--color-primary-border-soft', `${accentColor}33`);
  root.style.setProperty('--color-border-soft', `${accentColor}33`);
  
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
    // Skip primary, primaryHover, accent, primaryLight, primaryBorderSoft, borderSoft as set dynamically above
    if (!['primary', 'primaryHover', 'accent', 'primaryLight', 'primaryBorderSoft', 'borderSoft'].includes(key)) {
      root.style.setProperty(cssVar, value);
    }
  });
}

export function applyDefaultGloweTheme() {
  const root = document.documentElement;
  const defaultTheme = THEMES['light'];
  const defaultPink = '#FF758F';

  root.style.setProperty('--color-primary', defaultPink);
  root.style.setProperty('--color-primary-hover', '#FF4D6D');
  root.style.setProperty('--color-accent', defaultPink);
  root.style.setProperty('--color-primary-light', '#FFF0F3');
  root.style.setProperty('--color-primary-border-soft', 'rgba(255, 117, 143, 0.2)');
  root.style.setProperty('--color-border-soft', 'rgba(255, 117, 143, 0.15)');

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

  Object.entries(defaultTheme.colors).forEach(([key, value]) => {
    const cssVarName = colorMapping[key] || key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const cssVar = `--color-${cssVarName}`;
    if (!['primary', 'primaryHover', 'accent', 'primaryLight', 'primaryBorderSoft', 'borderSoft'].includes(key)) {
      root.style.setProperty(cssVar, value);
    }
  });
}
