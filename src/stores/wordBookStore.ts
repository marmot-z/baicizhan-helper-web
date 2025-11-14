import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserBookWordDetail } from '../types';
import { bookService } from '../services/bookService';

interface WordBookData {
  words: UserBookWordDetail[];
  timestamp: number;
}

interface WordBookState {
  wordBooks: Record<string, WordBookData>;
  initialize: () => Promise<void>;
  setWordBook: (bookId: string, words: UserBookWordDetail[]) => void;
  getWordBook: (bookId: string) => UserBookWordDetail[] | null;
  isCollected: (wordId: number) => Promise<boolean>;
  clearExpiredData: () => void;
  clearAllData: () => void;
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

      isCollected: async (wordId: number) => {
        const { wordBooks, initialize } = get();

        await initialize();

        const allWordIds = new Set<number>();
        Object.values(wordBooks).forEach((bookData: any) => {
          bookData.words.forEach((wordItem: any) => {
            allWordIds.add(wordItem.topic_id);
          });
        });

        return allWordIds.has(wordId);
      },

      initialize: async () => {
        const { wordBooks } = get();

        const books = await bookService.getBooks();
        for (const book of books) {
          const wordBook = wordBooks[book.user_book_id.toString()];
          // 单词书不存在，过期，单词数不一致，需要刷新
          const refresh =
            !wordBook ||
            wordBook.timestamp - Date.now() > EXPIRY_TIME ||
            book.word_num !== wordBook?.words.length;

          if (refresh) {
            const words = await bookService.getBookWords(book.user_book_id);
            get().setWordBook(book.user_book_id.toString(), words);
          }
        }
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

      clearAllData: () => {
        set({ wordBooks: {} });
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
