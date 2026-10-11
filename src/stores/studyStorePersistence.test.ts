import { beforeEach, describe, expect, it, vi } from 'vitest';

class ControlledStorage implements Storage {
  private values = new Map<string, string>();
  private studyStorageFailures = 0;

  studyStorageSetAttempts = 0;
  studyStorageRemoveAttempts = 0;

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    if (key === 'study-storage') {
      this.studyStorageRemoveAttempts += 1;
    }
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    if (key === 'study-storage') {
      this.studyStorageSetAttempts += 1;
      if (this.studyStorageFailures > 0) {
        this.studyStorageFailures -= 1;
        const error = new Error('quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }
    }
    this.values.set(key, value);
  }

  seed(key: string, value: string) {
    this.values.set(key, value);
  }

  failNextStudyStorageWrites(count: number) {
    this.studyStorageFailures = count;
  }
}

const book = {
  id: 10,
  name: '测试词书',
  total_words_count: 100,
  is_word_course: false,
  group_count: 10,
  book_flag: 0,
  img: '',
  desc: '',
};

const plan = {
  book_id: 10,
  learned_words_count: 3,
  group_id: 1,
  daily_plan_count: 5,
  review_plan_count: 2,
};

const statistics = {
  failMap: { 1: 1 },
  usedTimeMap: { 1: 1000 },
  totalTime: 1000,
  words: [{ topic_id: 1, word: 'word', mean_cn: '单词', accent: '' }],
  updateTime: Date.now(),
};

function installStorage(storage: Storage): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

async function loadStudyStore() {
  const module = await import('./studyStore');
  await vi.waitFor(() => expect(module.useStudyStore.persist.hasHydrated()).toBe(true));
  return module.useStudyStore;
}

describe('studyStore persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('migrates legacy state to the lightweight whitelist without touching other stores', async () => {
    const storage = new ControlledStorage();
    const recordSnapshot = JSON.stringify({ version: 2, books: { 10: { marker: true } } });
    const sessionSnapshot = JSON.stringify({ version: 1, drafts: { 'learn:10': { marker: true } } });
    storage.seed('study-record-store', recordSnapshot);
    storage.seed('study-session-store', sessionSnapshot);
    storage.seed('study-storage', JSON.stringify({
      version: 0,
      state: {
        currentBook: book,
        studyPlan: plan,
        studyPlans: [plan],
        lastStudyStatistics: statistics,
        lastReviewStatistics: statistics,
        wordList: Array.from({ length: 1000 }, (_, topic_id) => ({
          topic_id,
          word_level_id: 1,
          tag_id: 1,
          options: [],
        })),
        wordListBookId: 10,
        learnRecords: { 1: { topicId: 1 } },
        homeState: { unlearnedWords: Array.from({ length: 1000 }, () => ({ topic_id: 1 })) },
        syncedBookId: 10,
      },
    }));
    installStorage(storage);

    const useStudyStore = await loadStudyStore();
    const persisted = JSON.parse(storage.getItem('study-storage') ?? '{}');

    expect(persisted.version).toBe(1);
    expect(persisted.state).toEqual({
      currentBook: book,
      studyPlan: plan,
      studyPlans: [plan],
      lastStudyStatistics: statistics,
      lastReviewStatistics: statistics,
    });
    expect(useStudyStore.getState()).toMatchObject({
      currentBook: book,
      studyPlan: plan,
      studyPlans: [plan],
      wordList: [],
      wordListBookId: null,
      learnRecords: {},
      syncedBookId: null,
    });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual([]);
    expect(storage.getItem('study-record-store')).toBe(recordSnapshot);
    expect(storage.getItem('study-session-store')).toBe(sessionSnapshot);
  });

  it('falls back to defaults for malformed or invalid legacy cache data', async () => {
    const malformedStorage = new ControlledStorage();
    malformedStorage.seed('study-storage', '{bad json');
    installStorage(malformedStorage);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    let useStudyStore = await loadStudyStore();
    expect(useStudyStore.getState().currentBook).toBeNull();
    expect(malformedStorage.getItem('study-storage')).toBeNull();

    vi.resetModules();
    const invalidStorage = new ControlledStorage();
    invalidStorage.seed('study-storage', JSON.stringify({
      version: 0,
      state: {
        currentBook: { id: 'wrong' },
        studyPlan: { book_id: 'wrong' },
        studyPlans: [{ book_id: 'wrong' }],
        lastStudyStatistics: { words: 'wrong' },
      },
    }));
    installStorage(invalidStorage);

    useStudyStore = await loadStudyStore();
    expect(useStudyStore.getState()).toMatchObject({
      currentBook: null,
      studyPlan: null,
      studyPlans: [],
      lastStudyStatistics: null,
      lastReviewStatistics: null,
    });
  });

  it('removes an oversized legacy cache and retries the compact migration once', async () => {
    const storage = new ControlledStorage();
    storage.seed('study-storage', JSON.stringify({
      version: 0,
      state: {
        currentBook: book,
        studyPlan: plan,
        studyPlans: [plan],
        wordList: Array.from({ length: 1000 }, () => ({ topic_id: 1 })),
      },
    }));
    storage.failNextStudyStorageWrites(1);
    installStorage(storage);

    const useStudyStore = await loadStudyStore();
    const persisted = JSON.parse(storage.getItem('study-storage') ?? '{}');

    expect(storage.studyStorageSetAttempts).toBe(2);
    expect(storage.studyStorageRemoveAttempts).toBe(1);
    expect(persisted.version).toBe(1);
    expect(persisted.state).toEqual({
      currentBook: book,
      studyPlan: plan,
      studyPlans: [plan],
      lastStudyStatistics: null,
      lastReviewStatistics: null,
    });
    expect(useStudyStore.getState().currentBook).toEqual(book);
  });

  it('keeps in-memory synchronization working when study cache writes keep failing', async () => {
    const storage = new ControlledStorage();
    storage.failNextStudyStorageWrites(100);
    installStorage(storage);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const [{ useStudyStore }, { studyService }] = await Promise.all([
      import('./studyStore'),
      import('../services/studyService'),
    ]);
    await vi.waitFor(() => expect(useStudyStore.persist.hasHydrated()).toBe(true));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage },
    });
    vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue({
      bookId: 10,
      remoteSyncVer: 0,
    });

    expect(() => useStudyStore.setState({
      currentBook: book,
      studyPlan: plan,
      studyPlans: [plan],
      wordList: [{ topic_id: 1, word_level_id: 1, tag_id: 1, options: [] }],
      wordListBookId: 10,
    })).not.toThrow();
    await expect(useStudyStore.getState().syncCurrentBookState(10)).resolves.toBeUndefined();

    expect(useStudyStore.getState().syncedBookId).toBe(10);
    expect(useStudyStore.getState().homeState.unlearnedWords).toHaveLength(1);
    expect(storage.getItem('study-storage')).toBeNull();
  });
});
