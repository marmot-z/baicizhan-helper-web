import { ApiService } from './api';
import type { SelectBookPlanInfo, BooksInfoResponse, UserBookBasicInfo } from '../types';

export const studyService = {
  // 获取用户学习计划信息
  async getBookPlanInfo(): Promise<SelectBookPlanInfo[]> {
    const response = await ApiService.get<SelectBookPlanInfo[]>('/selectBookPlanInfo');
    return response.data;
  },

  // 获取全部单词书信息
  async getAllBooks(): Promise<UserBookBasicInfo[]> {
    const response = await ApiService.get<BooksInfoResponse>('/booksInfo');
    return response.data.books_info;
  },
};