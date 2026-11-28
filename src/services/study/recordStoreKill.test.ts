import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createTopicLearnRecord } from '../../types/studyRecord';
import { studyRecordStore } from './recordStore';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('studyRecordStore state mutations', () => {
  beforeEach(async () => {
    await studyRecordStore.closeDatabase();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
    await studyRecordStore.initialize();
  });
  afterEach(() => studyRecordStore.closeDatabase());

  it('atomically stores a killed record and replaces pending state for the topic', async () => {
    await studyRecordStore.commitQuestionResult({
      bookId: 10, topicId: 1, eventId: 'answer',
      mutate: () => createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 3, doNum: 1, errNum: 1, totalTime: 100 }),
    });
    await studyRecordStore.commitMutation({
      bookId: 10, topicId: 1, eventId: 'kill',
      mutate: (current) => ({ ...current!, topicScore: -1 }),
    });
    await studyRecordStore.commitMutation({
      bookId: 10, topicId: 1, eventId: 'unkill',
      mutate: (current) => ({ ...current!, topicScore: 5 }),
    });

    expect(studyRecordStore.getRecord(10, 1)?.topicScore).toBe(5);
    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord).toMatchObject({
      current_score: 5, done_times: 1, wrong_times: 1, used_time: 100,
    });
  });
});
