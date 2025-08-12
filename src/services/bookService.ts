import { ApiService } from './api';
import type { UserBookItem, UserBooksResponse, UserBookWordDetail, TopicResourceV2 } from '../types';

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

  // 获取单词详情
  async getWordDetail(
    topicId: number,
    withDict: boolean = true,
    withMedia: boolean = false,
    withSimilarWords: boolean = false
  ): Promise<TopicResourceV2> {
    const params = new URLSearchParams();
    params.append('withDict', withDict.toString());
    params.append('withMedia', withMedia.toString());
    params.append('withSimilarWords', withSimilarWords.toString());
    
    const response = await ApiService.get<TopicResourceV2>(`/word/${topicId}?${params.toString()}`);
    return response.data;
  },
};