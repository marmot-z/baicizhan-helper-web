import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { accountSession, AccountSessionChangedError } from '../services/accountSession';
import type { UserBookBasicInfo, SelectBookPlanInfo, UserRoadMapElementV2 } from '../types';
import { studyService } from '../services/studyService';
import type { StudyStatistcs } from '../services/study/types';
import { syncLearningRecords, waitForLearningSyncs, type StudySyncResult, type StudySyncOptions } from '../services/study/syncEngine';
import { calculateHomeState } from '../services/study/homeStateCalculator';
import { studyRecordStore } from '../services/study/recordStore';
import {
  createEmptyHomeState,
  createRecordMap,
  type StudyHomeState,
  type TopicLearnRecordMap,
} from '../types/studyRecord';

const inflightBookSyncs = new Map<number, Promise<StudySyncResult>>();
const STUDY_STORAGE_KEY = 'study-storage';
const STUDY_STORAGE_VERSION = 1;

type PersistedStudyStateV1 = Pick<
  StudyState,
  | 'currentBook'
  | 'studyPlan'
  | 'studyPlans'
  | 'lastStudyStatistics'
  | 'lastReviewStatistics'
>;

export async function waitForStudySyncs(): Promise<void> {
  await Promise.allSettled([...inflightBookSyncs.values()]);
  await waitForLearningSyncs();
}

interface StudyState {
  currentBook: UserBookBasicInfo | null;
  studyPlan: SelectBookPlanInfo | null;
  studyPlans: SelectBookPlanInfo[];
  wordList: UserRoadMapElementV2[];
  wordListBookId: number | null;
  learnRecords: TopicLearnRecordMap;
  homeState: StudyHomeState;
  syncingBookId: number | null;
  preparedBookId: number | null;
  planLoadError: string | null;
  studyStateError: string | null;
  lastStudyStatistics: StudyStatistcs | null;
  lastReviewStatistics: StudyStatistcs | null;
  setCurrentBook: (book: UserBookBasicInfo) => void;
  setStudyPlan: (plan: SelectBookPlanInfo) => void;
  setWordList: (words: UserRoadMapElementV2[]) => void;
  setLastStudyStatistics: (statistics: StudyStatistcs) => void;
  setLastReviewStatistics: (statistics: StudyStatistcs) => void;
  loadLocalLearnRecords: (bookId: number) => TopicLearnRecordMap;
  recomputeHomeState: (bookId: number) => StudyHomeState;
  syncCurrentBookState: (bookId?: number, options?: StudySyncOptions) => Promise<StudySyncResult | undefined>;
  syncResults: Record<number, StudySyncResult>;
  fetchStudyData: () => Promise<void>;
  refreshStudyPlans: () => Promise<SelectBookPlanInfo[]>;
  switchStudyBook: (plan: SelectBookPlanInfo) => Promise<void>;
  refreshStudyDataForBook: (book: UserBookBasicInfo) => Promise<void>;
  clearStudyData: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBook(value: unknown): value is UserBookBasicInfo {
  return (
    isObject(value) &&
    isFiniteNumber(value.id) &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.total_words_count)
  );
}

function isStudyPlan(value: unknown): value is SelectBookPlanInfo {
  return (
    isObject(value) &&
    isFiniteNumber(value.book_id) &&
    isFiniteNumber(value.learned_words_count) &&
    isFiniteNumber(value.daily_plan_count) &&
    isFiniteNumber(value.review_plan_count)
  );
}

function isStudyStatistics(value: unknown): value is StudyStatistcs {
  return (
    isObject(value) &&
    isObject(value.failMap) &&
    isObject(value.usedTimeMap) &&
    isFiniteNumber(value.totalTime) &&
    Array.isArray(value.words) &&
    isFiniteNumber(value.updateTime)
  );
}

function normalizePersistedStudyState(value: unknown): PersistedStudyStateV1 {
  const persisted = isObject(value) ? value : {};
  const studyPlans = Array.isArray(persisted.studyPlans)
    ? persisted.studyPlans.filter(isStudyPlan)
    : [];

  return {
    currentBook: isBook(persisted.currentBook) ? persisted.currentBook : null,
    studyPlan: isStudyPlan(persisted.studyPlan) ? persisted.studyPlan : null,
    studyPlans,
    lastStudyStatistics: isStudyStatistics(persisted.lastStudyStatistics)
      ? persisted.lastStudyStatistics
      : null,
    lastReviewStatistics: isStudyStatistics(persisted.lastReviewStatistics)
      ? persisted.lastReviewStatistics
      : null,
  };
}

function isQuotaExceededError(error: unknown): boolean {
  if (!isObject(error)) {
    return false;
  }

  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

let hasWarnedAboutStudyStorage = false;

function warnAboutStudyStorage(message: string, error: unknown): void {
  if (hasWarnedAboutStudyStorage) {
    return;
  }
  hasWarnedAboutStudyStorage = true;
  console.warn(`[study-storage] ${message}`, error);
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch (error) {
    warnAboutStudyStorage('localStorage 不可用，将仅保留内存状态。', error);
  }
  return null;
}

function createResilientStudyStorage(): StateStorage {
  return {
    getItem: (name) => {
      const storage = getLocalStorage();
      if (!storage) {
        return null;
      }

      try {
        const raw = storage.getItem(name);
        if (raw !== null) {
          JSON.parse(raw);
        }
        return raw;
      } catch (error) {
        try {
          storage.removeItem(name);
        } catch {
          // 缓存本身可重建，清理失败时继续以内存默认值启动。
        }
        warnAboutStudyStorage('读取缓存失败，已忽略旧缓存。', error);
        return null;
      }
    },
    setItem: (name, value) => {
      const storage = getLocalStorage();
      if (!storage) {
        return;
      }

      try {
        storage.setItem(name, value);
        return;
      } catch (error) {
        if (isQuotaExceededError(error)) {
          try {
            storage.removeItem(name);
            storage.setItem(name, value);
            return;
          } catch (retryError) {
            warnAboutStudyStorage(
              '缓存空间不足，清理旧缓存后仍无法写入；学习流程将继续使用内存状态。',
              retryError,
            );
            return;
          }
        }

        warnAboutStudyStorage('写入缓存失败，学习流程将继续使用内存状态。', error);
      }
    },
    removeItem: (name) => {
      const storage = getLocalStorage();
      if (!storage) {
        return;
      }

      try {
        storage.removeItem(name);
      } catch (error) {
        warnAboutStudyStorage('清理缓存失败。', error);
      }
    },
  };
}

type StudyStoreSet = (partial: Partial<StudyState>) => void;
type StudyStoreGet = () => StudyState;

async function syncBookState(
  set: StudyStoreSet,
  get: StudyStoreGet,
  bookId: number,
  options: StudySyncOptions = {},
): Promise<StudySyncResult | undefined> {
  if (accountSession.isSwitching() && !options.allowDuringAccountSwitch) {
    throw new AccountSessionChangedError();
  }
  const version = accountSession.getVersion();
  const apply = (result: StudySyncResult) => {
    accountSession.assertCurrent(version);
    const records = createRecordMap(studyRecordStore.getAllRecords(bookId));
    const state = get();
    const active = (state.studyPlan?.book_id ?? state.currentBook?.id) === bookId;
    const ready = studyRecordStore.getSyncMeta(bookId).lastPulledAt > 0 || Object.keys(records).length > 0;
    const preparationError = ready ? null : '学习进度获取失败，请检查网络后重试';
    set({
      syncResults: { ...state.syncResults, [bookId]: result },
      ...(active ? {
        learnRecords: records,
        homeState: ready ? calculateHomeState({
          records,
          roadmap: state.wordListBookId === bookId ? state.wordList : [],
          learnPlanCount: state.studyPlan?.daily_plan_count ?? 0,
          reviewPlanCount: state.studyPlan?.review_plan_count ?? 0,
          increasedCount: 0,
        }) : createEmptyHomeState(),
        preparedBookId: ready ? bookId : null,
        studyStateError: preparationError,
      } : {}),
    });
    if (!ready) throw new Error(preparationError!);
    return result;
  };
  const existing = inflightBookSyncs.get(bookId);
  if (existing) return apply(await existing);
  const task = (async () => {
    set({ syncingBookId: bookId });
    await studyRecordStore.initialize();
    accountSession.assertCurrent(version);
    if ((get().studyPlan?.book_id ?? get().currentBook?.id) === bookId && get().wordListBookId !== bookId) {
      const roadmap = await studyService.getRoadmap(bookId);
      accountSession.assertCurrent(version);
      // Background retrying a different book must not replace the active book.
      if ((get().studyPlan?.book_id ?? get().currentBook?.id) === bookId) {
        set({ wordList: roadmap, wordListBookId: bookId });
      }
    }
    return syncLearningRecords(bookId, options);
  })().finally(() => {
    if (inflightBookSyncs.get(bookId) === task) inflightBookSyncs.delete(bookId);
    if (version === accountSession.getVersion() && get().syncingBookId === bookId) set({ syncingBookId: null });
  });
  inflightBookSyncs.set(bookId, task);
  try {
    return apply(await task);
  } catch (error) {
    accountSession.assertCurrent(version);
    if ((get().studyPlan?.book_id ?? get().currentBook?.id) === bookId) {
      set({ studyStateError: error instanceof Error ? error.message : String(error) });
    }
    throw error;
  }
}

async function hydrateStudyPlanForKnownBook(
  set: StudyStoreSet,
  get: StudyStoreGet,
  book: UserBookBasicInfo,
): Promise<void> {
  const version = accountSession.getVersion();
  const planData = await studyService.getBookPlanInfo();
  accountSession.assertCurrent(version);
  set({ studyPlans: planData ?? [] });
  if (!planData || planData.length === 0) {
    throw new Error('未获取到已保存的学习计划，请重试');
  }

  const userPlan = planData[0];
  if (userPlan.book_id !== book.id) {
    throw new Error('学习计划尚未切换到目标词书，请重试');
  }
  set({
    studyPlan: userPlan,
    currentBook: book,
  });

  const roadmapData = await studyService.getRoadmap(userPlan.book_id);
  accountSession.assertCurrent(version);
  set({ wordList: roadmapData, wordListBookId: userPlan.book_id });
  await syncBookState(set, get, userPlan.book_id);
  accountSession.assertCurrent(version);
}

async function hydrateStudyPlan(
  set: StudyStoreSet,
  get: StudyStoreGet,
  plan: SelectBookPlanInfo,
  books?: UserBookBasicInfo[],
): Promise<void> {
  const version = accountSession.getVersion();
  let matchedBook =
    get().currentBook?.id === plan.book_id ? get().currentBook : null;

  if (!matchedBook) {
    const availableBooks = books ?? (await studyService.getAllBooks()).books;
    accountSession.assertCurrent(version);
    matchedBook = availableBooks.find((book) => book.id === plan.book_id) ?? null;
  }

  set({
    studyPlan: plan,
    currentBook: matchedBook,
  });

  const roadmapData = await studyService.getRoadmap(plan.book_id);
  accountSession.assertCurrent(version);
  set({ wordList: roadmapData, wordListBookId: plan.book_id });
  await syncBookState(set, get, plan.book_id);
  accountSession.assertCurrent(version);
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      studyPlan: null,
      studyPlans: [],
      wordList: [],
      wordListBookId: null,
      learnRecords: {},
      homeState: createEmptyHomeState(),
      syncingBookId: null,
      preparedBookId: null,
      planLoadError: null,
      studyStateError: null,
      syncResults: {},
      lastStudyStatistics: null,
      lastReviewStatistics: null,

      setCurrentBook: (book: UserBookBasicInfo) => {
        set({ currentBook: book, preparedBookId: get().preparedBookId === book.id ? book.id : null, studyStateError: null });
        void get().syncCurrentBookState(book.id).catch(() => {});
      },

      setStudyPlan: (plan: SelectBookPlanInfo) => {
        set({ studyPlan: plan, preparedBookId: get().preparedBookId === plan.book_id ? plan.book_id : null, studyStateError: null });
        void get().syncCurrentBookState(plan.book_id).catch(() => {});
      },

      setWordList: (words: UserRoadMapElementV2[]) => {
        const planBookId = get().studyPlan?.book_id ?? null;
        set({ wordList: words, wordListBookId: planBookId });
      },

      setLastStudyStatistics: (statistics: StudyStatistcs) => {
        statistics.updateTime = Date.now();
        set({ lastStudyStatistics: statistics });
      },

      setLastReviewStatistics: (statistics: StudyStatistcs) => {
        statistics.updateTime = Date.now();
        set({ lastReviewStatistics: statistics });
      },

      loadLocalLearnRecords: (bookId: number) => {
        const records = createRecordMap(studyRecordStore.getAllRecords(bookId));
        set({ learnRecords: records });
        return records;
      },

      recomputeHomeState: (bookId: number) => {
        const roadmap = get().wordListBookId === bookId ? get().wordList : [];
        const currentPlan = get().studyPlan?.book_id === bookId ? get().studyPlan : null;
        const homeState = calculateHomeState({
          records: get().learnRecords,
          roadmap,
          learnPlanCount: currentPlan?.daily_plan_count ?? 0,
          reviewPlanCount: currentPlan?.review_plan_count ?? 0,
          increasedCount: 0,
        });
        set({ homeState });
        return homeState;
      },

      syncCurrentBookState: async (bookId?: number, options?: StudySyncOptions) => {
        const targetBookId = bookId ?? get().studyPlan?.book_id ?? get().currentBook?.id;
        if (!targetBookId) return;
        return syncBookState(set, get, targetBookId, options);
      },

      fetchStudyData: async () => {
        const version = accountSession.getVersion();
        set({ planLoadError: null });
        let bookId: number;
        try {
          const plans = await studyService.getBookPlanInfo();
          accountSession.assertCurrent(version);
          if (!Array.isArray(plans)) throw new Error('学习计划响应格式异常');
          set({ studyPlans: plans });
          const plan = plans[0];
          if (!plan) {
            set({ studyPlan: null, currentBook: null, wordList: [], wordListBookId: null,
              learnRecords: {}, homeState: createEmptyHomeState(), preparedBookId: null, studyStateError: null });
            return;
          }
          bookId = plan.book_id;
          if (get().studyPlan?.book_id !== bookId) {
            set({ preparedBookId: null, learnRecords: {}, homeState: createEmptyHomeState(), studyStateError: null });
          }
          set({ studyPlan: plan });
          if (get().currentBook?.id !== bookId) {
            const catalog = await studyService.getAllBooks();
            accountSession.assertCurrent(version);
            const book = catalog.books.find(item => item.id === bookId);
            if (!book) throw new Error('当前词书信息暂时不可用，请重试');
            set({ currentBook: book });
          }
          if (get().wordListBookId !== bookId) {
            const roadmap = await studyService.getRoadmap(bookId);
            accountSession.assertCurrent(version);
            set({ wordList: roadmap, wordListBookId: bookId });
          }
        } catch (error) {
          accountSession.assertCurrent(version);
          set({ planLoadError: error instanceof Error ? error.message : String(error) });
          throw error;
        }
        // Catalog and roadmap remain usable when learning progress needs a retry.
        await get().syncCurrentBookState(bookId).catch(() => {});
        accountSession.assertCurrent(version);
      },

      refreshStudyPlans: async () => {
        const version = accountSession.getVersion();
        const planData = await studyService.getBookPlanInfo();
        accountSession.assertCurrent(version);
        set({ studyPlans: planData ?? [] });
        return planData ?? [];
      },

      switchStudyBook: async (plan: SelectBookPlanInfo) => {
        const version = accountSession.getVersion();
        const previousBookId = get().studyPlan?.book_id;
        if (previousBookId && previousBookId !== plan.book_id) await syncLearningRecords(previousBookId);
        accountSession.assertCurrent(version);
        await studyService.switchSelectedBookPlan(plan);
        accountSession.assertCurrent(version);
        const [planData, booksData] = await Promise.all([
          studyService.getBookPlanInfo(),
          studyService.getAllBooks(),
        ]);
        accountSession.assertCurrent(version);
        const currentPlan = planData[0] ?? plan;

        set({ studyPlans: planData ?? [] });
        await hydrateStudyPlan(set, get, currentPlan, booksData.books);
        accountSession.assertCurrent(version);
      },

      refreshStudyDataForBook: async (book: UserBookBasicInfo) => {
        await hydrateStudyPlanForKnownBook(set, get, book);
      },

      clearStudyData: () => {
        inflightBookSyncs.clear();
        set({
          currentBook: null,
          studyPlan: null,
          studyPlans: [],
          wordList: [],
          wordListBookId: null,
          learnRecords: {},
          homeState: createEmptyHomeState(),
          syncingBookId: null,
          preparedBookId: null,
          planLoadError: null,
          studyStateError: null,
          syncResults: {},
          lastStudyStatistics: null,
          lastReviewStatistics: null,
        });
      },
    }),
    {
      name: STUDY_STORAGE_KEY,
      version: STUDY_STORAGE_VERSION,
      storage: createJSONStorage<PersistedStudyStateV1>(() =>
        createResilientStudyStorage(),
      ),
      merge: (persistedState, currentState) => {
        const persisted = normalizePersistedStudyState(persistedState);
        return {
          ...currentState,
          currentBook: persisted.currentBook,
          studyPlan: persisted.studyPlan,
          studyPlans: persisted.studyPlans,
          lastStudyStatistics: persisted.lastStudyStatistics,
          lastReviewStatistics: persisted.lastReviewStatistics,
        };
      },
      partialize: (state) => ({
        currentBook: state.currentBook,
        studyPlan: state.studyPlan,
        studyPlans: state.studyPlans,
        lastStudyStatistics: state.lastStudyStatistics,
        lastReviewStatistics: state.lastReviewStatistics,
      }),
    }
  )
);
