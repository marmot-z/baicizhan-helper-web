import { ApiService } from './api';
import type { SelectBookPlanInfo, BooksInfoResponse, UserBookBasicInfo, CalendarDailyInfo, UserRoadMapElementV2, UserLearnedWordInfo, UserDoneWordRecord } from '../types';

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

  // 获取指定日期的学习内容
  async getCalendarDailyInfo(date: string): Promise<CalendarDailyInfo> {
    const response = await ApiService.get<CalendarDailyInfo>(`/calendarDailyInfo?date=${date}&pageOffset=0&pageSize=200`);
    return response.data;
  },

  // 获取单词书路线图
  async getRoadmap(bookId: number): Promise<UserRoadMapElementV2[]> {
    const response = await ApiService.get<UserRoadMapElementV2[]>(`/roadmap?bookId=${bookId}`);
    return response.data;
  },

  // 获取已学单词信息
  async getLearnedWords(bookId: number): Promise<UserLearnedWordInfo[]> {
    const response = await ApiService.get<UserLearnedWordInfo[]>(`/learnedWords?bookId=${bookId}`);
    return response.data;
  },

  // 更新完成数据
  async updateDoneData(doneRecords: UserDoneWordRecord[], wordLevelId: number): Promise<void> {
    await ApiService.post('/updateDoneData', {
      doneRecords,
      wordLevelId
    });
  },
};