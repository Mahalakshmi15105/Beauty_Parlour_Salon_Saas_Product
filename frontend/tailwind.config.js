/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          light: "var(--color-primary-light)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        sidebar: "var(--color-sidebar)",
        navbar: "var(--color-navbar)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        'input-bg': "var(--color-input-bg)",
        'input-border': "var(--color-input-border)",
        'hover-bg': "var(--color-hover-bg)",
        accent: "var(--color-accent)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
        },
        border: {
          soft: "var(--color-border-soft)",
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      }
    },
  },
  plugins: [],
}
