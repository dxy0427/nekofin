import { storage } from '@/lib/storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'theme.preference';
const DEFAULT_THEME: ThemePreference = 'dark';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | undefined>(undefined);

function applyTheme(preference: ThemePreference) {
  const colorScheme: ColorSchemeName = preference === 'system' ? null : preference;
  Appearance.setColorScheme(colorScheme);
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const initialPreference = (storage.getString(STORAGE_KEY) as ThemePreference) || DEFAULT_THEME;
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    applyTheme(initialPreference);
  }, [initialPreference]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    storage.set(STORAGE_KEY, preference);
    applyTheme(preference);
  }, []);

  const contextValue = useMemo<ThemePreferenceContextValue>(
    () => ({
      themePreference,
      setThemePreference,
    }),
    [themePreference, setThemePreference],
  );

  return (
    <ThemePreferenceContext.Provider value={contextValue}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  }
  return ctx;
}
