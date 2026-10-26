import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeSnapshot {
  preference: ThemePreference
  resolved: ResolvedTheme
}

declare global {
  interface Window {
    __HERMES_THEME__: {
      getSnapshot(): ThemeSnapshot
      setPreference(preference: ThemePreference): void
      subscribe(listener: () => void): () => void
    }
  }
}

export function useTheme() {
  const store = window.__HERMES_THEME__
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return { ...snapshot, setPreference: store.setPreference }
}
