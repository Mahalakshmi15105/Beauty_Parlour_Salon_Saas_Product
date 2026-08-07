import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

function ThemeSelector() {
  const { currentTheme, changeTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const toggleTheme = () => {
    changeTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="relative flex items-center justify-between px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 select-none shadow-xs border hover:shadow-md active:scale-95 cursor-pointer backdrop-blur-md"
      style={{
        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
        borderColor: isDark ? '#334155' : '#ECECEC',
        color: isDark ? '#F8FAFC' : '#0F172A',
      }}
      title={isDark ? "Switch to Sunlight (Light Mode)" : "Switch to Starlight (Dark Mode)"}
    >
      <div className="flex items-center space-x-2 z-10">
        {isDark ? (
          <>
            <Moon className="w-4 h-4 text-amber-300 animate-spin-slow" />
            <span className="tracking-wide">Starlight</span>
          </>
        ) : (
          <>
            <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="tracking-wide">Sunlight</span>
          </>
        )}
      </div>
    </button>
  );
}

export default ThemeSelector;
