import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserBindInfo } from '../types';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function binding(nickname = 'old', provider = 'weixin'): UserBindInfo {
  return { provider, nickname, openid: 'open', unionid: 'union' } as UserBindInfo;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function response(config: InternalAxiosRequestConfig, data: unknown, code = 200): AxiosResponse {
  return { data: { code, data }, status: 200, statusText: 'OK', headers: {}, config };
}

async function setup() {
  const auth = await import('./authStore');
  const { default: client } = await import('../services/api');
  const { accountSession } = await import('../services/accountSession');
  const { studyRecordStore } = await import('../services/study/recordStore');
  const { studySessionStore } = await import('../services/study/sessionStore');
  const { useStudyStore } = await import('./studyStore');
  const { useWordBookStore } = await import('./wordBookStore');
  const { createTopicLearnRecord } = await import('../types/studyRecord');
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    requests.push(config);

    if (config.url === '/userInfo') {
      return response(config, [binding(config.headers.access_token === 'new-token' ? 'new' : 'old')]);
    }

    if (config.url?.startsWith('/login/')) {
      return response(config, 'new-token');
    }

    if (config.url === '/updateDoneData') {
      return response(config, { resultCode: 0, syncVersion: 1 });
    }

    if (config.url?.startsWith('/studySyncMeta?')) {
      return response(config, { bookId: 10, remoteSyncVer: 1, versionKnown: true });
    }
    if (config.url?.startsWith('/learnedWords?')) return response(config, []);

    throw new Error('Unexpected request: ' + config.url);
  });
  client.defaults.adapter = adapter;
  const seedPending = async (bookId = 10) => {
    await studyRecordStore.initialize();
    await studyRecordStore.commitMutation({
      bookId, topicId: 1, eventId: `pending-${bookId}`,
      mutate: () => createTopicLearnRecord({ bookId, topicId: 1, topicScore: -1 }),
      delta: { doneTimes: 0, wrongTimes: 0, usedTime: 0 },
    });
  };
  return { ...auth, client, accountSession, studyRecordStore, studySessionStore, useStudyStore, useWordBookStore, adapter, requests, seedPending };
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage, location: { href: '' } },
  });
});

function signIn(store: Awaited<ReturnType<typeof setup>>['useAuthStore']) {
  store.setState({ user: [binding()], token: 'old-token', loginMethod: 'phone', isAuthenticated: true, accountStorageId: 'old-account' });
}

describe('Weixin account switching', () => {
  it('only offers switching for a bound account outside a Weixin session', async () => {
    const { canLoginWithWeixin } = await setup();
    expect(canLoginWithWeixin({ user: [binding()], loginMethod: 'phone', isAuthenticated: true })).toBe(true);
    expect(canLoginWithWeixin({ user: [binding()], loginMethod: 'weixin', isAuthenticated: true })).toBe(false);
    expect(canLoginWithWeixin({ user: [binding('old', 'phone')], loginMethod: 'phone', isAuthenticated: true })).toBe(false);
    expect(canLoginWithWeixin({ user: null, loginMethod: null, isAuthenticated: false })).toBe(false);
  });

  it('restores legacy sessions as phone login and persists Weixin login across reloads', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'old-token', isAuthenticated: true, user: [binding()] }, version: 0 }));
    const first = await setup();
    expect(first.useAuthStore.getState().loginMethod).toBe('phone');
    await first.useAuthStore.getState().loginWithWeixin();
    vi.resetModules();
    const restored = await setup();
    expect(restored.useAuthStore.getState().loginMethod).toBe('weixin');
    expect(restored.useAuthStore.getState().isSwitchingAccount).toBe(false);
    expect(restored.canLoginWithWeixin(restored.useAuthStore.getState())).toBe(false);
  });

  it('installs the phone token before querying user info and resets login method', async () => {
    const ctx = await setup();
    ctx.useAuthStore.setState({ loginMethod: 'weixin' });
    await ctx.useAuthStore.getState().login({ phoneNum: '13800000000', smsVerifyCode: '123456' });
    expect(ctx.requests.find((request) => request.url === '/userInfo')?.headers.access_token).toBe('new-token');
    expect(ctx.useAuthStore.getState()).toMatchObject({ loginMethod: 'phone', isAuthenticated: true, user: [binding('new')] });
  });

  it('syncs with the original token before login, then clears all account caches', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    ctx.useWordBookStore.setState({ wordBooks: { '10': { words: [], timestamp: Date.now() } } });
    localStorage.setItem('study-session-store', 'old-draft');
    expect(await ctx.useAuthStore.getState().loginWithWeixin()).toBe(false);
    expect(ctx.requests.map((request) => request.url)).toEqual(['/updateDoneData', '/login/weixin', '/userInfo']);
    expect(ctx.requests.map((request) => request.headers.access_token)).toEqual(['old-token', 'old-token', 'new-token']);
    expect(ctx.studyRecordStore.getSnapshot().books).toEqual({});
    expect(ctx.useWordBookStore.getState().wordBooks).toEqual({});
    expect(localStorage.getItem('study-session-store')).toBeNull();
    expect(ctx.useAuthStore.getState()).toMatchObject({ token: 'new-token', loginMethod: 'weixin', user: [binding('new')] });
  });

  it('switches even after sync failure and reports the discarded records', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    ctx.adapter.mockImplementationOnce(async (config) => response(config, null, 500));
    expect(await ctx.useAuthStore.getState().loginWithWeixin()).toBe(true);
    expect(ctx.studyRecordStore.getSnapshot().books).toEqual({});
    expect(ctx.useAuthStore.getState().loginMethod).toBe('weixin');
  });

  it('keeps the original account and unsynced records if login fails', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    ctx.adapter.mockImplementation(async (config) => response(config, null, 500));
    await expect(ctx.useAuthStore.getState().loginWithWeixin()).rejects.toThrow();
    expect(ctx.useAuthStore.getState()).toMatchObject({ token: 'old-token', user: [binding()], loginMethod: 'phone', isSwitchingAccount: false });
    expect(ctx.studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);
    expect(ctx.accountSession.isSwitching()).toBe(false);
  });

  it('rejects an empty login token without clearing the old session', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    ctx.adapter.mockImplementationOnce(async (config) => response(config, ''));
    await expect(ctx.useAuthStore.getState().loginWithWeixin()).rejects.toThrow('登录微信账号失败');
    expect(ctx.useAuthStore.getState().token).toBe('old-token');
  });

  it('blocks double clicks and new learning requests during switching', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    const pending = deferred<void>();
    ctx.adapter.mockImplementationOnce(async (config) => { await pending.promise; return response(config, 'new-token'); });
    const switching = ctx.useAuthStore.getState().loginWithWeixin();
    await expect(ctx.useAuthStore.getState().loginWithWeixin()).rejects.toThrow();
    await expect(ctx.client.get('/booksInfo')).rejects.toThrow('账号会话');
    pending.resolve();
    await switching;
    expect(ctx.adapter).toHaveBeenCalledTimes(2);
  });

  it('keeps the new login if fetching its profile temporarily fails', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    ctx.adapter.mockImplementationOnce(async (config) => response(config, 'new-token'));
    ctx.adapter.mockImplementationOnce(async (config) => response(config, null, 500));
    await ctx.useAuthStore.getState().loginWithWeixin();
    expect(ctx.useAuthStore.getState()).toMatchObject({ token: 'new-token', isAuthenticated: true, user: null });
  });

  it.each([200, 401])('ignores a stale profile response with code %s after replacing the session', async (code) => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    const pending = deferred<void>();
    ctx.adapter.mockImplementationOnce(async (config) => { await pending.promise; return response(config, [binding('stale')], code); });
    const oldRequest = ctx.useAuthStore.getState().getUserInfo();
    const rejected = expect(oldRequest).rejects.toThrow('账号会话');
    await vi.waitFor(() => expect(ctx.adapter).toHaveBeenCalledTimes(1));
    await ctx.useAuthStore.getState().logout();
    ctx.useAuthStore.setState({ token: 'new-token', user: [binding('new')], isAuthenticated: true, loginMethod: 'weixin' });
    pending.resolve();
    await rejected;
    expect(ctx.useAuthStore.getState()).toMatchObject({ token: 'new-token', user: [binding('new')], isAuthenticated: true });
    expect(window.location.href).toBe('');
  });

  it('does not restore an expired new session when profile returns 401', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    ctx.adapter.mockImplementationOnce(async (config) => response(config, 'new-token'));
    ctx.adapter.mockImplementationOnce(async (config) => response(config, null, 401));
    await expect(ctx.useAuthStore.getState().loginWithWeixin()).rejects.toThrow();
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
    expect(window.location.href).toBe('/page/login');
  });

  it('waits for an existing upload before invoking Weixin login', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    ctx.useStudyStore.setState({ wordListBookId: 10, wordList: [{ topic_id: 1, word_level_id: 10, tag_id: 1, options: [] }] });
    const pending = deferred<void>();
    const defaultAdapter = ctx.adapter.getMockImplementation()!;
    ctx.adapter.mockImplementation(async (config) => {
      if (config.url === '/updateDoneData') await pending.promise;
      return defaultAdapter(config);
    });
    const sync = ctx.useStudyStore.getState().syncCurrentBookState(10);
    await vi.waitFor(() => expect(ctx.adapter.mock.calls.some(([request]) => request.url === '/updateDoneData')).toBe(true));
    const switching = ctx.useAuthStore.getState().loginWithWeixin();
    await Promise.resolve();
    expect(ctx.adapter.mock.calls.filter(([request]) => request.url?.startsWith('/login/'))).toHaveLength(0);
    pending.resolve();
    await Promise.all([sync, switching]);
    expect(ctx.adapter.mock.calls.filter(([request]) => request.url === '/updateDoneData')).toHaveLength(1);
    expect(ctx.useAuthStore.getState().token).toBe('new-token');
  });

  it('drops late learning sync writes after logout', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    ctx.useStudyStore.setState({ wordListBookId: 10, wordList: [{ topic_id: 1, word_level_id: 10, tag_id: 1, options: [] }] });
    const pending = deferred<void>();
    const defaultAdapter = ctx.adapter.getMockImplementation()!;
    ctx.adapter.mockImplementation(async (config) => {
      if (config.url === '/updateDoneData') await pending.promise;
      return defaultAdapter(config);
    });
    const sync = ctx.useStudyStore.getState().syncCurrentBookState(10);
    const rejected = expect(sync).rejects.toThrow('账号会话');
    await vi.waitFor(() => expect(ctx.adapter.mock.calls.some(([request]) => request.url === '/updateDoneData')).toBe(true));
    await ctx.useAuthStore.getState().logout();
    pending.resolve();
    await rejected;
    expect(ctx.studyRecordStore.getSnapshot().books).toEqual({});
    expect(ctx.useStudyStore.getState().learnRecords).toEqual({});
  });

  it('does not save a stale learning page checkpoint after switching accounts', async () => {
    const ctx = await setup();
    const { Study } = await import('../services/study/Study');
    const checkpoint = vi.fn();
    const study = new Study([], [], { bookId: 10, planType: 'XModelNewStudy' }, undefined, checkpoint);
    study.checkpoint();
    expect(checkpoint).toHaveBeenCalledTimes(1);
    ctx.accountSession.invalidate();
    study.checkpoint();
    await study.complete();
    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(ctx.studyRecordStore.getSnapshot().books).toEqual({});
  });

  it('rejects stale-tab API requests and record writes before the storage event is handled', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    const originalKey = ctx.accountSession.getStorageKey();
    const { createTopicLearnRecord } = await import('../types/studyRecord');
    const original = ctx.studyRecordStore.getRecord(10, 1);
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      token: 'another-account-token', accountStorageId: 'another-account', isAuthenticated: true,
    } }));

    await expect(ctx.client.get('/userInfo')).rejects.toThrow('账号会话');
    await expect(ctx.studyRecordStore.commitMutation({
      bookId: 10, topicId: 1, eventId: 'stale-status',
      mutate: () => createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 5 }),
      delta: { doneTimes: 0, wrongTimes: 0, usedTime: 0 },
    }))
      .rejects.toThrow('账号会话');
    expect(ctx.accountSession.getStorageKey()).toBe(originalKey);
    expect(ctx.studyRecordStore.getRecord(10, 1)).toEqual(original);
    expect(ctx.adapter).not.toHaveBeenCalled();
  });

  it('does not overwrite another tab’s account when a stale tab starts logout or switching', async () => {
    const ctx = await setup();
    signIn(ctx.useAuthStore);
    await ctx.seedPending();
    const persisted = JSON.stringify({ state: {
      token: 'another-account-token', accountStorageId: 'another-account', isAuthenticated: true,
    } });
    localStorage.setItem('auth-storage', persisted);

    await expect(ctx.useAuthStore.getState().logout()).rejects.toThrow('账号会话');
    await expect(ctx.useAuthStore.getState().loginWithWeixin()).rejects.toThrow('账号会话');
    expect(localStorage.getItem('auth-storage')).toBe(persisted);
    expect(ctx.adapter).not.toHaveBeenCalled();
  });

});
