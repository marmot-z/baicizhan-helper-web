import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { UserBookBasicInfo, SelectBookPlanInfo, UserRoadMapElementV2 } from '../types';
import { studyService } from '../services/studyService';
import type { StudyStatistcs } from '../services/study/types';
import { applyDayTransition } from '../services/study/recordReducers';
import { calculateHomeState } from '../services/study/homeStateCalculator';
import { studyRecordStore } from '../services/study/recordStore';
import {
  createEmptyHomeState,
  createRecordMap,
  type StudyHomeState,
  type TopicLearnRecordMap,
} from '../types/studyRecord';

const inflightBookSyncs = new Map<number, Promise<void>>();
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

interface StudyState {
  currentBook: UserBookBasicInfo | null;
  studyPlan: SelectBookPlanInfo | null;
  studyPlans: SelectBookPlanInfo[];
  wordList: UserRoadMapElementV2[];
  wordListBookId: number | null;
  learnRecords: TopicLearnRecordMap;
  homeState: StudyHomeState;
  syncingBookId: number | null;
  syncedBookId: number | null;
  lastStudyStatistics: StudyStatistcs | null;
  lastReviewStatistics: StudyStatistcs | null;
  setCurrentBook: (book: UserBookBasicInfo) => void;
  setStudyPlan: (plan: SelectBookPlanInfo) => void;
  setWordList: (words: UserRoadMapElementV2[]) => void;
  setLastStudyStatistics: (statistics: StudyStatistcs) => void;
  setLastReviewStatistics: (statistics: StudyStatistcs) => void;
  loadLocalLearnRecords: (bookId: number) => TopicLearnRecordMap;
  recomputeHomeState: (bookId: number) => StudyHomeState;
  syncCurrentBookState: (bookId?: number) => Promise<void>;
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
): Promise<void> {
  const existingTask = inflightBookSyncs.get(bookId);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    set({ syncingBookId: bookId });

    const localRecords = studyRecordStore.getAllRecords(bookId);
    const transitionedRecords = localRecords.map((record) =>
      applyDayTransition(record),
    );
    const hasDayTransitionChanges = transitionedRecords.some(
      (record, index) => record !== localRecords[index],
    );

    if (hasDayTransitionChanges) {
      studyRecordStore.upsertRecords(bookId, transitionedRecords);
    }

    const effectiveLocalRecords = hasDayTransitionChanges
      ? transitionedRecords
      : localRecords;
    let nextRecordMap = createRecordMap(effectiveLocalRecords);
    set({ learnRecords: nextRecordMap });

    let roadmap = get().wordList;
    if (get().wordListBookId !== bookId || roadmap.length === 0) {
      roadmap = await studyService.getRoadmap(bookId);
      set({ wordList: roadmap, wordListBookId: bookId });
    }

    let pendingDoneRecords = studyRecordStore.getPendingDoneRecords(bookId);
    while (pendingDoneRecords.length > 0) {
      studyRecordStore.updateSyncMeta(bookId, {
        lastUploadAttemptAt: Date.now(),
        lastUploadError: null,
      });

      try {
        const uploadResult = await studyService.updateDoneData(
          pendingDoneRecords.map((item) => item.doneRecord),
          bookId,
        );

        if (uploadResult.resultCode < 0) {
          throw new Error(`updateDoneData returned ${uploadResult.resultCode}`);
        }

        studyRecordStore.clearPendingDoneRecords(
          bookId,
          pendingDoneRecords.map((item) => item.requestKey),
        );
        studyRecordStore.updateSyncMeta(bookId, {
          localSyncVer: uploadResult.syncVersion,
          lastSuccessfulSyncAt: Date.now(),
          lastUploadError: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        studyRecordStore.updateSyncMeta(bookId, {
          lastUploadError: message,
        });
        console.error(`Failed to upload pending done data for book ${bookId}:`, error);
        break;
      }

      // 上传过程中可能产生新的斩词/取消斩词记录，继续排空最新队列。
      pendingDoneRecords = studyRecordStore.getPendingDoneRecords(bookId);
    }

    try {
      const syncMeta = await studyService.getStudySyncMeta(bookId);
      const localSyncMeta = studyRecordStore.getSyncMeta(bookId);
      studyRecordStore.updateSyncMeta(bookId, {
        remoteSyncVer: syncMeta.remoteSyncVer,
      });

      if (syncMeta.remoteSyncVer > localSyncMeta.localSyncVer) {
        const remoteLearnedWords = await studyService.getLearnedWords(bookId);
        studyRecordStore.mergeRemoteLearnedWords(bookId, remoteLearnedWords);
        studyRecordStore.updateSyncMeta(bookId, {
          localSyncVer: syncMeta.remoteSyncVer,
          remoteSyncVer: syncMeta.remoteSyncVer,
        });
      }

      nextRecordMap = createRecordMap(studyRecordStore.getAllRecords(bookId));
    } catch (error) {
      console.error(`Failed to sync remote learned words for book ${bookId}:`, error);
    }

    const currentPlan = get().studyPlan?.book_id === bookId ? get().studyPlan : null;
    const homeState = calculateHomeState({
      records: nextRecordMap,
      roadmap,
      learnPlanCount: currentPlan?.daily_plan_count ?? 0,
      reviewPlanCount: currentPlan?.review_plan_count ?? 0,
      increasedCount: 0,
    });

    set({
      learnRecords: nextRecordMap,
      homeState,
      syncedBookId: bookId,
    });
  })().finally(() => {
    inflightBookSyncs.delete(bookId);
    if (get().syncingBookId === bookId) {
      set({ syncingBookId: null });
    }
  });

  inflightBookSyncs.set(bookId, task);
  return task;
}

async function hydrateStudyPlanForKnownBook(
  set: StudyStoreSet,
  get: StudyStoreGet,
  book: UserBookBasicInfo,
): Promise<void> {
  const planData = await studyService.getBookPlanInfo();
  set({ studyPlans: planData ?? [] });
  if (!planData || planData.length === 0) {
    return;
  }

  const userPlan = planData[0];
  set({
    studyPlan: userPlan,
    currentBook: book,
  });

  const roadmapData = await studyService.getRoadmap(userPlan.book_id);
  set({ wordList: roadmapData, wordListBookId: userPlan.book_id });
  await syncBookState(set, get, userPlan.book_id);
}

async function hydrateStudyPlan(
  set: StudyStoreSet,
  get: StudyStoreGet,
  plan: SelectBookPlanInfo,
  books?: UserBookBasicInfo[],
): Promise<void> {
  let matchedBook =
    get().currentBook?.id === plan.book_id ? get().currentBook : null;

  if (!matchedBook) {
    const availableBooks = books ?? (await studyService.getAllBooks()).books;
    matchedBook = availableBooks.find((book) => book.id === plan.book_id) ?? null;
  }

  set({
    studyPlan: plan,
    currentBook: matchedBook,
  });

  const roadmapData = await studyService.getRoadmap(plan.book_id);
  set({ wordList: roadmapData, wordListBookId: plan.book_id });
  await syncBookState(set, get, plan.book_id);
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
      syncedBookId: null,
      lastStudyStatistics: null,
      lastReviewStatistics: null,

      setCurrentBook: (book: UserBookBasicInfo) => {
        set({ currentBook: book });
        void get().syncCurrentBookState(book.id);
      },

      setStudyPlan: (plan: SelectBookPlanInfo) => {
        set({ studyPlan: plan });
        void get().syncCurrentBookState(plan.book_id);
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

      syncCurrentBookState: async (bookId?: number) => {
        const targetBookId =
          bookId ?? get().studyPlan?.book_id ?? get().currentBook?.id;
        if (!targetBookId) {
          return;
        }

        const joinedExistingSync = inflightBookSyncs.has(targetBookId);
        await syncBookState(set, get, targetBookId);

        // 如果本次调用加入的是旧同步任务，任务执行期间可能又写入了新状态；
        // 再启动一轮即可排空，当前调用自身失败时则保留 pending 等下次重试。
        if (
          joinedExistingSync &&
          studyRecordStore.getPendingDoneRecords(targetBookId).length > 0
        ) {
          await syncBookState(set, get, targetBookId);
        }
      },

      fetchStudyData: async () => {
        try {
          // 获取用户学习计划
          const planData = await studyService.getBookPlanInfo();
          set({ studyPlans: planData ?? [] });
          if (planData && planData.length > 0) {
            const userPlan = planData[0];
            set({ studyPlan: userPlan });
            
            const { currentBook } = get();
            
            // 检查缓存的单词书ID是否与当前学习计划的book_id匹配
            if (currentBook && currentBook.id === userPlan.book_id) {
              const { wordList } =  get();

              // 无单词列表则拉取
              if (
                !wordList ||
                !wordList.length ||
                get().wordListBookId !== userPlan.book_id
              ) {
                const roadmapData = await studyService.getRoadmap(userPlan.book_id);
                set({ wordList: roadmapData, wordListBookId: userPlan.book_id });
              }

              await get().syncCurrentBookState(userPlan.book_id);
              return;
            } else {
              // 不匹配或无缓存，重新拉取单词书信息
              const booksData = await studyService.getAllBooks();
              const matchedBook = booksData.books.find(book => book.id === userPlan.book_id);
              if (matchedBook) {
                set({ currentBook: matchedBook });
                
                // 获取单词列表
                const roadmapData = await studyService.getRoadmap(userPlan.book_id);
                set({ wordList: roadmapData, wordListBookId: userPlan.book_id });
              }
            }

            await get().syncCurrentBookState(userPlan.book_id);
          } else {
            set({
              studyPlan: null,
              currentBook: null,
              wordList: [],
              wordListBookId: null,
              homeState: createEmptyHomeState(),
            });
          }
        } catch (error) {
          console.error('Failed to fetch study data:', error);
        }
      },

      refreshStudyPlans: async () => {
        const planData = await studyService.getBookPlanInfo();
        set({ studyPlans: planData ?? [] });
        return planData ?? [];
      },

      switchStudyBook: async (plan: SelectBookPlanInfo) => {
        await studyService.switchSelectedBookPlan(plan);
        const [planData, booksData] = await Promise.all([
          studyService.getBookPlanInfo(),
          studyService.getAllBooks(),
        ]);
        const currentPlan = planData[0] ?? plan;

        set({ studyPlans: planData ?? [] });
        await hydrateStudyPlan(set, get, currentPlan, booksData.books);
      },

      refreshStudyDataForBook: async (book: UserBookBasicInfo) => {
        try {
          await hydrateStudyPlanForKnownBook(set, get, book);
        } catch (error) {
          console.error('Failed to refresh study data for known book:', error);
        }
      },

      clearStudyData: () => {
        set({
          currentBook: null,
          studyPlan: null,
          studyPlans: [],
          wordList: [],
          wordListBookId: null,
          learnRecords: {},
          homeState: createEmptyHomeState(),
          syncingBookId: null,
          syncedBookId: null,
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
      migrate: (persistedState) => normalizePersistedStudyState(persistedState),
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
