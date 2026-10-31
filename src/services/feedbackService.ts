import { ApiError, ApiService } from './api';
import type { ApiResponse, FeedbackItem, FeedbackPageResponse } from '../types';

export { ApiError as FeedbackApiError } from './api';

export const unwrapFeedbackResponse = <T>(response: ApiResponse<T>): T => {
  const code = response.code ?? 200;
  if (code !== 200) {
    throw new ApiError(code, response.message || '反馈请求失败，请稍后重试');
  }
  return response.data;
};

export const feedbackService = {
  async list(page: number): Promise<FeedbackPageResponse> {
    const response = await ApiService.get<FeedbackPageResponse>(`/feedback?page=${page}`);
    return unwrapFeedbackResponse(response);
  },

  async create(content: string): Promise<FeedbackItem> {
    const response = await ApiService.post<FeedbackItem>('/feedback', { content });
    return unwrapFeedbackResponse(response);
  },

  async reply(id: number, content: string): Promise<FeedbackItem> {
    const response = await ApiService.post<FeedbackItem>(`/feedback/${id}/reply`, { content });
    return unwrapFeedbackResponse(response);
  },
};
