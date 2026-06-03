import type { UserLearnedWordInfo } from '../../types';
import {
  createEmptyBookStateSnapshot,
  createEmptySyncMeta,
  createRecordFromLearnedWordInfo,
  createRecordMap,
  type PendingDoneRecord,
  type RemoteLearnRecordMergeResult,
  type StudyBookStateSnapshot,
  type StudyRecordStoreSnapshot,
  type StudyRecordStoreSnapshotV1,
  type StudySyncMeta,
  type TopicLearnRecord,
} from '../../types/studyRecord';

const STORAGE_KEY = 'study-record-store';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createEmptySnapshot(): StudyRecordStoreSnapshot {
  return {
    version: 2,
    books: {},
  };
}

function normalizeBookSnapshot(
  partialBookSnapshot: Partial<StudyBookStateSnapshot> | undefined,
): StudyBookStateSnapshot {
  return createEmptyBookStateSnapshot({
    totalRecords: partialBookSnapshot?.totalRecords ?? {},
    pendingDoneQueue: partialBookSnapshot?.pendingDoneQueue ?? [],
    syncMeta: createEmptySyncMeta(partialBookSnapshot?.syncMeta ?? {}),
  });
}

function migrateFromV1(snapshotV1: StudyRecordStoreSnapshotV1): StudyRecordStoreSnapshot {
  const books = Object.entries(snapshotV1.books ?? {}).reduce<
    StudyRecordStoreSnapshot['books']
  >((acc, [bookId, records]) => {
    acc[Number(bookId)] = createEmptyBookStateSnapshot({
      totalRecords: records ?? {},
    });
    return acc;
  }, {});

  return {
    version: 2,
    books,
  };
}

function readSnapshot(): StudyRecordStoreSnapshot {
  if (!canUseLocalStorage()) {
    return createEmptySnapshot();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptySnapshot();
  }

  try {
    const parsed = JSON.parse(raw) as
      | Partial<StudyRecordStoreSnapshot>
      | Partial<StudyRecordStoreSnapshotV1>;

    if (parsed.version === 2 && parsed.books) {
      const books = Object.entries(parsed.books).reduce<
        StudyRecordStoreSnapshot['books']
      >((acc, [bookId, bookSnapshot]) => {
        acc[Number(bookId)] = normalizeBookSnapshot(bookSnapshot);
        return acc;
      }, {});

      return {
        version: 2,
        books,
      };
    }

    if (parsed.version === 1 && parsed.books) {
      const migrated = migrateFromV1(parsed as StudyRecordStoreSnapshotV1);
      writeSnapshot(migrated);
      return migrated;
    }

    return createEmptySnapshot();
  } catch (error) {
    console.error('Failed to parse study record store snapshot:', error);
    return createEmptySnapshot();
  }
}

function writeSnapshot(snapshot: StudyRecordStoreSnapshot): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function getBookSnapshot(
  snapshot: StudyRecordStoreSnapshot,
  bookId: number,
): StudyBookStateSnapshot {
  return snapshot.books[bookId] ?? createEmptyBookStateSnapshot();
}

function updateBookSnapshot(
  snapshot: StudyRecordStoreSnapshot,
  bookId: number,
  bookSnapshot: StudyBookStateSnapshot,
): StudyRecordStoreSnapshot {
  return {
    ...snapshot,
    books: {
      ...snapshot.books,
      [bookId]: bookSnapshot,
    },
  };
}

export const studyRecordStore = {
  getSnapshot(): StudyRecordStoreSnapshot {
    return readSnapshot();
  },

  getAllRecords(bookId: number): TopicLearnRecord[] {
    const snapshot = readSnapshot();
    return Object.values(getBookSnapshot(snapshot, bookId).totalRecords);
  },

  getRecord(bookId: number, topicId: number): TopicLearnRecord | undefined {
    const snapshot = readSnapshot();
    return getBookSnapshot(snapshot, bookId).totalRecords[topicId];
  },

  getPendingDoneRecords(bookId: number): PendingDoneRecord[] {
    const snapshot = readSnapshot();
    return getBookSnapshot(snapshot, bookId).pendingDoneQueue;
  },

  getSyncMeta(bookId: number): StudySyncMeta {
    const snapshot = readSnapshot();
    return getBookSnapshot(snapshot, bookId).syncMeta;
  },

  updateSyncMeta(bookId: number, patch: Partial<StudySyncMeta>): StudySyncMeta {
    const snapshot = readSnapshot();
    const currentBookSnapshot = getBookSnapshot(snapshot, bookId);
    const nextSyncMeta = {
      ...currentBookSnapshot.syncMeta,
      ...patch,
    };

    writeSnapshot(
      updateBookSnapshot(snapshot, bookId, {
        ...currentBookSnapshot,
        syncMeta: nextSyncMeta,
      }),
    );

    return nextSyncMeta;
  },

  upsertRecord(bookId: number, record: TopicLearnRecord): TopicLearnRecord {
    const snapshot = readSnapshot();
    const currentBookSnapshot = getBookSnapshot(snapshot, bookId);
    const nextBooksSnapshot = updateBookSnapshot(snapshot, bookId, {
      ...currentBookSnapshot,
      totalRecords: {
        ...currentBookSnapshot.totalRecords,
        [record.topicId]: record,
      },
    });
    writeSnapshot(nextBooksSnapshot);
    return record;
  },

  upsertRecords(bookId: number, records: TopicLearnRecord[]): TopicLearnRecord[] {
    const snapshot = readSnapshot();
    const currentBookSnapshot = getBookSnapshot(snapshot, bookId);
    const nextRecordMap = {
      ...currentBookSnapshot.totalRecords,
      ...createRecordMap(records),
    };

    writeSnapshot(
      updateBookSnapshot(snapshot, bookId, {
        ...currentBookSnapshot,
        totalRecords: nextRecordMap,
      }),
    );

    return records;
  },

  queuePendingDoneRecords(
    bookId: number,
    pendingRecords: PendingDoneRecord[],
  ): PendingDoneRecord[] {
    if (!pendingRecords.length) {
      return [];
    }

    const snapshot = readSnapshot();
    const currentBookSnapshot = getBookSnapshot(snapshot, bookId);
    const queueByTopicId = new Map<number, PendingDoneRecord>(
      currentBookSnapshot.pendingDoneQueue.map((item) => [item.topicId, item]),
    );

    pendingRecords.forEach((item) => {
      queueByTopicId.set(item.topicId, item);
    });

    const nextPendingDoneQueue = Array.from(queueByTopicId.values()).sort(
      (a, b) => a.queuedAt - b.queuedAt,
    );

    writeSnapshot(
      updateBookSnapshot(snapshot, bookId, {
        ...currentBookSnapshot,
        pendingDoneQueue: nextPendingDoneQueue,
      }),
    );

    return nextPendingDoneQueue;
  },

  clearPendingDoneRecords(bookId: number, requestKeys: string[]): void {
    if (!requestKeys.length) {
      return;
    }

    const requestKeySet = new Set(requestKeys);
    const snapshot = readSnapshot();
    const currentBookSnapshot = getBookSnapshot(snapshot, bookId);
    const nextPendingDoneQueue = currentBookSnapshot.pendingDoneQueue.filter(
      (item) => !requestKeySet.has(item.requestKey),
    );

    writeSnapshot(
      updateBookSnapshot(snapshot, bookId, {
        ...currentBookSnapshot,
        pendingDoneQueue: nextPendingDoneQueue,
      }),
    );
  },

  mergeRemoteLearnedWords(
    bookId: number,
    remoteWords: UserLearnedWordInfo[],
  ): RemoteLearnRecordMergeResult {
    const snapshot = readSnapshot();
    const currentBookSnapshot = getBookSnapshot(snapshot, bookId);
    const currentBookRecords = currentBookSnapshot.totalRecords;
    const pendingTopicIds = new Set(
      currentBookSnapshot.pendingDoneQueue.map((item) => item.topicId),
    );
    const mergedRecords = remoteWords.flatMap((remoteWord) => {
      if (pendingTopicIds.has(remoteWord.topic_id)) {
        return [];
      }

      const existingRecord = currentBookRecords[remoteWord.topic_id];
      const nextRecord = createRecordFromLearnedWordInfo(bookId, remoteWord);

      if (!existingRecord) {
        return [nextRecord];
      }

      return [
        {
          ...existingRecord,
          ...nextRecord,
          createdAt: existingRecord.createdAt || nextRecord.createdAt,
        },
      ];
    });

    const mergedMap = {
      ...currentBookRecords,
      ...createRecordMap(mergedRecords),
    };

    writeSnapshot(
      updateBookSnapshot(snapshot, bookId, {
        ...currentBookSnapshot,
        totalRecords: mergedMap,
      }),
    );

    return {
      mergedRecords,
      touchedTopicIds: mergedRecords.map((record) => record.topicId),
    };
  },

  clearRecords(bookId: number): void {
    const snapshot = readSnapshot();
    const nextBooks = { ...snapshot.books };
    delete nextBooks[bookId];
    writeSnapshot({
      ...snapshot,
      books: nextBooks,
    });
  },

  clearAll(): void {
    writeSnapshot(createEmptySnapshot());
  },
};
