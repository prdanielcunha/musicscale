import React, { createContext, useContext, useEffect, ReactNode, useMemo } from 'react';

export type ThemeMode = 'light' | 'dark' | 'tinted';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  tintColor: string;
  setTintColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_THEME = {
  background: '#050507',
  surface: '#0D0D11',
  primary: '#4F8CFF',
  primaryDark: '#376FD6',
  primaryLight: '#7AA8FF',
  accent: '#7868FF',
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const theme: ThemeMode = 'dark';
  const tintColor = DARK_THEME.primary;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');

    const colors = DARK_THEME;

    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-dark', colors.primaryDark);
    root.style.setProperty('--color-primary-light', colors.primaryLight);
    root.style.setProperty('--color-accent', colors.accent);

    root.style.setProperty('--app-bg', colors.background);
    root.style.setProperty('--app-surface', colors.surface);
    root.style.setProperty('--app-primary', colors.primary);
    root.style.setProperty('--app-primary-dark', colors.primaryDark);
    root.style.setProperty('--app-primary-light', colors.primaryLight);
    root.style.setProperty('--app-accent', colors.accent);
  }, []);

  const setTheme = () => {};
  const setTintColor = () => {};

  const value = useMemo(() => ({ theme, setTheme, tintColor, setTintColor }), [theme, tintColor]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};