import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Waves, Sparkles } from 'lucide-react';

function ThemeSelector() {
  const { currentTheme, themes, changeTheme } = useTheme();

  const themeConfig = {
    light: {
      icon: <Sun size={16} />,
      label: 'Light',
      inactiveColor: 'text-gray-700',
    },
    dark: {
      icon: <Moon size={16} />,
      label: 'Dark',
      inactiveColor: 'text-gray-700',
    },
    ocean: {
      icon: <Waves size={16} />,
      label: 'Ocean',
      inactiveColor: 'text-teal-500',
    },
    neon: {
      icon: <Sparkles size={16} />,
      label: 'Neon',
      inactiveColor: 'text-lime-500',
    },
  };

  return (
    <div 
      className="flex items-center gap-1.5 rounded-full shadow-sm"
      style={{
        backgroundColor: '#f3f4f6',
        padding: '4px',
      }}
    >
      {Object.entries(themes).map(([themeId, theme]) => {
        const config = themeConfig[themeId];
        const isActive = currentTheme === themeId;
        
        return (
          <button
            key={themeId}
            onClick={() => changeTheme(themeId)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
            style={{
              backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              color: isActive ? '#8B5CF6' : config.inactiveColor,
              boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            title={theme.name}
          >
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSelector;
