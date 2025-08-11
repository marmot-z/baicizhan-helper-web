import { ApiService } from './api';
import type { UserBookItem, UserBooksResponse, UserBookWordDetail } from '../types';

export const bookService = {
  // 获取用户所有单词本信息
  async getBooks(): Promise<UserBookItem[]> {
    const response = await ApiService.get<UserBooksResponse>('/books');
    return response.data.user_books;
  },

  // 获取单词本中的单词列表
  async getBookWords(bookId: number): Promise<UserBookWordDetail[]> {
    const response = await ApiService.get<UserBookWordDetail[]>(`/book/${bookId}/words`);
    return response.data;
  },
};