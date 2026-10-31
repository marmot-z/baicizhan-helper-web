import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './api';
import { studyService } from './studyService';
import type { SelectBookPlanInfo } from '../types';

const plan = (bookId: number): SelectBookPlanInfo => ({
  book_id: bookId, daily_plan_count: 5, review_plan_count: 25, learned_words_count: 0, group_id: 0,
});

afterEach(() => vi.restoreAllMocks());

describe('import learned words', () => {
  it('submits distinct source books, excluding the target and invalid ids', async () => {
    vi.spyOn(studyService, 'getBookPlanInfo').mockResolvedValue([plan(410), plan(575), plan(5), plan(575), plan(0)]);
    const post = vi.spyOn(ApiService, 'post').mockResolvedValue({ code: 200, data: 'task-id', success: true });
    await expect(studyService.importLearnedWordsFromOtherPlans(410)).resolves.toBe('task-id');
    expect(post).toHaveBeenCalledWith('/mergeAlreadyLearnedWordsAsync?bookId=410&oldBookIds=575&oldBookIds=5');
  });

  it('does not issue an invalid import without any source books', async () => {
    vi.spyOn(studyService, 'getBookPlanInfo').mockResolvedValue([plan(410)]);
    const post = vi.spyOn(ApiService, 'post');
    await expect(studyService.importLearnedWordsFromOtherPlans(410)).rejects.toThrow('没有可导入');
    expect(post).not.toHaveBeenCalled();
  });

  it('propagates an import failure for the page to retry', async () => {
    vi.spyOn(studyService, 'getBookPlanInfo').mockResolvedValue([plan(410), plan(575)]);
    vi.spyOn(ApiService, 'post').mockRejectedValue(new Error('导入失败'));
    await expect(studyService.importLearnedWordsFromOtherPlans(410)).rejects.toThrow('导入失败');
  });
});
