import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { UserLearnedWordInfo, UserDoneWordRecord } from '../../types';
import { createEmptyBookStateSnapshot, createTopicLearnRecord } from '../../types/studyRecord';
import { studyService } from '../studyService';
import { ApiError } from '../api';
import { accountSession } from '../accountSession';
import { closeStudyDatabase, mutateStudyAccount } from './database';
import { studyRecordStore } from './recordStore';
import { toPendingDoneRecord } from './uploadAdapter';
import { installStudySyncLifecycle, syncLearningRecords } from './syncEngine';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const bookId = 410;
const metadata = (version: number, versionKnown = true) => ({ bookId, remoteSyncVer: version, versionKnown });
const remoteWord = (topicId: number, doneTimes = 10): UserLearnedWordInfo => ({
  topic_id: topicId, score: 5, used_time: 1000, wrong_times: 0, done_times: doneTimes,
  span_days: 5, update_days: 0, created_at: Math.floor(Date.now() / 1000) - 5 * 86400,
  spell_score: 3, listening_score: 3, chn_score: 3, review_round: 1,
});

let eventSequence = 0;
async function queue(topicId = 1, doneTimes = 1) {
  await studyRecordStore.commitQuestionResult({
    bookId,
    topicId,
    eventId: `sync-test-${eventSequence++}`,
    mutate: (current) => createTopicLearnRecord({
      ...current, bookId, topicId, topicScore: 5,
      doNum: (current?.doNum ?? 10) + doneTimes,
      totalTime: (current?.totalTime ?? 0) + doneTimes * 100,
      lastDoTime: Date.now(),
    }),
    delta: { doneTimes, wrongTimes: 0, usedTime: doneTimes * 100 },
  });
}

async function seedTopics(count: number) {
  await mutateStudyAccount((account) => {
    const state = account.books[bookId] ??= createEmptyBookStateSnapshot();
    for (let topicId = 1; topicId <= count; topicId++) {
      const record = createTopicLearnRecord({ bookId, topicId, topicScore: 5, doNum: 1, lastDoTime: Date.now() });
      state.totalRecords[topicId] = record;
      state.pendingDoneQueue.push(toPendingDoneRecord(record, Date.now(), {
        doneTimes: 1, wrongTimes: 0, usedTime: 100,
      }));
    }
  });
}

let cleanup = () => {};
beforeEach(async () => {
  await closeStudyDatabase();
  vi.restoreAllMocks();
  accountSession.setSwitching(false);
  const storage = new MemoryStorage();
  storage.setItem('auth-storage', JSON.stringify({ state: { token: 'test-token', accountStorageId: 'sync-engine-test' } }));
  const testWindow = Object.assign(new EventTarget(), { localStorage: storage });
  const testDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: testWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: testDocument });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  accountSession.bindStorageSession('test-token', 'sync-engine-test');
  await studyRecordStore.initialize();
  vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue(metadata(300));
  vi.spyOn(studyService, 'getLearnedWords').mockResolvedValue([]);
  cleanup = installStudySyncLifecycle(vi.fn(), () => undefined);
});
afterEach(async () => {
  cleanup();
  await closeStudyDatabase();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('learning record synchronization', () => {
  async function replaceAccount() {
    window.localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: 'next-token', accountStorageId: 'next-account' },
    }));
    accountSession.invalidate();
    accountSession.bindStorageSession('next-token', 'next-account');
    studyRecordStore.configureAccount('next-account');
    await studyRecordStore.initialize();
  }

  it('stops before recording pull metadata when the account changes after the merge commits', async () => {
    await queue();
    vi.mocked(studyService.getLearnedWords).mockResolvedValueOnce([remoteWord(2)]);
    const merge = studyRecordStore.mergeRemoteLearnedWords.bind(studyRecordStore);
    vi.spyOn(studyRecordStore, 'mergeRemoteLearnedWords').mockImplementationOnce(async (...args) => {
      const result = await merge(...args);
      expect(studyRecordStore.getRecord(bookId, 2)?.doNum).toBe(10);
      await replaceAccount();
      return result;
    });
    const upload = vi.spyOn(studyService, 'updateDoneData');

    await expect(syncLearningRecords(bookId)).rejects.toThrow('账号会话');

    expect(accountSession.getStorageKey()).toBe('next-account');
    expect(studyRecordStore.getSnapshot().books).toEqual({});
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledAt).toBe(0);
    expect(studyService.getStudySyncMeta).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    await studyRecordStore.refresh();
    expect(studyRecordStore.getSnapshot().books).toEqual({});
  });

  it('stops before upload metadata or RPC when the account changes after freezing a batch', async () => {
    await queue();
    const freeze = studyRecordStore.freezeBatch.bind(studyRecordStore);
    vi.spyOn(studyRecordStore, 'freezeBatch').mockImplementationOnce(async (...args) => {
      const batch = await freeze(...args);
      expect(batch?.records[0].doneRecord.done_times).toBe(1);
      await replaceAccount();
      return batch;
    });
    const upload = vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({ resultCode: 0, syncVersion: 300 });

    await expect(syncLearningRecords(bookId, { allowDuringAccountSwitch: true })).rejects.toThrow('账号会话');

    expect(accountSession.getStorageKey()).toBe('next-account');
    expect(upload).not.toHaveBeenCalled();
    expect(studyRecordStore.getSnapshot().books).toEqual({});
    expect(studyRecordStore.getSyncMeta(bookId).lastUploadAttemptAt).toBe(0);
    await studyRecordStore.refresh();
    expect(studyRecordStore.getSnapshot().books).toEqual({});
  });

  it('does not send a frozen payload after an account change during upload-metadata persistence', async () => {
    await queue();
    const update = studyRecordStore.updateSyncMeta.bind(studyRecordStore);
    vi.spyOn(studyRecordStore, 'updateSyncMeta').mockImplementationOnce(async (...args) => {
      const metadata = await update(...args);
      expect(metadata.lastUploadAttemptAt).toBeGreaterThan(0);
      await replaceAccount();
      return metadata;
    });
    const upload = vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({ resultCode: 0, syncVersion: 300 });

    await expect(syncLearningRecords(bookId, { allowDuringAccountSwitch: true })).rejects.toThrow('账号会话');

    expect(upload).not.toHaveBeenCalled();
    expect(studyRecordStore.getSnapshot().books).toEqual({});
    await studyRecordStore.refresh();
    expect(studyRecordStore.getSnapshot().books).toEqual({});
  });

  it('pulls another device’s version 200 even when its own upload advances the version to 300', async () => {
    await studyRecordStore.updateSyncMeta(bookId, { lastPulledVersion: 100, needsFullPull: false });
    await queue();
    vi.mocked(studyService.getStudySyncMeta)
      .mockResolvedValueOnce(metadata(200)).mockResolvedValueOnce(metadata(200))
      .mockResolvedValueOnce(metadata(300)).mockResolvedValueOnce(metadata(300));
    vi.mocked(studyService.getLearnedWords)
      .mockResolvedValueOnce([remoteWord(2)])
      .mockResolvedValueOnce([remoteWord(1, 11), remoteWord(2)]);
    const upload = vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({ resultCode: 0, syncVersion: 300 });

    const result = await syncLearningRecords(bookId);

    expect(studyService.getLearnedWords).toHaveBeenCalledTimes(2);
    expect(studyRecordStore.getRecord(bookId, 2)?.topicScore).toBe(5);
    expect(upload.mock.calls[0][0][0].done_times).toBe(1);
    expect(studyRecordStore.getSyncMeta(bookId)).toMatchObject({ lastUploadedVersion: 300, lastPulledVersion: 300, needsFullPull: false });
    expect(result).toMatchObject({ upload: 'synced', download: 'synced', pendingCount: 0 });
  });

  it.each([-1, 1])('retains the frozen batch for nonzero result code %i', async (resultCode) => {
    await queue();
    vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({ resultCode, syncVersion: 300 });

    const result = await syncLearningRecords(bookId);

    expect(result.upload).toBe('failed');
    expect(result.pendingCount).toBe(1);
    expect(studyRecordStore.getSnapshot().books[bookId].inflightBatch?.records[0].doneRecord.done_times).toBe(1);
    expect(studyRecordStore.getSyncMeta(bookId).lastUploadedVersion).toBe(0);
    expect(studyRecordStore.getSyncMeta(bookId).lastUploadError).toContain(`returned ${resultCode}`);
  });

  it('keeps later same-topic increments separate from the acknowledged batch', async () => {
    await queue(1, 1);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const sent: UserDoneWordRecord[][] = [];
    vi.spyOn(studyService, 'updateDoneData').mockImplementation(async (records) => {
      sent.push(structuredClone(records));
      if (sent.length === 1) await pending;
      return { resultCode: sent.length === 1 ? 0 : 1, syncVersion: 300 };
    });
    const syncing = syncLearningRecords(bookId);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await queue(1, 2);
    release();
    const result = await syncing;

    expect(sent.map(records => records[0].done_times)).toEqual([1, 2]);
    expect(result.upload).toBe('failed');
    expect(studyRecordStore.getPendingDoneRecords(bookId).map(item => item.doneRecord.done_times)).toEqual([2]);
  });

  it('retries the original frozen payload before uploading newly queued increments', async () => {
    await queue(1, 1);
    const sent: UserDoneWordRecord[][] = [];
    vi.spyOn(studyService, 'updateDoneData').mockImplementation(async (records) => {
      sent.push(structuredClone(records));
      if (sent.length === 1) throw new Error('reply lost');
      return { resultCode: 0, syncVersion: 300 };
    });
    await syncLearningRecords(bookId);
    const batchId = studyRecordStore.getSnapshot().books[bookId].inflightBatch?.batchId;
    await queue(1, 2);
    expect(studyRecordStore.getSnapshot().books[bookId].inflightBatch?.batchId).toBe(batchId);

    const result = await syncLearningRecords(bookId);

    expect(sent.map(records => records[0].done_times)).toEqual([1, 1, 2]);
    expect(sent[1]).toEqual(sent[0]);
    expect(result.pendingCount).toBe(0);
  });

  it('does not confirm a lower or unknown server watermark as a completed download', async () => {
    await studyRecordStore.updateSyncMeta(bookId, { lastPulledVersion: 100, needsFullPull: false });
    vi.mocked(studyService.getStudySyncMeta).mockResolvedValue(metadata(0, false));

    const result = await syncLearningRecords(bookId);

    expect(studyService.getLearnedWords).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ download: 'pending', needsFullPull: true });
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledVersion).toBe(100);
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledAt).toBeGreaterThan(0);
  });

  it('records an empty learned list as a successful first pull', async () => {
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledAt).toBe(0);

    const result = await syncLearningRecords(bookId);

    expect(result.download).toBe('synced');
    expect(studyRecordStore.getAllRecords(bookId)).toEqual([]);
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledAt).toBeGreaterThan(0);
  });

  it('retains a fetched learned list when the follow-up version request fails', async () => {
    vi.mocked(studyService.getStudySyncMeta)
      .mockResolvedValueOnce(metadata(300))
      .mockRejectedValueOnce(new Error('version response lost'));
    vi.mocked(studyService.getLearnedWords).mockResolvedValueOnce([remoteWord(2)]);

    const result = await syncLearningRecords(bookId);

    expect(result).toMatchObject({ download: 'failed', needsFullPull: true });
    expect(studyRecordStore.getRecord(bookId, 2)?.doNum).toBe(10);
    expect(studyRecordStore.getSyncMeta(bookId)).toMatchObject({
      lastPulledVersion: 0, lastDownloadError: 'version response lost',
    });
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledAt).toBeGreaterThan(0);
  });

  it('does not mark a failed initial learned-list request as prepared and permits retry', async () => {
    vi.mocked(studyService.getLearnedWords).mockRejectedValueOnce(new Error('offline'));

    const failed = await syncLearningRecords(bookId);

    expect(failed.download).toBe('failed');
    expect(studyRecordStore.getSyncMeta(bookId)).toMatchObject({ lastPulledAt: 0, needsFullPull: true });

    const retried = await syncLearningRecords(bookId);

    expect(retried.download).toBe('synced');
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledAt).toBeGreaterThan(0);
    expect(studyRecordStore.getSyncMeta(bookId).lastDownloadError).toBeNull();
  });

  it('keeps reconciliation pending when the server changes during the learned-list fetch', async () => {
    await studyRecordStore.updateSyncMeta(bookId, { lastPulledVersion: 100, needsFullPull: false });
    vi.mocked(studyService.getStudySyncMeta).mockResolvedValueOnce(metadata(200)).mockResolvedValueOnce(metadata(201));
    vi.mocked(studyService.getLearnedWords).mockResolvedValue([remoteWord(2)]);

    const result = await syncLearningRecords(bookId);

    expect(result).toMatchObject({ download: 'pending', needsFullPull: true });
    expect(studyRecordStore.getSyncMeta(bookId).lastPulledVersion).toBe(100);
    expect(studyRecordStore.getRecord(bookId, 2)).toBeDefined();
  });

  it('does not send any requests while another tab owns the upload lease', async () => {
    await queue();
    expect(await studyRecordStore.acquireLease(bookId, 'other-tab')).toBe(true);
    const upload = vi.spyOn(studyService, 'updateDoneData');

    const result = await syncLearningRecords(bookId);

    expect(result).toMatchObject({ upload: 'busy', pendingCount: 1 });
    expect(upload).not.toHaveBeenCalled();
    expect(studyService.getStudySyncMeta).not.toHaveBeenCalled();
  });

  it('uploads at most 800 topics in one batch and drains the remaining topics', async () => {
    await seedTopics(801);
    const upload = vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({ resultCode: 0, syncVersion: 300 });

    const result = await syncLearningRecords(bookId);

    expect(upload.mock.calls.map(([batch]) => batch.length)).toEqual([800, 1]);
    expect(result.pendingCount).toBe(0);
  });

  it('automatically flushes at 50 topics and wakes small queues when the network returns', async () => {
    cleanup();
    const request = vi.fn();
    cleanup = installStudySyncLifecycle(request, () => bookId);
    await seedTopics(49);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    await queue(50);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith(bookId));

    request.mockClear();
    await studyRecordStore.clearAll();
    await queue(1);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    expect(request).toHaveBeenCalledWith(bookId, false);
  });

  it.each([new ApiError(403, 'membership required'), { response: { status: 403 } }])(
    'pauses a forbidden frozen batch and only resumes after explicit manual sync', async forbidden => {
      await queue();
      const request = vi.fn();
      cleanup();
      cleanup = installStudySyncLifecycle(request, () => bookId);
      const upload = vi.spyOn(studyService, 'updateDoneData').mockRejectedValueOnce(forbidden)
        .mockResolvedValue({ resultCode: 0, syncVersion: 300 });
      const failed = await syncLearningRecords(bookId);
      expect(failed).toMatchObject({ upload: 'failed', pauseReason: 'permission', pendingCount: 1 });
      const batch = studyRecordStore.getInflightBatch(bookId);
      const reads = vi.mocked(studyService.getStudySyncMeta).mock.calls.length;
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
      await syncLearningRecords(bookId, { forcePull: true });
      expect(request).not.toHaveBeenCalled();
      expect(upload).toHaveBeenCalledOnce();
      expect(studyService.getStudySyncMeta).toHaveBeenCalledTimes(reads);
      expect(studyRecordStore.getInflightBatch(bookId)).toEqual(batch);
      expect(accountSession.isSwitching()).toBe(false);

      const recovered = await syncLearningRecords(bookId, { forcePull: true, userInitiated: true });
      expect(upload).toHaveBeenCalledTimes(2);
      expect(upload.mock.calls[1][0]).toEqual(upload.mock.calls[0][0]);
      expect(recovered).toMatchObject({ upload: 'synced', pendingCount: 0 });
      expect(recovered.pauseReason).toBeUndefined();
    },
  );

  it('does not upload after a forbidden pull and drops permission pauses when the account changes', async () => {
    await queue();
    vi.mocked(studyService.getStudySyncMeta).mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    const upload = vi.spyOn(studyService, 'updateDoneData').mockResolvedValue({ resultCode: 0, syncVersion: 300 });
    expect(await syncLearningRecords(bookId)).toMatchObject({ pauseReason: 'permission', pendingCount: 1 });
    expect(upload).not.toHaveBeenCalled();
    await replaceAccount();
    const result = await syncLearningRecords(bookId);
    expect(result.pauseReason).toBeUndefined();
    expect(result.download).toBe('synced');
  });

  it('stops immediately if a later batch is forbidden, including after a successful first batch', async () => {
    await queue(1);
    const upload = vi.spyOn(studyService, 'updateDoneData')
      .mockImplementationOnce(async () => {
        await queue(2);
        return { resultCode: 0, syncVersion: 300 };
      })
      .mockRejectedValue(new ApiError(403, 'forbidden'));
    const result = await syncLearningRecords(bookId);
    expect(result).toMatchObject({ pauseReason: 'permission', pendingCount: 1 });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(studyService.getLearnedWords).toHaveBeenCalledOnce();
    expect(studyService.getStudySyncMeta).toHaveBeenCalledTimes(2);
    const manual = await syncLearningRecords(bookId, { userInitiated: true });
    expect(manual.pauseReason).toBe('permission');
    await syncLearningRecords(bookId);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(studyRecordStore.getInflightBatch(bookId)?.records[0].topicId).toBe(2);
  });

  it('uses extended backoff for transport and nonzero-result failures without forcing a full pull', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    await queue();
    cleanup();
    const tasks: ReturnType<typeof syncLearningRecords>[] = [];
    const request = vi.fn((id: number, forcePull?: boolean) => { tasks.push(syncLearningRecords(id, { forcePull })); });
    cleanup = installStudySyncLifecycle(request, () => undefined);
    const upload = vi.spyOn(studyService, 'updateDoneData').mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ resultCode: 1, syncVersion: 0 });
    const timer = vi.spyOn(globalThis, 'setTimeout');
    await syncLearningRecords(bookId);
    for (const delay of [2000, 5000, 15000, 30000, 60000, 300000, 300000]) {
      expect(timer).toHaveBeenLastCalledWith(expect.any(Function), delay);
      const before = upload.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(upload).toHaveBeenCalledTimes(before);
      await vi.advanceTimersByTimeAsync(1);
      await tasks.at(-1);
      expect(upload).toHaveBeenCalledTimes(before + 1);
    }
    expect(request.mock.calls.every(([, force]) => force === false)).toBe(true);
    expect(studyRecordStore.getPendingDoneRecords(bookId)).toHaveLength(1);
  });

  it('checks only current/pending books, cools foreground checks for 60 seconds and bypasses cooling online', async () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await mutateStudyAccount(account => {
      account.books[bookId] = createEmptyBookStateSnapshot();
      account.books[999] = createEmptyBookStateSnapshot();
      account.books[998] = createEmptyBookStateSnapshot();
      const record = createTopicLearnRecord({ bookId: 998, topicId: 3 });
      account.books[998].totalRecords[3] = record;
      account.books[998].pendingDoneQueue = [toPendingDoneRecord(record)];
    });
    cleanup();
    const request = vi.fn();
    cleanup = installStudySyncLifecycle(request, () => bookId);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request.mock.calls).toEqual([[998, false], [bookId, false]]);
    request.mockClear();
    await studyRecordStore.clearRecords(998);
    now += 59999;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).not.toHaveBeenCalled();
    now++;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledExactlyOnceWith(bookId, false);
    request.mockClear();
    window.dispatchEvent(new Event('online'));
    expect(request).toHaveBeenCalledExactlyOnceWith(bookId, false);
  });

  it('does not start an extra foreground retry while an upload backoff timer exists', async () => {
    await queue();
    cleanup();
    const request = vi.fn();
    cleanup = installStudySyncLifecycle(request, () => bookId);
    vi.spyOn(studyService, 'updateDoneData').mockRejectedValue(new Error('offline'));
    await syncLearningRecords(bookId);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    expect(request).toHaveBeenCalledExactlyOnceWith(bookId, false);
  });

  it('does not count frozen and new increments of the same topics twice for the 50-topic threshold', async () => {
    await seedTopics(49);
    await studyRecordStore.freezeBatch(bookId);
    for (let i = 1; i <= 49; i++) await queue(i);
    cleanup();
    const request = vi.fn();
    cleanup = installStudySyncLifecycle(request, () => bookId);
    await queue(1);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    await queue(50);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith(bookId));
  });

});
