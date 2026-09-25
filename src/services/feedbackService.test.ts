import { describe, expect, it } from 'vitest';
import { FeedbackApiError, unwrapFeedbackResponse } from './feedbackService';

describe('unwrapFeedbackResponse', () => {
  it('returns successful response data', () => {
    expect(unwrapFeedbackResponse({ code: 200, data: { id: 1 }, success: true })).toEqual({ id: 1 });
  });

  it('preserves backend business error code and message', () => {
    let captured: unknown;
    try {
      unwrapFeedbackResponse({
        code: 429,
        data: undefined as never,
        success: false,
        message: '每天最多提交 3 个问题，请明天再试',
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(FeedbackApiError);
    expect((captured as FeedbackApiError).code).toBe(429);
    expect((captured as Error).message).toBe('每天最多提交 3 个问题，请明天再试');
  });
});
