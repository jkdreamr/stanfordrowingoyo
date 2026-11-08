import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { syncThemeColor } from './splash';
export type Theme = 'system' | 'light' | 'dark';
type ThemeContext = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** The theme actually shown: the saved choice, or the device's when following the system. */
  dark: boolean;
  systemDark: boolean;
};
const Context = createContext<ThemeContext | null>(null);
const systemQuery = () => matchMedia('(prefers-color-scheme: dark)');
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme');
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch {
      return 'system';
    }
  });
  const [systemDark, setSystemDark] = useState(() => systemQuery().matches);
  useEffect(() => {
    const media = systemQuery();
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Storage can be unavailable */
    }
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    syncThemeColor(dark);
  }, [dark]);
  return (
    <Context.Provider value={{ theme, setTheme, dark, systemDark }}>{children}</Context.Provider>
  );
}
export function useTheme() {
  const value = useContext(Context);
  if (!value) throw new Error('useTheme requires ThemeProvider');
  return value;
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Runs a theme change under a short page crossfade: `html.theme-anim` lets backgrounds, text
 * and borders transition for one beat (200 ms, or 120 ms with reduced motion), then lifts.
 */
export function fadeTheme(change: () => void) {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('theme-anim');
  root.classList.toggle('theme-anim-reduced', reduced);
  change();
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(
    () => root.classList.remove('theme-anim', 'theme-anim-reduced'),
    (reduced ? 120 : 200) + 60,
  );
}
