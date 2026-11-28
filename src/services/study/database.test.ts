import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountSession } from '../accountSession';
import { createEmptyBookStateSnapshot, createRecordMap, createRecordFromLearnedWordInfo, createTopicLearnRecord, type PendingDoneRecord, type TopicLearnRecord } from '../../types/studyRecord';
import type { UserLearnedWordInfo } from '../../types';
import { studyRecordStore } from './recordStore';
import { createStudySessionId, studySessionStore } from './sessionStore';
import { applyStudyCorrect, applyDayTransition } from './recordReducers';
import { mergeLearnedRecord } from './recordMerge';
import { toPendingDoneRecord } from './uploadAdapter';
import { emptyAccount, mutateStudyAccount } from './database';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
let namespace = 'test-account';
let localStorage: MemoryStorage;
const remote = (overrides: Partial<UserLearnedWordInfo> = {}): UserLearnedWordInfo => ({
  topic_id: 1, score: 5, used_time: 1000, wrong_times: 1, done_times: 10,
  span_days: 7, update_days: 0, created_at: 1795680000,
  spell_score: 3, listening_score: 3, chn_score: 3, review_round: 1, ...overrides,
});
async function addAnswer(eventId: string, topicId = 1) {
  return studyRecordStore.commitQuestionResult({
    bookId: 10, topicId, eventId,
    mutate: (current) => applyStudyCorrect(current, {
      bookId: 10, topicId, doNumDelta: 1, errNumDelta: 1, usedTime: 100,
      nextScore: 3, nextSpanDays: 0,
    }),
  });
}

async function seedRecords(bookId: number, records: TopicLearnRecord[], pending: PendingDoneRecord[] = []) {
  await mutateStudyAccount((account) => {
    const book = account.books[bookId] ??= createEmptyBookStateSnapshot();
    Object.assign(book.totalRecords, createRecordMap(records));
    book.pendingDoneQueue.push(...pending);
  });
}
async function rawAccount(databaseName: string, accountKey: string, value?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('accounts');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('accounts', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('accounts');
      const action = value === undefined ? store.get(accountKey) : store.put(value, accountKey);
      let result: unknown;
      action.onsuccess = () => { result = action.result; };
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  });
}

beforeEach(async () => {
  await studyRecordStore.closeDatabase();
  vi.restoreAllMocks();
  namespace = 'test-account';
  vi.spyOn(accountSession, 'getStorageKey').mockImplementation(() => namespace);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
});
afterEach(async () => {
  await studyRecordStore.closeDatabase();
  vi.restoreAllMocks();
});

describe('transactional learning storage', () => {
  it('commits cumulative state, incremental outbox, receipt and checkpoint atomically', async () => {
    await studyRecordStore.initialize();
    await seedRecords(10, [createTopicLearnRecord({ bookId: 10, topicId: 1, doNum: 10, errNum: 4, totalTime: 1000 })]);
    const state = {
      sessionId: createStudySessionId(), wordTopicIds: [1], process: { currentIteratorIndex: 0, queues: { recognition: [], understanding: [1], mastery: [1] } },
      currentCard: null, failMap: {}, useTimeMap: {}, elapsedTime: 0, currentWordElapsedTime: 0,
      question: { questionId: 'q1', topicId: 1, phase: 'recognition', elapsedTime: 100, hadWrong: true, committed: true },
    };
    const checkpoint = studySessionStore.buildCheckpoint('learn', 10, state);
    const input = {
      bookId: 10, topicId: 1, eventId: 'q1', checkpoint,
      mutate: (current: ReturnType<typeof createTopicLearnRecord> | undefined) => applyStudyCorrect(current, {
        bookId: 10, topicId: 1, doNumDelta: 1, errNumDelta: 1, usedTime: 100,
      }),
    };
    await studyRecordStore.commitQuestionResult(input);
    await studyRecordStore.commitQuestionResult(input);
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 11, errNum: 5, totalTime: 1100 });
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord).toMatchObject({ done_times: 1, wrong_times: 1, used_time: 100 });
    expect(studySessionStore.load('learn', 10)?.state.question?.committed).toBe(true);
    await studySessionStore.save({ ...checkpoint, state: { ...state, question: { ...state.question, committed: false } } });
    expect(studySessionStore.load('learn', 10)?.state.question?.committed).toBe(true);
  });

  it('leaves the current question and counters unchanged when a write aborts', async () => {
    await studyRecordStore.initialize();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await expect(addAnswer('failed')).rejects.toThrow('full');
    expect(studyRecordStore.getRecord(10, 1)).toBeUndefined();
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
    put.mockRestore();
    await addAnswer('failed');
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });

  it('freezes retries and acknowledges only the old batch while new same-topic work survives', async () => {
    await addAnswer('one');
    expect(await studyRecordStore.acquireLease(10, 'tab-a')).toBe(true);
    const first = await studyRecordStore.freezeBatch(10, 800, 'tab-a');
    await addAnswer('two');
    expect(await studyRecordStore.freezeBatch(10, 800, 'tab-a')).toEqual(first);
    expect(first?.records[0].doneRecord.done_times).toBe(1);
    expect(await studyRecordStore.ackBatch(10, first!.batchId, 300, 'tab-a')).toBe(true);
    expect(studyRecordStore.getPendingDoneRecords(10)).toHaveLength(1);
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord.done_times).toBe(1);
    expect(studyRecordStore.getSyncMeta(10)).toMatchObject({ lastUploadedVersion: 300, lastPulledVersion: 0, needsFullPull: true });
  });

  it('limits each batch to 800 unique topics and excludes concurrent lease owners', async () => {
    const records = Array.from({ length: 805 }, (_, index) => createTopicLearnRecord({ bookId: 10, topicId: index + 1, topicScore: 3 }));
    await seedRecords(10, records, records.map((record) => toPendingDoneRecord(record, 1, { doneTimes: 1, wrongTimes: 0, usedTime: 1 })));
    expect(await studyRecordStore.acquireLease(10, 'a')).toBe(true);
    expect(await studyRecordStore.acquireLease(10, 'b')).toBe(false);
    expect(await studyRecordStore.freezeBatch(10, 800, 'b')).toBeNull();
    const batch = await studyRecordStore.freezeBatch(10, 800, 'a');
    expect(batch?.records).toHaveLength(800);
    expect(await studyRecordStore.ackBatch(10, batch!.batchId, 1, 'b')).toBe(false);
    await studyRecordStore.releaseLease(10, 'a');
    expect(await studyRecordStore.acquireLease(10, 'b')).toBe(true);
    expect((await studyRecordStore.freezeBatch(10, 800, 'b'))?.batchId).toBe(batch!.batchId);
  });

  it('reloads durable records and isolates account namespaces', async () => {
    await addAnswer('a');
    await studyRecordStore.closeDatabase();
    await studyRecordStore.initialize();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
    namespace = 'other-account';
    await studyRecordStore.initialize();
    expect(studyRecordStore.getAllRecords(10)).toEqual([]);
    namespace = 'test-account';
    await studyRecordStore.initialize();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });

  it('rejects an expired owner ACK and lets the next owner retry the same batch', async () => {
    await addAnswer('lease-answer');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await studyRecordStore.acquireLease(10, 'old', 100);
    const batch = await studyRecordStore.freezeBatch(10, 800, 'old');
    clock.mockReturnValue(1101);
    expect(await studyRecordStore.ackBatch(10, batch!.batchId, 1, 'old')).toBe(false);
    expect(await studyRecordStore.acquireLease(10, 'new')).toBe(true);
    expect((await studyRecordStore.freezeBatch(10, 800, 'new'))?.batchId).toBe(batch!.batchId);
  });

  it('does not resurrect a closed session from a delayed checkpoint callback', async () => {
    const draft = studySessionStore.buildCheckpoint('learn', 10, {
      sessionId: createStudySessionId(), wordTopicIds: [1], process: { currentIteratorIndex: 0, queues: { recognition: [1], understanding: [1], mastery: [1] } },
      currentCard: null, failMap: {}, useTimeMap: {}, elapsedTime: 0, currentWordElapsedTime: 0,
    });
    await studySessionStore.save(draft);
    await studySessionStore.clear('learn', 10);
    await studySessionStore.save({ ...draft, updatedAt: Date.now() + 100 });
    expect(studySessionStore.load('learn', 10)).toBeNull();
  });

  it('does not write a checkpoint cancelled while waiting for the transaction', async () => {
    const draft = studySessionStore.buildCheckpoint('learn', 10, {
      sessionId: createStudySessionId(), wordTopicIds: [1], process: { currentIteratorIndex: 0, queues: { recognition: [1], understanding: [1], mastery: [1] } },
      currentCard: null, failMap: {}, useTimeMap: {}, elapsedTime: 0, currentWordElapsedTime: 0,
    });
    let active = true;
    const pending = studySessionStore.save(draft, () => active);
    active = false;
    expect(await pending).toBe(true);
    expect(studySessionStore.load('learn', 10)).toBeNull();
  });

  it('rejects new results for a closed checkpoint while known receipts remain idempotent', async () => {
    const draft = studySessionStore.buildCheckpoint('learn', 10, {
      sessionId: createStudySessionId(), wordTopicIds: [1], process: { currentIteratorIndex: 0, queues: { recognition: [], understanding: [1], mastery: [1] } },
      currentCard: null, failMap: {}, useTimeMap: {}, elapsedTime: 0, currentWordElapsedTime: 0,
    });
    const input = {
      bookId: 10, topicId: 1, eventId: 'closed-q1', checkpoint: draft,
      mutate: (record: ReturnType<typeof createTopicLearnRecord> | undefined) => applyStudyCorrect(record, { bookId: 10, topicId: 1 }),
    };
    await studyRecordStore.commitQuestionResult(input);
    await studySessionStore.clear('learn', 10);
    await expect(studyRecordStore.commitQuestionResult(input)).resolves.toMatchObject({ doNum: 1 });
    await expect(studyRecordStore.commitQuestionResult({ ...input, eventId: 'closed-q2' })).rejects.toThrow('学习会话已结束');
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
    expect(studySessionStore.load('learn', 10)).toBeNull();
  });

  it('fails closed when IndexedDB is unavailable instead of falling back to localStorage', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
    await expect(studyRecordStore.initialize()).rejects.toThrow('IndexedDB');
    expect(localStorage.getItem('study-indexeddb-migrated')).toBeNull();
  });
});

describe('single-format initialization', () => {
  it('ignores old localStorage and the old database, cleaning only the three study keys', async () => {
    const oldSnapshot = { ...emptyAccount(), books: { 10: createEmptyBookStateSnapshot({
      totalRecords: { 1: createTopicLearnRecord({ bookId: 10, topicId: 1, doNum: 10 }) },
    }) } };
    await rawAccount('baicizhan-study-v3', namespace, oldSnapshot);
    localStorage.setItem('study-record-store', JSON.stringify(oldSnapshot));
    localStorage.setItem('study-session-store', '{bad json');
    localStorage.setItem('study-indexeddb-migrated', '3');
    localStorage.setItem('auth-storage', 'preserved-login');
    localStorage.setItem('settings-storage', 'preserved-settings');
    localStorage.setItem('custom-wordbook-storage', 'preserved-wordbooks');
    const open = vi.spyOn(indexedDB, 'open');
    // The account-session test double avoids parsing the intentionally opaque auth fixture.
    vi.spyOn(accountSession, 'assertCurrent').mockImplementation(() => {});
    await studyRecordStore.initialize();
    expect(open).toHaveBeenCalledWith('baicizhan-study', 1);
    expect(open).not.toHaveBeenCalledWith('baicizhan-study-v3', expect.anything());
    expect(studyRecordStore.getAllRecords(10)).toEqual([]);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
    expect(studySessionStore.load('learn', 10)).toBeNull();
    expect(studyRecordStore.getSyncMeta(10)).toMatchObject({ needsFullPull: true, lastPulledAt: 0 });
    for (const key of ['study-record-store', 'study-session-store', 'study-indexeddb-migrated']) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('auth-storage')).toBe('preserved-login');
    expect(localStorage.getItem('settings-storage')).toBe('preserved-settings');
    expect(localStorage.getItem('custom-wordbook-storage')).toBe('preserved-wordbooks');
    expect(await rawAccount('baicizhan-study-v3', namespace)).toEqual(oldSnapshot);
  });

  it.each([
    { version: 3, books: {}, drafts: {}, receipts: {}, closedSessions: {} },
    { ...emptyAccount(), books: { 10: { totalRecords: {} } } },
    { ...emptyAccount(), receipts: null },
  ])('rebuilds only an invalid account snapshot and requests a fresh pull', async (invalid) => {
    await rawAccount('baicizhan-study', namespace, invalid);
    const otherAccount = { ...emptyAccount(), books: { 20: createEmptyBookStateSnapshot() } };
    await rawAccount('baicizhan-study', 'other-account', otherAccount);
    await studyRecordStore.initialize();
    expect(studyRecordStore.getSnapshot()).toEqual({ version: 1, books: {} });
    expect(studyRecordStore.getSyncMeta(10).needsFullPull).toBe(true);
    expect(await rawAccount('baicizhan-study', 'other-account')).toEqual(otherAccount);
    await addAnswer('fresh-after-reset');
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });

  it('retries a failed format reset without marking the account ready or deleting its stored row', async () => {
    const invalid = { version: 3, books: { 10: 'old' } };
    await rawAccount('baicizhan-study', namespace, invalid);
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new Error('disk full'); });
    await expect(studyRecordStore.initialize()).rejects.toThrow('disk full');
    put.mockRestore();
    expect(await rawAccount('baicizhan-study', namespace)).toEqual(invalid);
    await studyRecordStore.initialize();
    expect(studyRecordStore.getSnapshot()).toEqual({ version: 1, books: {} });
  });

  it('does not reset current data on a read failure and can retry initialization', async () => {
    await addAnswer('durable-before-read-error');
    await studyRecordStore.closeDatabase();
    const get = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => { throw new Error('read failed'); });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put');
    await expect(studyRecordStore.initialize()).rejects.toThrow('read failed');
    expect(put).not.toHaveBeenCalled();
    get.mockRestore();
    await studyRecordStore.initialize();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord.done_times).toBe(1);
  });

  it('does not reset current data on an open failure and can retry', async () => {
    await addAnswer('durable-before-open-error');
    await studyRecordStore.closeDatabase();
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => { throw new Error('open failed'); });
    await expect(studyRecordStore.initialize()).rejects.toThrow('open failed');
    open.mockRestore();
    await studyRecordStore.initialize();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });
});

describe('remote records and local calendar days', () => {
  it('maps distinct remote day fields and seconds without inventing last-answer time', () => {
    expect(createRecordFromLearnedWordInfo(10, remote({ span_days: 0, update_days: 2 }))).toMatchObject({
      isTodayNew: true, topicDay: 2, createdAt: 1795680000000, lastDoTime: 0,
    });
  });
  it('advances once per calendar day and preserves frozen upload contents', async () => {
    const yesterday = new Date(2026, 10, 25, 12).getTime();
    const today = new Date(2026, 10, 27, 12).getTime();
    const record = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 0, topicDay: 0, isTodayNew: true, updatedAt: yesterday });
    await seedRecords(10, [record], [toPendingDoneRecord(record, yesterday, { doneTimes: 1, wrongTimes: 0, usedTime: 100 })]);
    const batch = await studyRecordStore.freezeBatch(10);
    const pending = { ...record, topicId: 2 };
    await seedRecords(10, [pending], [toPendingDoneRecord(pending, yesterday, { doneTimes: 1, wrongTimes: 0, usedTime: 100 })]);
    await studyRecordStore.normalizeDay(10, today);
    await studyRecordStore.normalizeDay(10, today);
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ topicDay: 2, topicScore: 3, isTodayNew: false });
    expect(studyRecordStore.getInflightBatch(10)).toEqual(batch);
    expect(studyRecordStore.getPendingDoneRecords(10).find((item) => item.topicId === 2)?.doneRecord)
      .toMatchObject({ span_days: 2, is_first_do_at_today: 0, done_times: 1, used_time: 100 });
    const once = applyDayTransition(record, { now: today });
    expect(applyDayTransition(once, { now: today })).toEqual(once);
  });
  it('merges remote kills and ability progress while protecting pending local state', () => {
    const local = createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 5, doNum: 8, spellScore: 4 });
    expect(mergeLearnedRecord(10, local, remote({ score: -1 }), false).topicScore).toBe(-1);
    expect(mergeLearnedRecord(10, local, remote({ score: -1 }), true).topicScore).toBe(5);
    expect(mergeLearnedRecord(10, local, remote({ score: 4, review_round: 2 }), false)).toMatchObject({ topicScore: 5, spellScore: 4, reviewRound: 2, doNum: 10 });
  });

  it('queues cross-day score repairs with zero counters without requeueing ordinary age changes', async () => {
    const previousDate = new Date(2026, 10, 25, 12).getTime();
    const now = new Date(2026, 10, 27, 12).getTime();
    await seedRecords(10, [
      createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 0, topicDay: 0, doNum: 10, errNum: 3, totalTime: 1000, updatedAt: previousDate }),
      createTopicLearnRecord({ bookId: 10, topicId: 2, topicScore: 3, topicDay: 7, doNum: 10, updatedAt: previousDate }),
      createTopicLearnRecord({ bookId: 10, topicId: 3, topicScore: 5, topicDay: 0, updatedAt: previousDate }),
      createTopicLearnRecord({ bookId: 10, topicId: 4, topicScore: -1, topicDay: 0, updatedAt: previousDate }),
    ]);
    await studyRecordStore.normalizeDay(10, now);
    await studyRecordStore.normalizeDay(10, now);
    const pending = studyRecordStore.getPendingDoneRecords(10);
    expect(pending.map((record) => record.topicId)).toEqual([1, 2]);
    expect(pending.map((record) => record.doneRecord.current_score)).toEqual([3, 4]);
    pending.forEach((record) => expect(record.doneRecord).toMatchObject({ done_times: 0, wrong_times: 0, used_time: 0 }));
  });
});
