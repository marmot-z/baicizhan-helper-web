import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

interface StudyState {
  currentBook: UserBookBasicInfo | null;
  studyPlan: SelectBookPlanInfo | null;
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
  refreshStudyDataForBook: (book: UserBookBasicInfo) => Promise<void>;
  clearStudyData: () => void;
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

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      studyPlan: null,
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
          }
        } catch (error) {
          console.error('Failed to fetch study data:', error);
        }
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
      name: 'study-storage',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<StudyState>;
        return {
          ...currentState,
          ...persisted,
          homeState: createEmptyHomeState(persisted.homeState ?? {}),
        };
      },
      partialize: (state) => ({
        currentBook: state.currentBook,
        studyPlan: state.studyPlan,
        wordList: state.wordList,
        wordListBookId: state.wordListBookId,
        learnRecords: state.learnRecords,
        homeState: state.homeState,
        syncedBookId: state.syncedBookId,
        lastStudyStatistics: state.lastStudyStatistics,
        lastReviewStatistics: state.lastReviewStatistics,
      }),
    }
  )
);
