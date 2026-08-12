import { beforeEach, describe, expect, it } from 'vitest';
import { createTopicLearnRecord } from '../../types/studyRecord';
import { studyRecordStore } from './recordStore';
import { toPendingDoneRecord } from './uploadAdapter';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('studyRecordStore.upsertAndQueue', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
  });

  it('atomically stores a killed record and replaces pending state for the topic', () => {
    const killed = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 });
    studyRecordStore.upsertAndQueue(10, [killed], [toPendingDoneRecord(killed, 1)]);

    const restored = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 5 });
    studyRecordStore.upsertAndQueue(10, [restored], [toPendingDoneRecord(restored, 2)]);

    expect(studyRecordStore.getRecord(10, 1)?.topicScore).toBe(5);
    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord.current_score).toBe(5);
  });
});
