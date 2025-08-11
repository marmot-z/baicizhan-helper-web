import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserBookWordDetail } from '../types';

interface WordBookData {
  words: UserBookWordDetail[];
  timestamp: number;
}

interface WordBookState {
  wordBooks: Record<string, WordBookData>;
  setWordBook: (bookId: string, words: UserBookWordDetail[]) => void;
  getWordBook: (bookId: string) => UserBookWordDetail[] | null;
  clearExpiredData: () => void;
}

const EXPIRY_TIME = 12 * 60 * 60 * 1000; // 半天（12小时）

export const useWordBookStore = create<WordBookState>()(
  persist(
    (set, get) => ({
      wordBooks: {},

      setWordBook: (bookId: string, words: UserBookWordDetail[]) => {
        set((state) => ({
          wordBooks: {
            ...state.wordBooks,
            [bookId]: {
              words,
              timestamp: Date.now(),
            },
          },
        }));
      },

      getWordBook: (bookId: string) => {
        const state = get();
        const wordBookData = state.wordBooks[bookId];
        
        if (!wordBookData) {
          return null;
        }
        
        // 检查是否过期
        const isExpired = Date.now() - wordBookData.timestamp > EXPIRY_TIME;
        if (isExpired) {
          // 删除过期数据
          set((state) => {
            const newWordBooks = { ...state.wordBooks };
            delete newWordBooks[bookId];
            return { wordBooks: newWordBooks };
          });
          return null;
        }
        
        return wordBookData.words;
      },

      clearExpiredData: () => {
        const state = get();
        const now = Date.now();
        const newWordBooks: Record<string, WordBookData> = {};
        
        Object.entries(state.wordBooks).forEach(([bookId, data]) => {
          if (now - data.timestamp <= EXPIRY_TIME) {
            newWordBooks[bookId] = data;
          }
        });
        
        set({ wordBooks: newWordBooks });
      },
    }),
    {
      name: 'word-book-storage',
      partialize: (state) => ({
        wordBooks: state.wordBooks,
      }),
    }
  )
);