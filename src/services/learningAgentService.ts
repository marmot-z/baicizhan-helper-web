import type { UserBookBasicInfo } from '../types';
import { ApiError, ApiService } from './api';
import { accountSession } from './accountSession';
import { useAuthStore } from '../stores/authStore';
import { readSse } from './sse';

export interface LearningAgentProfile {
  bookId: number;
  bookIntroduction: string | null;
  learningRoute: string | null;
  wordOrder: number[] | null;
  bookRevision: number;
  book: Pick<UserBookBasicInfo, 'id' | 'name' | 'img' | 'total_words_count'> | null;
}

const profilePath = '/agent/profile';

export type LearningRouteStage = 'loading_words' | 'planning' | 'ordering' | 'saving';
export type LearningRouteUpdate =
  | { type: 'progress'; stage: LearningRouteStage; completed: number; total: number }
  | { type: 'rationale_delta'; text: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const learningAgentService = {
  async getProfile(signal: AbortSignal): Promise<LearningAgentProfile | null> {
    const { data } = await ApiService.get<LearningAgentProfile | null>(profilePath, { baseURL: '/', signal });
    return data;
  },

  async selectBook(bookId: number): Promise<LearningAgentProfile> {
    const { data } = await ApiService.put<LearningAgentProfile>(`${profilePath}/book`, { bookId }, { baseURL: '/' });
    return data;
  },

  async planRoute(
    profile: Pick<LearningAgentProfile, 'bookId' | 'bookRevision'>,
    signal: AbortSignal,
    onUpdate: (event: LearningRouteUpdate) => void,
  ): Promise<LearningAgentProfile> {
    signal.throwIfAborted();
    if (accountSession.isSwitching()) throw new Error('账号正在切换');
    const version = accountSession.getVersion();
    const token = useAuthStore.getState().token;
    const controller = new AbortController();
    const requestSignal = AbortSignal.any([signal, controller.signal]);
    const finish = accountSession.trackRequest();
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.token !== token || state.isSwitchingAccount || accountSession.getVersion() !== version) controller.abort();
    });
    const assertCurrent = () => {
      requestSignal.throwIfAborted();
      accountSession.assertCurrent(version);
    };
    try {
      const response = await fetch(`${profilePath}/learning-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { access_token: token } : {}) },
        body: JSON.stringify({ bookId: profile.bookId, bookRevision: profile.bookRevision }),
        signal: requestSignal,
      });
      assertCurrent();
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new ApiError(response.status, isRecord(body) && typeof body.message === 'string' ? body.message : '学习路线规划失败，请重试');
      }
      if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('服务器未返回流式响应，请重试');
      let result: LearningAgentProfile | null = null;
      await readSse(response, (event, data) => {
        assertCurrent();
        const value: unknown = JSON.parse(data);
        if (!isRecord(value)) throw new Error('学习路线响应格式异常，请重试');
        if (event === 'error') {
          throw new ApiError(typeof value.code === 'number' ? value.code : 500, typeof value.message === 'string' ? value.message : '学习路线规划失败，请重试');
        }
        if (event === 'done') {
          const saved = value.profile;
          if (!isRecord(saved) || saved.bookId !== profile.bookId || saved.bookRevision !== profile.bookRevision ||
              typeof saved.learningRoute !== 'string' || !saved.learningRoute.trim() || !Array.isArray(saved.wordOrder) ||
              !saved.wordOrder.length || saved.wordOrder.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
            throw new Error('保存后的学习档案格式异常，请重新加载页面');
          }
          result = saved as unknown as LearningAgentProfile;
          return false;
        }
        if (event === 'rationale_delta' && typeof value.text === 'string') {
          onUpdate({ type: 'rationale_delta', text: value.text });
        } else if (event === 'progress' && ['loading_words', 'planning', 'ordering', 'saving'].includes(String(value.stage)) &&
                   Number.isSafeInteger(value.completed) && Number.isSafeInteger(value.total) && Number(value.completed) >= 0 && Number(value.total) >= 0) {
          onUpdate(value as unknown as LearningRouteUpdate);
        }
      }, requestSignal);
      assertCurrent();
      if (!result) throw new Error('连接已中断，学习路线尚未完成，请重试');
      return result;
    } catch (error) {
      assertCurrent();
      if (error instanceof ApiError && error.code === 401 && token && useAuthStore.getState().token === token) {
        void useAuthStore.getState().logout();
        window.location.href = '/page/login';
      }
      throw error;
    } finally {
      controller.abort();
      unsubscribe();
      finish();
    }
  },
};
