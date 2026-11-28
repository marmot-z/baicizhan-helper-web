import { accountSession, AccountSessionChangedError } from '../accountSession';
import type { StudyBookStateSnapshot } from '../../types/studyRecord';
import type { StudySessionDraft } from './sessionTypes';

export interface StudyAccountData {
  version: 1;
  books: Record<number, StudyBookStateSnapshot>;
  drafts: Record<string, StudySessionDraft>;
  receipts: Record<string, { bookId: number; topicId: number }>;
  closedSessions: Record<string, true>;
}

const DATABASE_NAME = 'baicizhan-study';
const STORE_NAME = 'accounts';
let databasePromise: Promise<IDBDatabase> | undefined;
let cachedKey = '';
let cachedData: StudyAccountData = emptyAccount();
let initialization: { key: string; promise: Promise<void> } | undefined;
let generation = 0;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;

export function emptyAccount(): StudyAccountData {
  return { version: 1, books: {}, drafts: {}, receipts: {}, closedSessions: {} };
}

function storage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

function key(): string {
  return accountSession.getStorageKey();
}

export function configureStudyAccount(accountKey: string): void {
  if (cachedKey === accountKey) return;
  cachedKey = accountKey;
  cachedData = emptyAccount();
  initialization = undefined;
  generation += 1;
}

function assertContext(accountKey: string, version: number, expectedGeneration: number): void {
  accountSession.assertCurrent(version);
  if (accountKey !== key() || expectedGeneration !== generation) throw new AccountSessionChangedError();
}

export function getStudyAccount(): StudyAccountData {
  configureStudyAccount(key());
  return clone(cachedData);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setupChannel(): void {
  if (channel || typeof BroadcastChannel === 'undefined' || typeof window === 'undefined'
    || typeof window.addEventListener !== 'function') return;
  channel = new BroadcastChannel(DATABASE_NAME);
  channel.onmessage = (event: MessageEvent<{ key?: string }>) => {
    if (event.data?.key === cachedKey) void refreshStudyAccount().catch(() => { /* surface errors on next action */ });
  };
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = globalThis.indexedDB;
      if (!factory) {
        reject(new Error('当前浏览器无法使用 IndexedDB，学习记录未保存，请启用浏览器存储后重试'));
        return;
      }
      const request = factory.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onerror = () => reject(request.error ?? new Error('打开学习数据库失败'));
      request.onblocked = () => reject(new Error('学习数据库升级被旧页面阻止，请关闭旧学习页面后重试'));
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => { database.close(); databasePromise = undefined; };
        resolve(database);
      };
    }).catch((error: unknown) => { databasePromise = undefined; throw error; });
  }
  return databasePromise;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteFields(value: Record<string, unknown>, names: string[]): boolean {
  return names.every((name) => typeof value[name] === 'number' && Number.isFinite(value[name]));
}

function isPending(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.doneRecord)) return false;
  return finiteFields(value, ['topicId', 'queuedAt']) && typeof value.requestKey === 'string'
    && finiteFields(value.doneRecord, ['word_topic_id', 'current_score', 'span_days', 'done_times',
      'wrong_times', 'used_time', 'review_round', 'spell_score', 'listening_score', 'chn_score', 'is_first_do_at_today']);
}

// A format mismatch is recoverable by pulling this account again. Storage failures
// are deliberately handled by the transaction, never interpreted as corrupt data.
function isCurrentAccount(value: unknown): value is StudyAccountData {
  if (!isObject(value) || value.version !== 1 || !isObject(value.books)
    || !isObject(value.drafts) || !isObject(value.receipts) || !isObject(value.closedSessions)) return false;
  if (!Object.values(value.receipts).every((receipt) => isObject(receipt) && finiteFields(receipt, ['bookId', 'topicId']))
    || !Object.values(value.closedSessions).every((closed) => closed === true)) return false;
  return Object.entries(value.books).every(([bookId, book]) => {
    if (!isObject(book) || !isObject(book.totalRecords) || !Array.isArray(book.pendingDoneQueue)
      || !book.pendingDoneQueue.every(isPending) || !isObject(book.syncMeta)) return false;
    const meta = book.syncMeta;
    if (!finiteFields(meta, ['lastUploadedVersion', 'lastPulledVersion', 'lastPulledAt', 'remoteSyncVer',
      'lastSuccessfulSyncAt', 'lastUploadAttemptAt']) || typeof meta.needsFullPull !== 'boolean'
      || !(meta.lastDownloadError === null || typeof meta.lastDownloadError === 'string')
      || !(meta.lastUploadError === null || typeof meta.lastUploadError === 'string')) return false;
    if (book.inflightBatch !== null && (!isObject(book.inflightBatch)
      || typeof book.inflightBatch.batchId !== 'string' || !finiteFields(book.inflightBatch, ['createdAt'])
      || !Array.isArray(book.inflightBatch.records) || !book.inflightBatch.records.every(isPending))) return false;
    if (book.lease !== null && (!isObject(book.lease) || typeof book.lease.owner !== 'string'
      || !finiteFields(book.lease, ['expiresAt']))) return false;
    return Object.entries(book.totalRecords).every(([topicId, record]) => isObject(record)
      && record.bookId === Number(bookId) && record.topicId === Number(topicId)
      && finiteFields(record, ['topicScore', 'topicDay', 'errNum', 'reviewRound', 'lastDoTime', 'doNum',
        'totalTime', 'createdAt', 'updatedAt', 'spellScore', 'listeningScore', 'chnScore'])
      && typeof record.isTodayNew === 'boolean' && typeof record.normalizedDate === 'string');
  });
}

function clearOldStudyStorage(): void {
  try {
    const currentStorage = storage();
    for (const oldKey of ['study-record-store', 'study-session-store', 'study-indexeddb-migrated']) {
      currentStorage?.removeItem(oldKey);
    }
  } catch { /* localStorage is not required by the current study database */ }
}

async function readAccount(database: IDBDatabase, accountKey: string, version: number,
  expectedGeneration: number): Promise<StudyAccountData> {
  return new Promise<StudyAccountData>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let snapshot: StudyAccountData;
    const request = store.get(accountKey);
    request.onsuccess = () => {
      try {
        assertContext(accountKey, version, expectedGeneration);
        snapshot = isCurrentAccount(request.result) ? request.result : emptyAccount();
        if (snapshot !== request.result) store.put(snapshot, accountKey);
      } catch (error) { transaction.abort(); reject(error); }
    };
    transaction.oncomplete = () => resolve(snapshot);
    transaction.onerror = () => reject(transaction.error ?? new Error('读取学习记录失败，请重试'));
    transaction.onabort = () => reject(transaction.error ?? new Error('读取学习记录未完成，请重试'));
  });
}

export async function initializeStudyAccount(): Promise<void> {
  const accountKey = key();
  configureStudyAccount(accountKey);
  if (initialization?.key === accountKey) return initialization.promise;
  const version = accountSession.getVersion();
  const expectedGeneration = generation;
  const promise = (async () => {
    const database = await openDatabase();
    assertContext(accountKey, version, expectedGeneration);
    const data = await readAccount(database, accountKey, version, expectedGeneration);
    assertContext(accountKey, version, expectedGeneration);
    cachedData = data;
    clearOldStudyStorage();
    setupChannel();
    emit();
  })();
  initialization = { key: accountKey, promise };
  try { await promise; } catch (error) {
    if (initialization?.promise === promise) initialization = undefined;
    throw error;
  }
}

export async function mutateStudyAccount<T>(mutate: (account: StudyAccountData) => T): Promise<T> {
  const accountKey = key();
  const version = accountSession.getVersion();
  await initializeStudyAccount();
  const expectedGeneration = generation;
  const database = await openDatabase();
  assertContext(accountKey, version, expectedGeneration);
  const result = await new Promise<{ value: T; data: StudyAccountData }>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let data: StudyAccountData;
    let value: T;
    const request = store.get(accountKey);
    request.onsuccess = () => {
      try {
        assertContext(accountKey, version, expectedGeneration);
        data = isCurrentAccount(request.result) ? request.result : emptyAccount();
        value = mutate(data);
        store.put(data, accountKey);
      } catch (error) { transaction.abort(); reject(error); }
    };
    transaction.oncomplete = () => resolve({ value, data });
    transaction.onerror = () => reject(transaction.error ?? new Error('学习记录保存失败，请重试当前操作'));
    transaction.onabort = () => reject(transaction.error ?? new Error('学习记录保存未完成，请重试当前操作'));
  });
  assertContext(accountKey, version, expectedGeneration);
  cachedData = clone(result.data);
  emit();
  channel?.postMessage({ key: accountKey });
  return clone(result.value);
}

export async function refreshStudyAccount(): Promise<void> {
  const accountKey = key();
  const version = accountSession.getVersion();
  await initializeStudyAccount();
  const expectedGeneration = generation;
  const database = await openDatabase();
  assertContext(accountKey, version, expectedGeneration);
  const data = await readAccount(database, accountKey, version, expectedGeneration);
  assertContext(accountKey, version, expectedGeneration);
  cachedData = data;
  emit();
}

export function subscribeStudyAccount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function closeStudyDatabase(): Promise<void> {
  if (databasePromise) (await databasePromise).close();
  databasePromise = undefined;
  initialization = undefined;
  cachedKey = '';
  cachedData = emptyAccount();
  generation += 1;
  channel?.close();
  channel = undefined;
}
