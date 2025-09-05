import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserBookBasicInfo, SelectBookPlanInfo, UserRoadMapElementV2 } from '../types';
import { studyService } from '../services/studyService';

interface StudyState {
  currentBook: UserBookBasicInfo | null;
  studyPlan: SelectBookPlanInfo | null;
  wordList: UserRoadMapElementV2[];
  setCurrentBook: (book: UserBookBasicInfo) => void;
  setStudyPlan: (plan: SelectBookPlanInfo) => void;
  setWordList: (words: UserRoadMapElementV2[]) => void;
  fetchStudyData: () => Promise<void>;
  clearStudyData: () => void;
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      studyPlan: null,
      wordList: [],

      setCurrentBook: (book: UserBookBasicInfo) => {
        set({ currentBook: book });
      },

      setStudyPlan: (plan: SelectBookPlanInfo) => {
        set({ studyPlan: plan });
      },

      setWordList: (words: UserRoadMapElementV2[]) => {
        set({ wordList: words });
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
              // 匹配，使用缓存数据
              return;
            } else {
              // 不匹配或无缓存，重新拉取单词书信息
              const booksData = await studyService.getAllBooks();
              const matchedBook = booksData.find(book => book.id === userPlan.book_id);
              if (matchedBook) {
                set({ currentBook: matchedBook });
                
                // 获取单词列表
                const roadmapData = await studyService.getRoadmap(userPlan.book_id);
                set({ wordList: roadmapData });
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch study data:', error);
        }
      },

      clearStudyData: () => {
        set({ currentBook: null, studyPlan: null, wordList: [] });
      },
    }),
    {
      name: 'study-storage',
      partialize: (state) => ({
        currentBook: state.currentBook,
        wordList: state.wordList,
      }),
    }
  )
);