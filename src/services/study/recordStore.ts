import type { UserLearnedWordInfo } from '../../types';
import {
  createEmptyBookStateSnapshot, createEmptySyncMeta, isKilledRecord, localDate, UNLEARNED_SCORE,
  type PendingDoneRecord, type RemoteLearnRecordMergeResult, type StudyBookStateSnapshot,
  type StudyRecordStoreSnapshot, type StudySyncMeta, type TopicLearnRecord,
} from '../../types/studyRecord';
import {
  closeStudyDatabase, configureStudyAccount, emptyAccount, getStudyAccount,
  initializeStudyAccount, mutateStudyAccount, refreshStudyAccount, subscribeStudyAccount,
  type StudyAccountData,
} from './database';
import type { StudySessionDraft } from './sessionTypes';
import { mergeLearnedRecord } from './recordMerge';
import { toPendingDoneRecord, toUserDoneWordRecord, type DoneRecordDelta } from './uploadAdapter';

export interface CommitStudyMutation {
  bookId: number;
  topicId: number;
  eventId: string;
  mutate: (current: TopicLearnRecord | undefined) => TopicLearnRecord;
  checkpoint?: StudySessionDraft;
  delta?: DoneRecordDelta;
}

function book(account: StudyAccountData, bookId: number): StudyBookStateSnapshot {
  return account.books[bookId] ??= createEmptyBookStateSnapshot();
}
function cachedBook(bookId: number): StudyBookStateSnapshot {
  return getStudyAccount().books[bookId] ?? createEmptyBookStateSnapshot();
}
function addPending(state: StudyBookStateSnapshot, pending: PendingDoneRecord): void {
  pending = { ...pending, doneRecord: { ...pending.doneRecord } };
  const previous = state.pendingDoneQueue.find((item) => item.topicId === pending.topicId);
  if (previous) {
    pending.doneRecord.done_times += previous.doneRecord.done_times;
    pending.doneRecord.wrong_times += previous.doneRecord.wrong_times;
    pending.doneRecord.used_time += previous.doneRecord.used_time;
    pending.queuedAt = Math.min(previous.queuedAt, pending.queuedAt);
  }
  state.pendingDoneQueue = [...state.pendingDoneQueue.filter((item) => item.topicId !== pending.topicId), pending]
    .sort((a, b) => a.queuedAt - b.queuedAt);
}
async function commitMutation(input: CommitStudyMutation): Promise<TopicLearnRecord> {
  return mutateStudyAccount((account) => {
    const state = book(account, input.bookId);
    const previous = state.totalRecords[input.topicId];
    if (account.receipts[input.eventId]) {
      const receipt = account.receipts[input.eventId];
      if (receipt.bookId !== input.bookId || receipt.topicId !== input.topicId) throw new Error('重复的题目标识不匹配');
      if (!previous) throw new Error('题目提交记录与学习记录不一致，请重新加载');
      return previous;
    }
    if (input.checkpoint && account.closedSessions?.[input.checkpoint.sessionId]) throw new Error('学习会话已结束，请重新进入学习');
    const next = input.mutate(previous);
    if (next.bookId !== input.bookId || next.topicId !== input.topicId) throw new Error('学习记录身份不匹配');
    const delta = input.delta ?? {
      doneTimes: Math.max(0, next.doNum - (previous?.doNum ?? 0)),
      wrongTimes: Math.max(0, next.errNum - (previous?.errNum ?? 0)),
      usedTime: Math.max(0, next.totalTime - (previous?.totalTime ?? 0)),
    };
    if (Object.values(delta).some((value) => !Number.isFinite(value) || value < 0)) throw new Error('学习增量无效');
    state.totalRecords[input.topicId] = next;
    addPending(state, toPendingDoneRecord(next, Date.now(), delta));
    account.receipts[input.eventId] = { bookId: input.bookId, topicId: input.topicId };
    if (input.checkpoint) account.drafts[`${input.checkpoint.mode}:${input.checkpoint.bookId}`] = input.checkpoint;
    return next;
  });
}
function owns(state: StudyBookStateSnapshot, owner: string, now = Date.now()): boolean {
  return state.lease?.owner === owner && state.lease.expiresAt > now;
}
function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}
function normalizeRecord(record: TopicLearnRecord, now: number): TopicLearnRecord {
  const today = localDate(now);
  const days = Math.max(0, dayNumber(today) - dayNumber(record.normalizedDate));
  if (!days) return record;
  const topicDay = record.topicDay + days;
  let score = record.topicScore;
  if (!isKilledRecord(record) && score !== UNLEARNED_SCORE) {
    if (topicDay > 7 && score < 4) score = 4;
    else if (topicDay > 0 && score < 3) score = 3;
  }
  return { ...record, normalizedDate: today, topicDay, topicScore: score, isTodayNew: false, updatedAt: now };
}
export const studyRecordStore = {
  initialize: initializeStudyAccount,
  refresh: refreshStudyAccount,
  configureAccount: configureStudyAccount,
  subscribe: subscribeStudyAccount,
  closeDatabase: closeStudyDatabase,
  getSnapshot(): StudyRecordStoreSnapshot { return { version: 1, books: getStudyAccount().books }; },
  getAllRecords(bookId: number): TopicLearnRecord[] { return Object.values(cachedBook(bookId).totalRecords); },
  getRecord(bookId: number, topicId: number): TopicLearnRecord | undefined { return cachedBook(bookId).totalRecords[topicId]; },
  getPendingDoneRecords(bookId: number): PendingDoneRecord[] {
    const state = cachedBook(bookId);
    return [...(state.inflightBatch?.records ?? []), ...state.pendingDoneQueue];
  },
  getSyncMeta(bookId: number): StudySyncMeta { return cachedBook(bookId).syncMeta; },
  getInflightBatch(bookId: number) { return cachedBook(bookId).inflightBatch; },
  async updateSyncMeta(bookId: number, patch: Partial<StudySyncMeta>): Promise<StudySyncMeta> {
    return mutateStudyAccount((account) => {
      const state = book(account, bookId);
      state.syncMeta = { ...createEmptySyncMeta(), ...state.syncMeta, ...patch };
      return state.syncMeta;
    });
  },
  commitMutation,
  commitQuestionResult: commitMutation,
  async acquireLease(bookId: number, owner: string, ttlMs = 30000): Promise<boolean> {
    return mutateStudyAccount((account) => {
      const state = book(account, bookId);
      if (state.lease && state.lease.owner !== owner && state.lease.expiresAt > Date.now()) return false;
      state.lease = { owner, expiresAt: Date.now() + ttlMs };
      return true;
    });
  },
  async renewLease(bookId: number, owner: string, ttlMs = 30000): Promise<boolean> {
    return mutateStudyAccount((account) => {
      const state = book(account, bookId);
      if (!owns(state, owner)) return false;
      state.lease = { owner, expiresAt: Date.now() + ttlMs };
      return true;
    });
  },
  async ownsLease(bookId: number, owner: string): Promise<boolean> {
    await refreshStudyAccount();
    return owns(cachedBook(bookId), owner);
  },
  async releaseLease(bookId: number, owner: string): Promise<void> {
    await mutateStudyAccount((account) => {
      const state = book(account, bookId);
      if (state.lease?.owner === owner) state.lease = null;
    });
  },
  async freezeBatch(bookId: number, max = 800, owner?: string) {
    return mutateStudyAccount((account) => {
      const state = book(account, bookId);
      if (owner && !owns(state, owner)) return null;
      if (state.inflightBatch) return state.inflightBatch;
      const records = state.pendingDoneQueue.slice(0, Math.min(800, Math.max(1, max)));
      if (!records.length) return null;
      state.pendingDoneQueue = state.pendingDoneQueue.slice(records.length);
      state.inflightBatch = { batchId: crypto.randomUUID(), createdAt: Date.now(), records };
      return state.inflightBatch;
    });
  },
  async ackBatch(bookId: number, batchId: string, version: number, owner?: string): Promise<boolean> {
    return mutateStudyAccount((account) => {
      const state = book(account, bookId);
      if ((owner && !owns(state, owner)) || state.inflightBatch?.batchId !== batchId) return false;
      state.inflightBatch = null;
      state.syncMeta.lastUploadedVersion = version;
      state.syncMeta.lastSuccessfulSyncAt = Date.now();
      state.syncMeta.lastUploadError = null;
      state.syncMeta.needsFullPull = true;
      return true;
    });
  },
  async normalizeDay(bookId: number, now = Date.now()): Promise<void> {
    await mutateStudyAccount((account) => {
      const state = book(account, bookId);
      const repairedTopicIds: number[] = [];
      Object.entries(state.totalRecords).forEach(([id, record]) => {
        const normalized = normalizeRecord(record, now);
        state.totalRecords[Number(id)] = normalized;
        if (normalized.topicScore !== record.topicScore) repairedTopicIds.push(Number(id));
      });
      state.pendingDoneQueue.forEach((pending) => {
        const record = state.totalRecords[pending.topicId];
        if (!record) return;
        pending.doneRecord = toUserDoneWordRecord(record, {
          doneTimes: pending.doneRecord.done_times,
          wrongTimes: pending.doneRecord.wrong_times,
          usedTime: pending.doneRecord.used_time,
        });
      });
      repairedTopicIds.forEach((topicId) => {
        if (state.pendingDoneQueue.some((pending) => pending.topicId === topicId)) return;
        // A frozen old batch cannot be edited; carry its score repair in the next batch.
        addPending(state, toPendingDoneRecord(state.totalRecords[topicId], now));
      });
    });
  },
  async mergeRemoteLearnedWords(bookId: number, remoteWords: UserLearnedWordInfo[]): Promise<RemoteLearnRecordMergeResult> {
    return mutateStudyAccount((account) => {
      const state = book(account, bookId);
      const pendingIds = new Set([...state.pendingDoneQueue, ...(state.inflightBatch?.records ?? [])].map((item) => item.topicId));
      const mergedRecords = remoteWords.map((word) => {
        const record = mergeLearnedRecord(bookId, state.totalRecords[word.topic_id], word, pendingIds.has(word.topic_id));
        state.totalRecords[word.topic_id] = record;
        return record;
      });
      return { mergedRecords, touchedTopicIds: mergedRecords.map((record) => record.topicId) };
    });
  },
  async clearRecords(bookId: number): Promise<void> {
    await mutateStudyAccount((account) => { delete account.books[bookId]; });
  },
  async clearAll(): Promise<void> {
    await mutateStudyAccount((account) => Object.assign(account, emptyAccount()));
  },
};
