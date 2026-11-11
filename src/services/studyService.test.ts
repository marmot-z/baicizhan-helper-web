import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './api';
import { studyService } from './studyService';
import { bookService } from './bookService';
import { StudyUtils } from './study/StudyUtils';
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

describe('X mode word details', () => {
  const detail = (topicId: number) => ({
    resource: { word: { topicId, word: `word-${topicId}` } },
    collected: topicId === 3,
  });

  it.each([null, undefined, { resource: {} }, { ...detail(2), similarWordList: [null] }])(
    'returns the other words in request order when one detail is unavailable',
    async (unavailable) => {
      const data = [detail(3), detail(99), detail(1), detail(1)];
      vi.spyOn(ApiService, 'post').mockResolvedValue({
        code: 200,
        success: true,
        data: unavailable === undefined ? data : [...data, unavailable],
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await studyService.getXModeWordDetails(10, [1, 2, 3]);

      expect(result.words.map(({ topicId, collected }) => ({ topicId, collected }))).toEqual([
        { topicId: 1, collected: false },
        { topicId: 3, collected: true },
      ]);
      expect(result.missingTopicIds).toEqual([2]);
      expect(warn).toHaveBeenCalledExactlyOnceWith('部分单词详情不可用', { bookId: 10, topicIds: [2] });
    },
  );

  it('identifies an entirely unavailable batch and loads all words on retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(ApiService, 'post')
      .mockResolvedValueOnce({ code: 200, success: true, data: [null, null] })
      .mockResolvedValueOnce({ code: 200, success: true, data: [detail(2), detail(1)] });

    await expect(studyService.getXModeWordDetails(10, [1, 2])).resolves.toEqual({ words: [], missingTopicIds: [1, 2] });
    const result = await studyService.getXModeWordDetails(10, [1, 2]);
    expect(result.words.map((word) => word.topicId)).toEqual([1, 2]);
    expect(result.missingTopicIds).toEqual([]);
  });

  it('propagates request and response format errors so the caller can retry', async () => {
    const error = new Error('network error');
    vi.spyOn(ApiService, 'post')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ code: 200, success: true, data: null });

    await expect(studyService.getXModeWordDetails(10, [1])).rejects.toBe(error);
    await expect(studyService.getXModeWordDetails(10, [1])).rejects.toThrow('单词详情响应格式异常');
  });

  it('keeps the correct option when a distractor request fails', async () => {
    const model = StudyUtils.adaptXModeToUIModel(detail(1) as Parameters<typeof StudyUtils.adaptXModeToUIModel>[0]);
    vi.spyOn(bookService, 'getWordDetail').mockRejectedValueOnce(new Error('option unavailable'));

    const options = await StudyUtils.loadOptionsForTopic({ topic_id: 1, word_level_id: 10, tag_id: 1, options: [2] }, model);

    expect(options).toEqual([{ id: 1, word: 'word-1', translation: '', isCorrect: true }]);
    StudyUtils.optionsCache.delete(1);
  });
});
