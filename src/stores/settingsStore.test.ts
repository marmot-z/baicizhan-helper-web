import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('settingsStore media visibility', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        documentElement: {
          classList: { toggle: vi.fn() },
        },
      },
    });
  });

  it('defaults to media on and persists toggles in the existing settings key', async () => {
    const { SETTINGS_STORAGE_KEY, useSettingsStore } = await import('./settingsStore');

    expect(useSettingsStore.getState().showMedia).toBe(true);
    useSettingsStore.getState().toggleMedia();

    expect(useSettingsStore.getState().showMedia).toBe(false);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}').state)
      .toMatchObject({ showMedia: false });
  });

  it('keeps media on for settings saved before the field existed', async () => {
    localStorage.setItem('settings-storage', JSON.stringify({
      state: { theme: 'dark' },
      version: 0,
    }));

    const { useSettingsStore } = await import('./settingsStore');

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().showMedia).toBe(true);
  });

  it('fills defaults for the new pronunciation and shortcut settings', async () => {
    const {
      DEFAULT_SHORTCUTS,
      useSettingsStore,
    } = await import('./settingsStore');

    expect(useSettingsStore.getState()).toMatchObject({
      wordDetailAutoPronounce: false,
      studyReviewAutoPronounce: true,
      pronunciationPreference: 'uk',
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it('persists custom shortcuts and rejects conflicts', async () => {
    const { SETTINGS_STORAGE_KEY, useSettingsStore } = await import('./settingsStore');

    useSettingsStore.getState().setShortcut('option1', 'KeyA');
    expect(useSettingsStore.getState().shortcuts.option1).toBe('KeyA');

    useSettingsStore.getState().setShortcut('option2', 'KeyA');
    expect(useSettingsStore.getState().shortcuts.option2).toBe('Digit2');
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}').state.shortcuts)
      .toMatchObject({ option1: 'KeyA', option2: 'Digit2' });
  });

  it('normalizes key aliases and resolves preferred audio with fallback', async () => {
    const {
      normalizeShortcutCode,
      resolvePreferredAudio,
    } = await import('./settingsStore');

    expect(normalizeShortcutCode(' ')).toBe('Space');
    expect(normalizeShortcutCode('1')).toBe('Digit1');
    expect(resolvePreferredAudio('', '/uk.mp3', 'us')).toBe('/uk.mp3');
    expect(resolvePreferredAudio('/uk.mp3', '/us.mp3', 'us')).toBe('/us.mp3');
  });
});
