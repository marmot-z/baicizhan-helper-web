import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface SettingsState {
  theme: Theme
  setTheme: (t: Theme) => void
  applyTheme: (t?: Theme) => void
}

export const SETTINGS_STORAGE_KEY = 'settings-storage'

const applyThemeToDom = (t: Theme) => {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export const resolveStoredTheme = (): Theme => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    const t = raw ? (JSON.parse(raw)?.state?.theme as Theme | undefined) : undefined
    return t ?? 'light'
  } catch {
    return 'light'
  }
}

export const applyInitialTheme = () => {
  useSettingsStore.getState().applyTheme(resolveStoredTheme())
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (t) => {
        applyThemeToDom(t)
        set({ theme: t })
      },
      applyTheme: (t) => {
        applyThemeToDom(t ?? get().theme)
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        const t = state?.theme ?? 'light'
        applyThemeToDom(t)
      },
    }
  )
)
