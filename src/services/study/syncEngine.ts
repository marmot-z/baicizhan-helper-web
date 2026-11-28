import { accountSession } from '../accountSession';
import { studyService } from '../studyService';
import { studyRecordStore } from './recordStore';

export interface StudySyncResult {
  upload: 'synced' | 'pending' | 'failed' | 'busy';
  download: 'synced' | 'pending' | 'failed';
  pendingCount: number;
  needsFullPull: boolean;
  errors: unknown[];
  pauseReason?: 'permission';
}
export interface StudySyncOptions {
  forcePull?: boolean;
  allowDuringAccountSwitch?: boolean;
  userInitiated?: boolean;
}
const ownerId = globalThis.crypto?.randomUUID?.() ?? `uploader-${Date.now()}-${Math.random()}`;
const inflight = new Map<string, Promise<StudySyncResult>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryAttempts = new Map<string, number>();
const retryDelays = [2000, 5000, 15000, 30000, 60000, 300000];
const permissionPauses = new Map<string, unknown>();
const foregroundChecks = new Map<string, number>();
let runtimeSession = '';
let requestSync: ((bookId: number, forcePull?: boolean) => void) | null = null;
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
function clearRetry(key: string) {
  const timer = retryTimers.get(key);
  if (timer) clearTimeout(timer);
  retryTimers.delete(key);
}
const isForbidden = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false;
  const response = error as { code?: unknown; response?: { status?: number } };
  return response.code === 403 || response.response?.status === 403;
};
function keyFor(bookId: number) {
  const session = `${accountSession.getStorageKey()}:${accountSession.getVersion()}`;
  if (runtimeSession !== session) {
    retryTimers.forEach(timer => clearTimeout(timer));
    retryTimers.clear();
    retryAttempts.clear();
    permissionPauses.clear();
    foregroundChecks.clear();
    runtimeSession = session;
  }
  return `${session}:${bookId}`;
}

function retryLater(bookId: number) {
  const key = keyFor(bookId);
  if (retryTimers.has(key) || permissionPauses.has(key) || offline() || accountSession.isSwitching()) return;
  const attempt = retryAttempts.get(key) ?? 0;
  const version = accountSession.getVersion();
  const accountKey = accountSession.getStorageKey();
  retryAttempts.set(key, attempt + 1);
  const timer = setTimeout(() => {
    retryTimers.delete(key);
    if (version !== accountSession.getVersion() || accountKey !== accountSession.getStorageKey()) return;
    requestSync?.(bookId, false);
  }, retryDelays[Math.min(attempt, retryDelays.length - 1)]);
  retryTimers.set(key, timer);
}

export async function syncLearningRecords(bookId: number, options: StudySyncOptions = {}): Promise<StudySyncResult> {
  const key = keyFor(bookId);
  if (options.userInitiated) {
    permissionPauses.delete(key);
    clearRetry(key);
    retryAttempts.delete(key);
  }
  const existing = inflight.get(key);
  if (existing) return existing;
  const version = accountSession.getVersion();
  const accountKey = accountSession.getStorageKey();
  const assertCurrent = () => {
    accountSession.assertCurrent(version);
    if (accountSession.getStorageKey() !== accountKey) throw new Error('账号会话已变化');
  };
  const ownsLease = async () => {
    const owns = await studyRecordStore.ownsLease(bookId, ownerId);
    assertCurrent();
    return owns;
  };
  const task = (async (): Promise<StudySyncResult> => {
    await studyRecordStore.initialize();
    assertCurrent();
    await studyRecordStore.refresh();
    assertCurrent();
    await studyRecordStore.normalizeDay(bookId);
    assertCurrent();
    const result: StudySyncResult = { upload: 'pending', download: 'pending', pendingCount: 0, needsFullPull: true, errors: [] };
    const finish = () => {
      result.pendingCount = studyRecordStore.getPendingDoneRecords(bookId).length;
      result.needsFullPull = studyRecordStore.getSyncMeta(bookId).needsFullPull;
      if (result.pendingCount === 0 && result.upload !== 'failed' && result.upload !== 'busy') result.upload = 'synced';
      return result;
    };
    const pauseForPermission = (error: unknown) => {
      if (!isForbidden(error)) return;
      permissionPauses.set(key, error);
      clearRetry(key);
      retryAttempts.delete(key);
      result.pauseReason = 'permission';
      result.upload = 'failed';
    };
    if (permissionPauses.has(key)) {
      result.pauseReason = 'permission';
      result.upload = 'failed';
      result.errors.push(permissionPauses.get(key));
      return finish();
    }
    if ((!options.allowDuringAccountSwitch && accountSession.isSwitching()) || offline()) return finish();
    const acquired = await studyRecordStore.acquireLease(bookId, ownerId);
    assertCurrent();
    if (!acquired) {
      result.upload = 'busy';
      retryLater(bookId);
      return finish();
    }
    const heartbeat = setInterval(() => {
      if (version === accountSession.getVersion() && accountKey === accountSession.getStorageKey()) {
        void studyRecordStore.renewLease(bookId, ownerId).catch(() => {});
      }
    }, 5000);
    try {
      assertCurrent();
      const pull = async (force: boolean) => {
        try {
          const before = await studyService.getStudySyncMeta(bookId);
          assertCurrent();
          const knownBefore = before.versionKnown ?? before.remoteSyncVer > 0;
          const meta = studyRecordStore.getSyncMeta(bookId);
          await studyRecordStore.updateSyncMeta(bookId, { remoteSyncVer: before.remoteSyncVer });
          assertCurrent();
          if (force || meta.needsFullPull || !knownBefore || meta.lastPulledVersion !== before.remoteSyncVer) {
            const words = await studyService.getLearnedWords(bookId);
            assertCurrent();
            if (!Array.isArray(words)) throw new Error('学习记录响应格式异常');
            if (!await ownsLease()) throw new Error('同步租约已失效');
            await studyRecordStore.mergeRemoteLearnedWords(bookId, words);
            assertCurrent();
            await studyRecordStore.updateSyncMeta(bookId, { lastPulledAt: Date.now(), needsFullPull: true, lastDownloadError: null });
            assertCurrent();
            const after = await studyService.getStudySyncMeta(bookId);
            assertCurrent();
            if (!await ownsLease()) throw new Error('同步租约已失效');
            const knownAfter = after.versionKnown ?? after.remoteSyncVer > 0;
            const stable = knownBefore && knownAfter && before.remoteSyncVer === after.remoteSyncVer;
            const pending = studyRecordStore.getPendingDoneRecords(bookId).length > 0;
            await studyRecordStore.updateSyncMeta(bookId, {
              remoteSyncVer: after.remoteSyncVer,
              ...(stable ? { lastPulledVersion: after.remoteSyncVer } : {}),
              needsFullPull: !stable || pending,
              lastDownloadError: null,
              ...(stable ? { lastSuccessfulSyncAt: Date.now() } : {}),
            });
            assertCurrent();
            result.download = stable && !pending ? 'synced' : 'pending';
          } else {
            result.download = 'synced';
          }
        } catch (error) {
          assertCurrent();
          await studyRecordStore.updateSyncMeta(bookId, { needsFullPull: true, lastDownloadError: error instanceof Error ? error.message : String(error) });
          assertCurrent();
          result.download = 'failed';
          result.errors.push(error);
          pauseForPermission(error);
        }
      };
      // Reconcile other devices before changing the server's shared timestamp.
      if (!options.allowDuringAccountSwitch) await pull(Boolean(options.forcePull));
      if (result.pauseReason) return finish();
      let uploaded = false;
      while (true) {
        assertCurrent();
        if (!await ownsLease()) {
          result.upload = 'busy';
          break;
        }
        const batch = await studyRecordStore.freezeBatch(bookId, 800, ownerId);
        assertCurrent();
        if (!batch) break;
        await studyRecordStore.updateSyncMeta(bookId, { lastUploadAttemptAt: Date.now(), lastUploadError: null });
        assertCurrent();
        if (!await ownsLease()) {
          result.upload = 'busy';
          break;
        }
        try {
          const response = await studyService.updateDoneData(batch.records.map(item => item.doneRecord), bookId, options.allowDuringAccountSwitch);
          assertCurrent();
          if (response.resultCode !== 0) throw new Error(`updateDoneData returned ${response.resultCode}`);
          if (!await studyRecordStore.ackBatch(bookId, batch.batchId, response.syncVersion, ownerId)) {
            result.upload = 'busy';
            break;
          }
          assertCurrent();
          uploaded = true;
        } catch (error) {
          assertCurrent();
          await studyRecordStore.updateSyncMeta(bookId, {
            lastUploadError: error instanceof Error ? error.message : String(error), needsFullPull: true,
          });
          assertCurrent();
          result.upload = 'failed';
          result.errors.push(error);
          pauseForPermission(error);
          break;
        }
      }
      if (uploaded && !result.pauseReason && !options.allowDuringAccountSwitch) await pull(true);
      assertCurrent();
      finish();
      if (result.errors.length || result.pendingCount || result.needsFullPull) retryLater(bookId);
      else {
        clearRetry(key);
        retryAttempts.delete(key);
      }
      return result;
    } finally {
      clearInterval(heartbeat);
      // Releasing an old owner's lease cannot release a newer owner's lease.
      if (version === accountSession.getVersion() && accountKey === accountSession.getStorageKey()) await studyRecordStore.releaseLease(bookId, ownerId);
    }
  })().finally(() => {
    if (inflight.get(key) === task) inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}

export async function waitForLearningSyncs() {
  await Promise.allSettled([...inflight.values()]);
}

export function installStudySyncLifecycle(onSync: (bookId: number, forcePull?: boolean) => void, currentBookId: () => number | undefined) {
  requestSync = onSync;
  const sessionVersion = accountSession.getVersion();
  const currentSession = () => sessionVersion === accountSession.getVersion() && !accountSession.isSwitching();
  let queued = false;
  const automatic = () => {
    if (queued || offline() || !currentSession()) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!currentSession() || offline()) return;
      for (const bookId of Object.keys(studyRecordStore.getSnapshot().books).map(Number)) {
        const key = keyFor(bookId);
        const topics = new Set(studyRecordStore.getPendingDoneRecords(bookId).map(item => item.topicId));
        if (!permissionPauses.has(key) && !inflight.has(key) && !retryTimers.has(key) && topics.size >= 50) onSync(bookId);
      }
    });
  };
  const wake = (online: boolean) => {
    if (!currentSession() || offline()) return;
    const ids = new Set(Object.keys(studyRecordStore.getSnapshot().books).map(Number)
      .filter(id => studyRecordStore.getPendingDoneRecords(id).length > 0));
    const current = currentBookId();
    if (current) ids.add(current);
    ids.forEach(bookId => {
      const key = keyFor(bookId);
      if (permissionPauses.has(key) || inflight.has(key)) return;
      const pending = studyRecordStore.getPendingDoneRecords(bookId).length > 0;
      if (online) {
        clearRetry(key);
        retryAttempts.delete(key);
      } else {
        if (pending && retryTimers.has(key)) return;
        const lastCheck = foregroundChecks.get(key);
        if (!pending && lastCheck !== undefined && Date.now() - lastCheck < 60000) return;
      }
      foregroundChecks.set(key, Date.now());
      onSync(bookId, false);
    });
  };
  const online = () => wake(true);
  const visible = () => { if (document.visibilityState === 'visible') wake(false); };
  const unsubscribe = studyRecordStore.subscribe(automatic);
  window.addEventListener('online', online);
  document.addEventListener('visibilitychange', visible);
  return () => {
    unsubscribe();
    window.removeEventListener('online', online);
    document.removeEventListener('visibilitychange', visible);
    if (requestSync === onSync) requestSync = null;
    retryTimers.forEach(timer => clearTimeout(timer));
    retryTimers.clear();
    retryAttempts.clear();
    foregroundChecks.clear();
    permissionPauses.clear();
  };
}
