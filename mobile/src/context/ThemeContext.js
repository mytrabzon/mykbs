import React, { createContext, useContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const ThemeContext = createContext({ isDark: false, colors: lightColors });

export function ThemeProvider({ children, forceDark }) {
  const systemDark = useColorScheme() === 'dark';
  const [overrideDark, setOverrideDark] = useState(null);
  const isDark = overrideDark !== null ? overrideDark : (forceDark ?? systemDark);
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      isDark,
      colors,
      typography,
      spacing,
      setDarkMode: (v) => setOverrideDark(v === undefined ? null : !!v),
    }),
    [isDark, colors]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx.colors) {
    return {
      isDark: false,
      colors: lightColors,
      typography,
      spacing,
      setDarkMode: () => {},
    };
  }
  return ctx;
}
