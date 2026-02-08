import { ApiService } from './api';
import { StudyUtils } from './study/StudyUtils';
import type { StudyUIModel } from './study/types';
import type { SelectBookPlanInfo, BooksInfoResponse, UserBookBasicInfo, CalendarDailyInfo, UserRoadMapElementV2, UserLearnedWordInfo, UserDoneWordRecord, CreditStatus, XModeWordDetail } from '../types';

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
  
  async updateReviewData(doneRecords: UserDoneWordRecord[]): Promise<void> {
    console.log('[studyService] updateReviewData', doneRecords);
  },

  // 获取配置
  async getSettings(): Promise<void> {
    await ApiService.get('/study/settings');
  },

  // 获取信用状态
  async getCreditStatus(): Promise<CreditStatus> {
    const response = await ApiService.get<CreditStatus>('/creditStatus');
    return response.data;
  },

  // 报告系统事件
  async reportEvent(eventId: string, extraInfo: string, statGroup: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('eventId', eventId);
    params.append('extraInfo', extraInfo);
    params.append('statGroup', statGroup);

    await ApiService.post(`/reportEvent?${params.toString()}`);
  },

  // 保存学习记录
  async saveStudyRecord(
    bookId: number, 
    topicId: number, 
    costMilliseconds?: number, 
    spellWrongTimes?: number
  ): Promise<void> {
    const params = new URLSearchParams();
    params.append('bookId', bookId.toString());
    params.append('topicId', topicId.toString());
    
    if (costMilliseconds !== undefined) {
      params.append('costMilliseconds', costMilliseconds.toString());
    }
    
    if (spellWrongTimes !== undefined) {
      params.append('spellWrongTimes', spellWrongTimes.toString());
    }

    await ApiService.post(`/saveStudyRecord?${params.toString()}`);
  },

  // 获取学习记录
  async getStudyRecord(bookId: number, topicIds: number[]): Promise<void> {
    const params = new URLSearchParams();
    params.append('bookId', bookId.toString());
    
    // 处理数组参数，以逗号连接
    params.append('topicIds', topicIds.join(','));

    await ApiService.get(`/studyRecord?${params.toString()}`);
  },

  // x模式打卡
  async xModeDaka(count: number, date: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('count', count.toString());
    params.append('date', date);

    await ApiService.post(`/xmode/daka?${params.toString()}`);
  },

  // 获取x模式单词详情
  async getXModeWordDetails(bookId: number, topicIds: number[]): Promise<StudyUIModel[]> {
    const params = new URLSearchParams();
    params.append('bookId', bookId.toString());
    
    // 处理数组参数，以逗号连接
    params.append('topicIds', topicIds.join(','));

    const response = await ApiService.post<XModeWordDetail[]>(`/xmode/wordDetails?${params.toString()}`);
    return response.data.map(detail => StudyUtils.adaptXModeToUIModel(detail, detail.collected));
  },
};
