import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeStudyDatabase } from '../services/study/database';
import { studyRecordStore } from '../services/study/recordStore';
import { studyService } from '../services/studyService';
import { createTopicLearnRecord } from '../types/studyRecord';
import type { UserBookBasicInfo } from '../types';
import { useStudyStore } from './studyStore';

const book: UserBookBasicInfo = {
  id: 410, name: '中考词汇', total_words_count: 2, is_word_course: false,
  group_count: 0, book_flag: 0, img: '', desc: '',
};
const plan = { book_id: 410, daily_plan_count: 5, review_plan_count: 25, learned_words_count: 0, group_id: 0 };
const roadmap = [{ topic_id: 1, word_level_id: 410, tag_id: 1, options: [] }];

beforeEach(async () => {
  await closeStudyDatabase();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  await studyRecordStore.initialize();
  useStudyStore.getState().clearStudyData();
  vi.spyOn(studyService, 'getBookPlanInfo').mockResolvedValue([plan]);
  vi.spyOn(studyService, 'getRoadmap').mockResolvedValue(roadmap);
  vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue({ bookId: 410, remoteSyncVer: 1, versionKnown: true });
  vi.spyOn(studyService, 'getLearnedWords').mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { vi.restoreAllMocks(); await closeStudyDatabase(); });

describe('refresh after selecting a wordbook', () => {
  it('syncs a non-current book without fetching its roadmap or replacing the active list', async () => {
    await useStudyStore.getState().refreshStudyDataForBook(book);
    vi.mocked(studyService.getRoadmap).mockClear();
    await useStudyStore.getState().syncCurrentBookState(575);
    expect(studyService.getRoadmap).not.toHaveBeenCalled();
    expect(useStudyStore.getState().wordListBookId).toBe(410);
    expect(useStudyStore.getState().wordList).toEqual(roadmap);
  });
  it('updates the active book only when the target plan is current', async () => {
    await useStudyStore.getState().refreshStudyDataForBook(book);
    expect(useStudyStore.getState().currentBook?.id).toBe(410);
    expect(useStudyStore.getState().preparedBookId).toBe(410);
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

  it('keeps first-pull failure unprepared and permits retry with the current roadmap', async () => {
    vi.mocked(studyService.getLearnedWords).mockRejectedValueOnce(new Error('首次进度加载失败'));

    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).rejects.toThrow('学习进度获取失败');

    expect(useStudyStore.getState()).toMatchObject({
      preparedBookId: null, studyStateError: expect.stringContaining('学习进度获取失败'),
    });
    expect(studyRecordStore.getSyncMeta(410).lastPulledAt).toBe(0);
    expect(studyRecordStore.getSyncMeta(410).lastDownloadError).toContain('首次进度加载失败');
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual([]);

    await expect(useStudyStore.getState().syncCurrentBookState(410)).resolves.toMatchObject({ download: 'synced' });

    expect(useStudyStore.getState()).toMatchObject({ preparedBookId: 410, studyStateError: null });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual(roadmap);
    expect(studyRecordStore.getSyncMeta(410).lastPulledAt).toBeGreaterThan(0);
  });

  it('prepares a first-time book after an empty learned list even with an unknown version', async () => {
    vi.mocked(studyService.getStudySyncMeta).mockResolvedValue({ bookId: 410, remoteSyncVer: 0, versionKnown: false });

    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).resolves.toBeUndefined();

    expect(useStudyStore.getState()).toMatchObject({ preparedBookId: 410, studyStateError: null });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual(roadmap);
    expect(studyRecordStore.getSyncMeta(410)).toMatchObject({ needsFullPull: true, lastPulledVersion: 0 });
    expect(studyRecordStore.getSyncMeta(410).lastPulledAt).toBeGreaterThan(0);
    expect(useStudyStore.getState().syncResults[410].download).toBe('pending');
  });

  it('prepares a fetched empty snapshot when only the follow-up version check fails', async () => {
    vi.mocked(studyService.getStudySyncMeta)
      .mockResolvedValueOnce({ bookId: 410, remoteSyncVer: 1, versionKnown: true })
      .mockRejectedValueOnce(new Error('version request failed'));

    await expect(useStudyStore.getState().refreshStudyDataForBook(book)).resolves.toBeUndefined();

    expect(useStudyStore.getState()).toMatchObject({ preparedBookId: 410, studyStateError: null });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual(roadmap);
    expect(useStudyStore.getState().syncResults[410].download).toBe('failed');
    expect(studyRecordStore.getSyncMeta(410).lastPulledAt).toBeGreaterThan(0);
    expect(studyRecordStore.getSyncMeta(410).needsFullPull).toBe(true);
  });

  it('does not treat an ordinary failed first sync as an all-unlearned book', async () => {
    useStudyStore.setState({ studyPlan: plan, currentBook: book });
    vi.mocked(studyService.getStudySyncMeta).mockRejectedValueOnce(new Error('offline'));

    await expect(useStudyStore.getState().syncCurrentBookState(410)).rejects.toThrow('学习进度获取失败');

    expect(useStudyStore.getState().preparedBookId).toBeNull();
    expect(useStudyStore.getState().studyStateError).toContain('学习进度获取失败');
    expect(studyRecordStore.getSyncMeta(410).lastDownloadError).toContain('offline');
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual([]);
  });

  it('keeps existing current records usable when both upload and reconciliation fail', async () => {
    useStudyStore.setState({ studyPlan: plan, currentBook: book, wordList: roadmap, wordListBookId: 410 });
    await studyRecordStore.commitQuestionResult({
      bookId: 410, topicId: 1, eventId: 'cached-question',
      mutate: () => createTopicLearnRecord({ bookId: 410, topicId: 1, topicScore: 5, doNum: 1, reviewRound: 1 }),
      delta: { doneTimes: 1, wrongTimes: 0, usedTime: 100 },
    });
    vi.mocked(studyService.getStudySyncMeta).mockRejectedValueOnce(new Error('pull offline'));
    vi.spyOn(studyService, 'updateDoneData').mockRejectedValueOnce(new Error('upload offline'));

    await expect(useStudyStore.getState().syncCurrentBookState(410)).resolves.toMatchObject({
      upload: 'failed', download: 'failed', pendingCount: 1,
    });

    expect(useStudyStore.getState()).toMatchObject({ preparedBookId: 410, studyStateError: null });
    expect(useStudyStore.getState().learnRecords[1]).toMatchObject({ topicScore: 5, doNum: 1 });
    expect(studyRecordStore.getPendingDoneRecords(410)).toHaveLength(1);
  });

  it('keeps a previously fetched empty snapshot usable during a later network failure', async () => {
    await useStudyStore.getState().refreshStudyDataForBook(book);
    vi.mocked(studyService.getStudySyncMeta).mockRejectedValueOnce(new Error('offline'));

    await expect(useStudyStore.getState().syncCurrentBookState(410)).resolves.toMatchObject({ download: 'failed' });

    expect(useStudyStore.getState()).toMatchObject({ preparedBookId: 410, studyStateError: null });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual(roadmap);
  });
});

describe('study plan loading', () => {
  it('reports learning-snapshot failure separately after the plan loads successfully', async () => {
    useStudyStore.setState({ currentBook: book });
    vi.mocked(studyService.getLearnedWords).mockRejectedValueOnce(new Error('progress offline'));

    await expect(useStudyStore.getState().fetchStudyData()).resolves.toBeUndefined();

    expect(useStudyStore.getState()).toMatchObject({
      currentBook: book, studyPlan: plan, planLoadError: null,
      preparedBookId: null, studyStateError: expect.stringContaining('学习进度获取失败'),
    });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual([]);

    await useStudyStore.getState().fetchStudyData();

    expect(useStudyStore.getState()).toMatchObject({
      preparedBookId: 410, planLoadError: null, studyStateError: null,
    });
  });

  it('exposes roadmap failure without treating it as an empty wordbook and retries the request', async () => {
    useStudyStore.setState({ currentBook: book });
    vi.mocked(studyService.getRoadmap).mockRejectedValueOnce(new Error('词书目录加载失败'));

    await expect(useStudyStore.getState().fetchStudyData()).rejects.toThrow('词书目录加载失败');

    expect(useStudyStore.getState()).toMatchObject({
      planLoadError: '词书目录加载失败', wordListBookId: null, preparedBookId: null,
    });
    expect(studyService.getLearnedWords).not.toHaveBeenCalled();

    await useStudyStore.getState().fetchStudyData();

    expect(studyService.getRoadmap).toHaveBeenCalledTimes(2);
    expect(useStudyStore.getState()).toMatchObject({
      planLoadError: null, wordListBookId: 410, preparedBookId: 410,
    });
  });

  it('distinguishes a failed plan request from a confirmed absent plan and allows retry', async () => {
    useStudyStore.setState({ currentBook: book, studyPlan: plan, studyPlans: [plan] });
    vi.mocked(studyService.getBookPlanInfo).mockRejectedValueOnce(new Error('计划服务不可用'));

    await expect(useStudyStore.getState().fetchStudyData()).rejects.toThrow('计划服务不可用');

    expect(useStudyStore.getState()).toMatchObject({
      currentBook: book, studyPlan: plan, planLoadError: expect.stringContaining('计划服务不可用'),
    });
    expect(studyService.getRoadmap).not.toHaveBeenCalled();
    expect(studyService.getLearnedWords).not.toHaveBeenCalled();

    await expect(useStudyStore.getState().fetchStudyData()).resolves.toBeUndefined();

    expect(useStudyStore.getState()).toMatchObject({ planLoadError: null, preparedBookId: 410 });
  });

  it('clears the active plan only when the server successfully returns no plan', async () => {
    useStudyStore.setState({ currentBook: book, studyPlan: plan, studyPlans: [plan], preparedBookId: 410 });
    vi.mocked(studyService.getBookPlanInfo).mockResolvedValueOnce([]);

    await expect(useStudyStore.getState().fetchStudyData()).resolves.toBeUndefined();

    expect(useStudyStore.getState()).toMatchObject({
      currentBook: null, studyPlan: null, studyPlans: [], preparedBookId: null, planLoadError: null,
    });
    expect(studyService.getLearnedWords).not.toHaveBeenCalled();
  });
});
