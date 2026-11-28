import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

class ControlledStorage implements Storage {
  private values = new Map<string, string>();
  private studyStorageFailures = 0;

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === 'study-storage' && this.studyStorageFailures > 0) {
      this.studyStorageFailures -= 1;
      const error = new Error('quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.values.set(key, value);
  }
  seed(key: string, value: string) { this.values.set(key, value); }
  failNextStudyStorageWrites(count: number) { this.studyStorageFailures = count; }
}

const book = {
  id: 10, name: '测试词书', total_words_count: 100, is_word_course: false,
  group_count: 10, book_flag: 0, img: '', desc: '',
};
const plan = {
  book_id: 10, learned_words_count: 3, group_id: 1,
  daily_plan_count: 5, review_plan_count: 2,
};
const statistics = {
  failMap: { 1: 1 }, usedTimeMap: { 1: 1000 }, totalTime: 1000,
  words: [{ topic_id: 1, word: 'word', mean_cn: '单词', accent: '' }],
  updateTime: Date.now(),
};

function installStorage(storage: Storage): void {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}

async function loadStudyStore() {
  const { useStudyStore } = await import('./studyStore');
  await vi.waitFor(() => expect(useStudyStore.persist.hasHydrated()).toBe(true));
  return useStudyStore;
}

describe('current study metadata persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  });
  afterEach(async () => {
    const { closeStudyDatabase } = await import('../services/study/database');
    await closeStudyDatabase();
    vi.restoreAllMocks();
  });

  it('restores only current-format metadata and recomputes learning state', async () => {
    const storage = new ControlledStorage();
    storage.seed('study-storage', JSON.stringify({
      version: 1,
      state: {
        currentBook: book, studyPlan: plan, studyPlans: [plan],
        lastStudyStatistics: statistics, lastReviewStatistics: statistics,
        wordList: [{ topic_id: 1 }], wordListBookId: 10,
        learnRecords: { 1: { topicId: 1 } }, preparedBookId: 10,
        homeState: { unlearnedWords: [{ topic_id: 1 }] },
      },
    }));
    installStorage(storage);

    const useStudyStore = await loadStudyStore();

    expect(useStudyStore.getState()).toMatchObject({
      currentBook: book, studyPlan: plan, studyPlans: [plan],
      lastStudyStatistics: statistics, lastReviewStatistics: statistics,
      wordList: [], wordListBookId: null, learnRecords: {}, preparedBookId: null,
    });
    expect(useStudyStore.getState().homeState.unlearnedWords).toEqual([]);
    useStudyStore.setState({ preparedBookId: 10 });
    expect(JSON.parse(storage.getItem('study-storage') ?? '{}')).toEqual({
      version: 1,
      state: {
        currentBook: book, studyPlan: plan, studyPlans: [plan],
        lastStudyStatistics: statistics, lastReviewStatistics: statistics,
      },
    });
  });

  it('ignores old metadata, records and malformed drafts without affecting login or user wordbooks', async () => {
    const storage = new ControlledStorage();
    storage.seed('study-storage', JSON.stringify({ version: 0, state: {
      currentBook: book, studyPlan: plan, studyPlans: [plan],
      lastStudyStatistics: statistics, lastReviewStatistics: statistics,
    } }));
    storage.seed('study-record-store', JSON.stringify({ version: 2, books: { 10: { totalRecords: { 1: { topicId: 1 } } } } }));
    storage.seed('study-session-store', '{damaged old draft');
    storage.seed('study-indexeddb-migrated', '3');
    storage.seed('auth-storage', JSON.stringify({ state: { token: 'token', accountStorageId: 'account' } }));
    storage.seed('settings-storage', 'settings');
    storage.seed('wordbook-storage', 'custom-books');
    installStorage(storage);

    const useStudyStore = await loadStudyStore();
    const { studyRecordStore } = await import('../services/study/recordStore');
    const { getStudyAccount } = await import('../services/study/database');
    await studyRecordStore.initialize();

    expect(useStudyStore.getState()).toMatchObject({
      currentBook: null, studyPlan: null, studyPlans: [],
      lastStudyStatistics: null, lastReviewStatistics: null, preparedBookId: null,
    });
    expect(studyRecordStore.getAllRecords(10)).toEqual([]);
    expect(getStudyAccount().drafts).toEqual({});
    expect(storage.getItem('study-record-store')).toBeNull();
    expect(storage.getItem('study-session-store')).toBeNull();
    expect(storage.getItem('study-indexeddb-migrated')).toBeNull();
    expect(JSON.parse(storage.getItem('auth-storage') ?? '{}').state.token).toBe('token');
    expect(storage.getItem('settings-storage')).toBe('settings');
    expect(storage.getItem('wordbook-storage')).toBe('custom-books');
  });

  it.each([
    '{bad json',
    JSON.stringify({ version: 1, state: { currentBook: { id: 'wrong' }, studyPlan: { book_id: 'wrong' }, studyPlans: [] } }),
  ])('starts with defaults when current metadata is invalid: %s', async (raw) => {
    const storage = new ControlledStorage();
    storage.seed('study-storage', raw);
    installStorage(storage);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const useStudyStore = await loadStudyStore();

    expect(useStudyStore.getState()).toMatchObject({
      currentBook: null, studyPlan: null, studyPlans: [],
      lastStudyStatistics: null, lastReviewStatistics: null, preparedBookId: null,
    });
  });

  it('keeps learning initialization available when optional metadata cache writes fail', async () => {
    const storage = new ControlledStorage();
    storage.failNextStudyStorageWrites(100);
    installStorage(storage);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [{ useStudyStore }, { studyService }] = await Promise.all([
      import('./studyStore'), import('../services/studyService'),
    ]);
    await vi.waitFor(() => expect(useStudyStore.persist.hasHydrated()).toBe(true));
    vi.spyOn(studyService, 'getStudySyncMeta').mockResolvedValue({ bookId: 10, remoteSyncVer: 1, versionKnown: true });
    vi.spyOn(studyService, 'getLearnedWords').mockResolvedValue([]);

    expect(() => useStudyStore.setState({
      currentBook: book, studyPlan: plan, studyPlans: [plan],
      wordList: [{ topic_id: 1, word_level_id: 1, tag_id: 1, options: [] }], wordListBookId: 10,
    })).not.toThrow();
    await expect(useStudyStore.getState().syncCurrentBookState(10)).resolves.toMatchObject({ download: 'synced' });

    expect(useStudyStore.getState().preparedBookId).toBe(10);
    expect(useStudyStore.getState().homeState.unlearnedWords).toHaveLength(1);
    expect(storage.getItem('study-storage')).toBeNull();
  });
});
