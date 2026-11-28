import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeStudyDatabase } from '../services/study/database';
import { studyRecordStore } from '../services/study/recordStore';
import { studyService } from '../services/studyService';
import { createTopicLearnRecord } from '../types/studyRecord';
import { useStudyStore } from './studyStore';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const roadmap = [{ topic_id: 1, word_level_id: 10, tag_id: 1, options: [] }];
let statusSequence = 0;

async function setWordScore(topicScore: number) {
  await studyRecordStore.commitMutation({
    bookId: 10,
    topicId: 1,
    eventId: `status-${statusSequence++}`,
    mutate: (current) => createTopicLearnRecord({ ...current, bookId: 10, topicId: 1, topicScore }),
    delta: { doneTimes: 0, wrongTimes: 0, usedTime: 0 },
  });
}

describe('studyStore kill sync', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await closeStudyDatabase();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
    await studyRecordStore.initialize();
    useStudyStore.setState({
      wordList: roadmap,
      wordListBookId: 10,
      studyPlan: {
        book_id: 10,
        learned_words_count: 0,
        group_id: 0,
        daily_plan_count: 1,
        review_plan_count: 0,
      },
      preparedBookId: null,
    });
    vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue({
      bookId: 10,
      remoteSyncVer: 1,
      versionKnown: true,
    });
    vi.spyOn(studyService, 'getLearnedWords').mockResolvedValue([]);
  });
  afterEach(async () => { vi.restoreAllMocks(); await closeStudyDatabase(); });

  it('keeps a failed upload pending and clears it on the next successful retry', async () => {
    await setWordScore(-1);
    const updateSpy = vi.spyOn(studyService, 'updateDoneData')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ resultCode: 0, syncVersion: 1 });

    await useStudyStore.getState().syncCurrentBookState(10);
    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);

    await useStudyStore.getState().syncCurrentBookState(10);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
  });

  it.each([-1, 1])('treats nonzero updateDoneData result %i as a failed upload', async (resultCode) => {
    await setWordScore(-1);
    vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({
      resultCode,
      syncVersion: 1,
    });

    await useStudyStore.getState().syncCurrentBookState(10);

    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);
    expect(studyRecordStore.getSyncMeta(10).lastUploadError).toContain(`returned ${resultCode}`);
  });

  it('drains a newer status written in the same millisecond while an upload is in flight', async () => {
    await setWordScore(-1);

    let releaseFirstUpload!: () => void;
    const firstUpload = new Promise<void>((resolve) => {
      releaseFirstUpload = resolve;
    });
    const uploadedScores: number[] = [];
    vi.spyOn(studyService, 'updateDoneData').mockImplementation(async (records) => {
      uploadedScores.push(records[0].current_score);
      if (uploadedScores.length === 1) await firstUpload;
      return { resultCode: 0, syncVersion: uploadedScores.length };
    });

    const activeSync = useStudyStore.getState().syncCurrentBookState(10);
    await vi.waitFor(() => expect(uploadedScores).toEqual([-1]));

    await setWordScore(5);
    const joinedSync = useStudyStore.getState().syncCurrentBookState(10);
    releaseFirstUpload();

    await Promise.all([activeSync, joinedSync]);
    expect(uploadedScores).toEqual([-1, 5]);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
  });
});
