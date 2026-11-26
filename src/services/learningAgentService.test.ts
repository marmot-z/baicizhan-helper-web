import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  token: 'current-token' as string | null,
  isSwitchingAccount: false,
  logout: vi.fn(),
  listeners: new Set<(state: { token: string | null; isSwitchingAccount: boolean }) => void>(),
}));
vi.mock('../stores/authStore', () => ({ useAuthStore: {
  getState: () => auth,
  subscribe: (listener: typeof auth.listeners extends Set<infer T> ? T : never) => {
    auth.listeners.add(listener);
    return () => auth.listeners.delete(listener);
  },
} }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

import { learningAgentService } from './learningAgentService';
import { accountSession } from './accountSession';

const profile = { bookId: 77, bookRevision: 1, learningRoute: '基础优先', wordOrder: [3, 1, 2], bookIntroduction: '简介', book: null };
const frame = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const sse = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });

describe('learning route streaming service', () => {
  beforeEach(() => {
    accountSession.invalidate();
    accountSession.setSwitching(false);
    auth.token = 'current-token'; auth.isSwitchingAccount = false; auth.listeners.clear(); auth.logout.mockReset();
    vi.stubGlobal('window', { location: { href: '/page/learning-agent' } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends authenticated selection identity and accepts only the saved terminal profile', async () => {
    const fetch = vi.fn(async () => sse(
      frame('progress', { type: 'progress', stage: 'loading_words', completed: 3, total: 3 }) +
      frame('rationale_delta', { type: 'rationale_delta', text: '基础优先' }) +
      frame('done', { type: 'done', profile }),
    ));
    vi.stubGlobal('fetch', fetch);
    const updates: unknown[] = [];
    await expect(learningAgentService.planRoute(profile, new AbortController().signal, (event) => updates.push(event))).resolves.toEqual(profile);
    const [path, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/agent/profile/learning-route');
    expect(init.headers).toMatchObject({ access_token: 'current-token' });
    expect(JSON.parse(String(init.body))).toEqual({ bookId: 77, bookRevision: 1 });
    expect(updates).toHaveLength(2);
    expect(auth.listeners.size).toBe(0);
    await accountSession.waitForRequests();
  });

  it.each([400, 403, 409, 429, 500, 502, 503, 504])('preserves login for route failure %i', async (code) => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(frame('error', { code, message: '请重试' }))));
    await expect(learningAgentService.planRoute(profile, new AbortController().signal, () => undefined)).rejects.toMatchObject({ code });
    expect(auth.logout).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/page/learning-agent');
  });

  it.each(['http', 'stream'])('handles a confirmed 401 from %s', async (source) => {
    vi.stubGlobal('fetch', vi.fn(async () => source === 'http'
      ? new Response(JSON.stringify({ message: '请重新登录' }), { status: 401 })
      : sse(frame('error', { code: 401, message: '请重新登录' }))));
    await expect(learningAgentService.planRoute(profile, new AbortController().signal, () => undefined)).rejects.toMatchObject({ code: 401 });
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(window.location.href).toBe('/page/login');
  });

  it('rejects premature disconnects and profiles from another selection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(frame('rationale_delta', { text: '未完成' }))));
    await expect(learningAgentService.planRoute(profile, new AbortController().signal, () => undefined)).rejects.toThrow('连接已中断');
    vi.stubGlobal('fetch', vi.fn(async () => sse(frame('done', { profile: { ...profile, bookRevision: 3 } }))));
    await expect(learningAgentService.planRoute(profile, new AbortController().signal, () => undefined)).rejects.toThrow('档案格式异常');
  });

  it('cancels a waiting stream when account switching starts and releases request tracking', async () => {
    let cancelled = false;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } })));
    const result = learningAgentService.planRoute(profile, new AbortController().signal, () => undefined);
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    auth.isSwitchingAccount = true;
    for (const listener of auth.listeners) listener(auth);
    await assertion;
    await accountSession.waitForRequests();
    expect(cancelled).toBe(true);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('discards an old request before it can log out a new account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      auth.token = 'new-token'; accountSession.invalidate();
      return new Response('{}', { status: 401 });
    }));
    await expect(learningAgentService.planRoute(profile, new AbortController().signal, () => undefined)).rejects.toThrow('账号会话');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.token).toBe('new-token');
  });

  it('never sends a request for an already cancelled effect', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(learningAgentService.planRoute(profile, controller.signal, () => undefined)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
