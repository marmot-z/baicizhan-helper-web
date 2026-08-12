import { beforeEach, describe, expect, it, vi } from 'vitest';
import { studyRecordStore } from '../services/study/recordStore';
import { toPendingDoneRecord } from '../services/study/uploadAdapter';
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

describe('studyStore kill sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
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
      syncedBookId: null,
    });
    vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue({
      bookId: 10,
      remoteSyncVer: 0,
    });
  });

  it('keeps a failed upload pending and clears it on the next successful retry', async () => {
    const killed = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 });
    studyRecordStore.upsertAndQueue(10, [killed], [toPendingDoneRecord(killed, 1)]);
    const updateSpy = vi.spyOn(studyService, 'updateDoneData')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ resultCode: 0, syncVersion: 1 });

    await useStudyStore.getState().syncCurrentBookState(10);
    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);

    await useStudyStore.getState().syncCurrentBookState(10);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
  });

  it('treats a negative updateDoneData result as a failed upload', async () => {
    const killed = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 });
    studyRecordStore.upsertAndQueue(10, [killed], [toPendingDoneRecord(killed, 1)]);
    vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({
      resultCode: -1,
      syncVersion: 1,
    });

    await useStudyStore.getState().syncCurrentBookState(10);

    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);
    expect(studyRecordStore.getSyncMeta(10).lastUploadError).toContain('returned -1');
  });

  it('drains a newer status written while an upload is in flight', async () => {
    const killed = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 });
    studyRecordStore.upsertAndQueue(10, [killed], [toPendingDoneRecord(killed, 1)]);

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

    const restored = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 5 });
    studyRecordStore.upsertAndQueue(10, [restored], [toPendingDoneRecord(restored, 2)]);
    const joinedSync = useStudyStore.getState().syncCurrentBookState(10);
    releaseFirstUpload();

    await Promise.all([activeSync, joinedSync]);
    expect(uploadedScores).toEqual([-1, 5]);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
  });
});
