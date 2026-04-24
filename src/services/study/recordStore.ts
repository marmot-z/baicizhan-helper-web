import type { UserLearnedWordInfo } from '../../types';
import {
  createRecordFromLearnedWordInfo,
  createRecordMap,
  type RemoteLearnRecordMergeResult,
  type StudyRecordStoreSnapshot,
  type TopicLearnRecord,
} from '../../types/studyRecord';

const STORAGE_KEY = 'study-record-store';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createEmptySnapshot(): StudyRecordStoreSnapshot {
  return {
    version: 1,
    books: {},
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
    const parsed = JSON.parse(raw) as Partial<StudyRecordStoreSnapshot>;
    if (parsed.version !== 1 || !parsed.books) {
      return createEmptySnapshot();
    }

    return {
      version: 1,
      books: parsed.books,
    };
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
): Record<number, TopicLearnRecord> {
  return snapshot.books[bookId] ?? {};
}

export const studyRecordStore = {
  getSnapshot(): StudyRecordStoreSnapshot {
    return readSnapshot();
  },

  getAllRecords(bookId: number): TopicLearnRecord[] {
    const snapshot = readSnapshot();
    return Object.values(getBookSnapshot(snapshot, bookId));
  },

  getRecord(bookId: number, topicId: number): TopicLearnRecord | undefined {
    const snapshot = readSnapshot();
    return getBookSnapshot(snapshot, bookId)[topicId];
  },

  upsertRecord(bookId: number, record: TopicLearnRecord): TopicLearnRecord {
    const snapshot = readSnapshot();
    const nextBooks = {
      ...snapshot.books,
      [bookId]: {
        ...getBookSnapshot(snapshot, bookId),
        [record.topicId]: record,
      },
    };
    writeSnapshot({
      ...snapshot,
      books: nextBooks,
    });
    return record;
  },

  upsertRecords(bookId: number, records: TopicLearnRecord[]): TopicLearnRecord[] {
    const snapshot = readSnapshot();
    const nextRecordMap = {
      ...getBookSnapshot(snapshot, bookId),
      ...createRecordMap(records),
    };

    writeSnapshot({
      ...snapshot,
      books: {
        ...snapshot.books,
        [bookId]: nextRecordMap,
      },
    });

    return records;
  },

  mergeRemoteLearnedWords(
    bookId: number,
    remoteWords: UserLearnedWordInfo[],
  ): RemoteLearnRecordMergeResult {
    const snapshot = readSnapshot();
    const currentBookRecords = getBookSnapshot(snapshot, bookId);
    const mergedRecords = remoteWords.map((remoteWord) => {
      const existingRecord = currentBookRecords[remoteWord.topic_id];
      const nextRecord = createRecordFromLearnedWordInfo(bookId, remoteWord);

      if (!existingRecord) {
        return nextRecord;
      }

      return {
        ...existingRecord,
        ...nextRecord,
        createdAt: existingRecord.createdAt || nextRecord.createdAt,
      };
    });

    const mergedMap = {
      ...currentBookRecords,
      ...createRecordMap(mergedRecords),
    };

    writeSnapshot({
      ...snapshot,
      books: {
        ...snapshot.books,
        [bookId]: mergedMap,
      },
    });

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
