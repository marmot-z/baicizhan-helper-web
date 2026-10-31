import { AxiosError, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ token: 'current-token' as string | null, logout: vi.fn() }));
vi.mock('../stores/authStore', () => ({ useAuthStore: { getState: () => auth } }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

import { ApiError, ApiService } from './api';

const respond = (code: number, status = 200): AxiosAdapter => async (config) => {
  const response = { config, status, statusText: '', headers: {}, data: { code, message: '服务端错误信息' } };
  if (status >= 400) throw new AxiosError('HTTP error', undefined, config, undefined, response);
  return response;
};

describe('API authentication and business errors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { location: { href: '/page/study-plan/410' } });
    auth.token = 'current-token';
    auth.logout.mockReset().mockImplementation(() => { auth.token = null; });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each([400, 403, 422, 429, 500])('rejects business code %i and keeps the account signed in', async (code) => {
    await expect(ApiService.post('/selectBook', undefined, { adapter: respond(code) }))
      .rejects.toMatchObject({ code, message: '服务端错误信息' });
    expect(auth.logout).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/page/study-plan/410');
  });

  it.each([200, 401])('logs out on confirmed 401 with HTTP status %i', async (status) => {
    await expect(ApiService.get('/userInfo', { adapter: respond(401, status) }))
      .rejects.toBeInstanceOf(ApiError);
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(window.location.href).toBe('/page/login');
  });

  it('does not log out a newly signed-in account for an older request', async () => {
    const adapter: AxiosAdapter = async (config) => {
      auth.token = 'new-token';
      return respond(401)(config);
    };
    await expect(ApiService.get('/userInfo', { adapter })).rejects.toMatchObject({ code: 401 });
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.token).toBe('new-token');
  });

  it('keeps network errors from clearing authentication', async () => {
    await expect(ApiService.get('/userInfo', { adapter: async () => { throw new Error('offline'); } }))
      .rejects.toThrow('offline');
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
