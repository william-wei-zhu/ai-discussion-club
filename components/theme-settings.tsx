'use client';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return <div className="theme-options" role="group" aria-label="Color theme">{[{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }, { value: 'system', label: 'System', Icon: Monitor }].map(({ value, label, Icon }) => <button type="button" key={value} aria-pressed={mounted && theme === value} onClick={() => setTheme(value)}><Icon size={24}/>{label}</button>)}</div>;
}
