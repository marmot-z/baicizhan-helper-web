import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const persist = (token: string, accountStorageId: string, extra = {}) => {
  window.localStorage.setItem('auth-storage', JSON.stringify({ state: { token, accountStorageId, ...extra } }));
};
beforeEach(() => {
  vi.resetModules();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: new MemoryStorage() } });
});

describe('persisted account session fencing', () => {
  it('keeps this tab’s namespace fixed and rejects writes before another tab’s storage event arrives', async () => {
    persist('old-token', 'old-account');
    const { accountSession } = await import('./accountSession');
    const version = accountSession.getVersion();
    expect(accountSession.getStorageKey()).toBe('old-account');
    persist('new-token', 'new-account');

    expect(accountSession.getStorageKey()).toBe('old-account');
    expect(() => accountSession.assertPersistedSession('old-token')).toThrow('账号会话');
    expect(() => accountSession.assertCurrent(version)).toThrow('账号会话');
    expect(accountSession.invalidateIfPersistedSessionChanged()).toBe(true);
    expect(accountSession.isSwitching()).toBe(true);
    expect(accountSession.getVersion()).toBe(version + 1);
  });

  it('ignores profile-only storage changes to avoid reload loops', async () => {
    persist('old-token', 'old-account', { user: null });
    const { accountSession } = await import('./accountSession');
    const version = accountSession.getVersion();
    accountSession.bindStorageSession('old-token', 'old-account');
    persist('old-token', 'old-account', { user: [{ provider: 'weixin', nickname: 'updated' }] });

    expect(accountSession.invalidateIfPersistedSessionChanged()).toBe(false);
    expect(accountSession.getVersion()).toBe(version);
    expect(() => accountSession.assertPersistedSession('old-token')).not.toThrow();
  });

  it('requires explicit binding before using credentials installed by another tab', async () => {
    persist('old-token', 'old-account');
    const { accountSession } = await import('./accountSession');
    accountSession.bindStorageSession('old-token', 'old-account');
    persist('new-token', 'new-account');
    expect(() => accountSession.assertPersistedSession('new-token')).toThrow('账号会话');

    accountSession.bindStorageSession('new-token', 'new-account');
    expect(accountSession.getStorageKey()).toBe('new-account');
    expect(() => accountSession.assertPersistedSession('new-token')).not.toThrow();
  });

  it('fences this tab when another tab logs out or clears browser storage', async () => {
    persist('old-token', 'old-account');
    const { accountSession } = await import('./accountSession');
    accountSession.bindStorageSession('old-token', 'old-account');
    window.localStorage.clear();
    expect(() => accountSession.assertPersistedSession('old-token')).toThrow('账号会话');
    expect(accountSession.invalidateIfPersistedSessionChanged()).toBe(true);
    accountSession.bindStorageSession(null);
    expect(accountSession.getStorageKey()).toBe('__signed_out__');
  });
});
