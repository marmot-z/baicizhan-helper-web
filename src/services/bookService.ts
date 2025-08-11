import { ApiService } from './api';
import type { UserBookItem, UserBooksResponse } from '../types';

export const bookService = {
  // 获取用户所有单词本信息
  async getBooks(): Promise<UserBookItem[]> {
    const response = await ApiService.get<UserBooksResponse>('/books');
    return response.data.user_books;
  },
};