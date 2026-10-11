import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'
export type PronunciationPreference = 'uk' | 'us'
export type ShortcutAction = 'option1' | 'option2' | 'option3' | 'option4' | 'next' | 'kill'
export type ShortcutCode = string

export type ShortcutMap = Record<ShortcutAction, ShortcutCode>

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  option1: 'Digit1',
  option2: 'Digit2',
  option3: 'Digit3',
  option4: 'Digit4',
  next: 'Space',
  kill: 'KeyK',
}

const SHORTCUT_ACTION_ORDER: ShortcutAction[] = [
  'option1',
  'option2',
  'option3',
  'option4',
  'next',
  'kill',
]

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'
/** 将旧版 key/keyCode 写法和用户输入统一为 KeyboardEvent.code。 */
export const normalizeShortcutCode = (value: string | null | undefined): ShortcutCode | null => {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return value === ' ' ? 'Space' : null

  const aliases: Record<string, string> = {
    ' ': 'Space',
    Spacebar: 'Space',
    '1': 'Digit1',
    '2': 'Digit2',
    '3': 'Digit3',
    '4': 'Digit4',
    k: 'KeyK',
    K: 'KeyK',
  }

  return aliases[value] ?? aliases[trimmed] ?? trimmed
}

export const formatShortcutCode = (code: string | null | undefined): string => {
  if (!code) return '未设置'
  if (code === 'Space') return '空格'
  if (code.startsWith('Digit')) return code.slice('Digit'.length)
  if (code.startsWith('Key')) return code.slice('Key'.length)
  if (code.startsWith('Numpad')) return `小键盘 ${code.slice('Numpad'.length)}`
  if (code.endsWith('Left')) return `${code.slice(0, -4)} 左`
  if (code.endsWith('Right')) return `${code.slice(0, -5)} 右`
  return code
}

export const resolvePreferredAudio = (
  ukAudio: string | null | undefined,
  usAudio: string | null | undefined,
  preference: PronunciationPreference = 'uk',
): string | undefined => {
  const preferred = preference === 'us' ? usAudio : ukAudio
  const fallback = preference === 'us' ? ukAudio : usAudio
  return preferred || fallback || undefined
}

export const getShortcutConflict = (
  shortcuts: ShortcutMap,
  action: ShortcutAction,
  code: ShortcutCode,
): ShortcutAction | null => {
  const normalized = normalizeShortcutCode(code)
  if (!normalized) return null

  return (
    SHORTCUT_ACTION_ORDER.find(
      (candidate) => candidate !== action && normalizeShortcutCode(shortcuts[candidate]) === normalized,
    ) ?? null
  )
}

export const shortcutMatches = (event: KeyboardEvent, code: ShortcutCode): boolean =>
  Boolean(normalizeShortcutCode(code)) && event.code === normalizeShortcutCode(code)

export const isEditableShortcutTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

/** 全局快捷键只处理单次、无修饰键、且不来自输入控件的按键。 */
export const shouldIgnoreShortcutEvent = (event: KeyboardEvent): boolean =>
  event.repeat || event.ctrlKey || event.altKey || event.metaKey || isEditableShortcutTarget(event.target)

export interface SettingsState {
  theme: Theme
  showMedia: boolean
  wordDetailAutoPronounce: boolean
  studyReviewAutoPronounce: boolean
  pronunciationPreference: PronunciationPreference
  shortcuts: ShortcutMap
  setTheme: (t: Theme) => void
  applyTheme: (t?: Theme) => void
  toggleMedia: () => void
  setShowMedia: (showMedia: boolean) => void
  setWordDetailAutoPronounce: (enabled: boolean) => void
  setStudyReviewAutoPronounce: (enabled: boolean) => void
  setPronunciationPreference: (preference: PronunciationPreference) => void
  setShortcut: (action: ShortcutAction, code: ShortcutCode) => void
  resetShortcuts: () => void
}

export const SETTINGS_STORAGE_KEY = 'settings-storage'

const applyThemeToDom = (t: Theme) => {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

const mergePersistedSettings = (persistedState: unknown, currentState: SettingsState): SettingsState => {
  const persisted = (persistedState && typeof persistedState === 'object'
    ? persistedState
    : {}) as Partial<SettingsState>
  const persistedShortcuts: Partial<ShortcutMap> = persisted.shortcuts && typeof persisted.shortcuts === 'object'
    ? persisted.shortcuts
    : {}
  const shortcuts = { ...DEFAULT_SHORTCUTS }

  SHORTCUT_ACTION_ORDER.forEach((action) => {
    const code = normalizeShortcutCode(persistedShortcuts[action])
    if (code) shortcuts[action] = code
  })

  return {
    ...currentState,
    theme: isTheme(persisted.theme) ? persisted.theme : currentState.theme,
    showMedia: typeof persisted.showMedia === 'boolean' ? persisted.showMedia : currentState.showMedia,
    wordDetailAutoPronounce:
      typeof persisted.wordDetailAutoPronounce === 'boolean'
        ? persisted.wordDetailAutoPronounce
        : currentState.wordDetailAutoPronounce,
    studyReviewAutoPronounce:
      typeof persisted.studyReviewAutoPronounce === 'boolean'
        ? persisted.studyReviewAutoPronounce
        : currentState.studyReviewAutoPronounce,
    pronunciationPreference:
      persisted.pronunciationPreference === 'us' || persisted.pronunciationPreference === 'uk'
        ? persisted.pronunciationPreference
        : currentState.pronunciationPreference,
    shortcuts,
  }
}

export const resolveStoredTheme = (): Theme => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    const t = raw ? (JSON.parse(raw)?.state?.theme as Theme | undefined) : undefined
    return isTheme(t) ? t : 'light'
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
      showMedia: true,
      wordDetailAutoPronounce: false,
      studyReviewAutoPronounce: true,
      pronunciationPreference: 'uk',
      shortcuts: { ...DEFAULT_SHORTCUTS },
      setTheme: (t) => {
        applyThemeToDom(t)
        set({ theme: t })
      },
      applyTheme: (t) => {
        applyThemeToDom(t ?? get().theme)
      },
      toggleMedia: () => {
        set((state) => ({ showMedia: !state.showMedia }))
      },
      setShowMedia: (showMedia) => set({ showMedia }),
      setWordDetailAutoPronounce: (wordDetailAutoPronounce) => set({ wordDetailAutoPronounce }),
      setStudyReviewAutoPronounce: (studyReviewAutoPronounce) => set({ studyReviewAutoPronounce }),
      setPronunciationPreference: (pronunciationPreference) => set({ pronunciationPreference }),
      setShortcut: (action, code) => {
        const normalized = normalizeShortcutCode(code)
        if (!normalized || getShortcutConflict(get().shortcuts, action, normalized)) return
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [action]: normalized,
          },
        }))
      },
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      partialize: (state) => ({
        theme: state.theme,
        showMedia: state.showMedia,
        wordDetailAutoPronounce: state.wordDetailAutoPronounce,
        studyReviewAutoPronounce: state.studyReviewAutoPronounce,
        pronunciationPreference: state.pronunciationPreference,
        shortcuts: state.shortcuts,
      }),
      merge: mergePersistedSettings,
      onRehydrateStorage: () => (state) => {
        const t = state?.theme ?? 'light'
        applyThemeToDom(t)
      },
    }
  )
)
