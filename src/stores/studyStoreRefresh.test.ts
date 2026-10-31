import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { studyService } from '../services/studyService';
import type { UserBookBasicInfo } from '../types';
import { useStudyStore } from './studyStore';

const book: UserBookBasicInfo = {
  id: 410, name: '中考词汇', total_words_count: 2, is_word_course: false,
  group_count: 0, book_flag: 0, img: '', desc: '',
};
const plan = { book_id: 410, daily_plan_count: 5, review_plan_count: 25, learned_words_count: 0, group_id: 0 };
const roadmap = [{ topic_id: 1, word_level_id: 410, tag_id: 1, options: [] }];

beforeEach(() => {
  useStudyStore.getState().clearStudyData();
  vi.spyOn(studyService, 'getBookPlanInfo').mockResolvedValue([plan]);
  vi.spyOn(studyService, 'getRoadmap').mockResolvedValue(roadmap);
  vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue({ bookId: 410, remoteSyncVer: 0 });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('refresh after selecting a wordbook', () => {
  it('updates the active book only when the target plan is current', async () => {
    await useStudyStore.getState().refreshStudyDataForBook(book);
    expect(useStudyStore.getState().currentBook?.id).toBe(410);
    expect(useStudyStore.getState().syncedBookId).toBe(410);
  });

  it('propagates plan and roadmap failures', async () => {
    vi.mocked(studyService.getBookPlanInfo).mockRejectedValueOnce(new Error('计划刷新失败'));
    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).rejects.toThrow('计划刷新失败');
    vi.mocked(studyService.getRoadmap).mockRejectedValueOnce(new Error('词书刷新失败'));
    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).rejects.toThrow('词书刷新失败');
  });

  it('rejects an empty or mismatched current plan', async () => {
    vi.mocked(studyService.getBookPlanInfo).mockResolvedValueOnce([]);
    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).rejects.toThrow('未获取到');
    vi.mocked(studyService.getBookPlanInfo).mockResolvedValueOnce([{ ...plan, book_id: 575 }]);
    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).rejects.toThrow('目标词书');
    expect(useStudyStore.getState().currentBook).toBeNull();
  });

  it('propagates sync failures during plan selection and permits retry', async () => {
    vi.mocked(studyService.getStudySyncMeta).mockRejectedValueOnce(new Error('同步失败'));
    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).rejects.toThrow('同步失败');
    expect(useStudyStore.getState().syncedBookId).toBeNull();
    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).resolves.toBeUndefined();
  });

  it('retains offline tolerance during an ordinary study sync', async () => {
    vi.mocked(studyService.getStudySyncMeta).mockRejectedValueOnce(new Error('offline'));
    await expect(useStudyStore.getState().syncCurrentBookState(410)).resolves.toBeUndefined();
    expect(useStudyStore.getState().syncedBookId).toBe(410);
  });
});
