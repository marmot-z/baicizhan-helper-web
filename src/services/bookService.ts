import { ApiService } from './api';
import type {
  UserBookItem,
  UserBooksResponse,
  UserBookWordDetail,
  TopicResourceV2,
  SearchWordResultV2,
  TopicKey,
  WordListWordMetaV2,
} from '../types';

export type WordDetailChannel =
  | 'SEARCH_WORD'
  | 'STUDY'
  | 'WORD_LIST_LEARNED'
  | 'WORD_LIST_UNLEARNED'
  | 'WORD_LIST_KILLED'
  | 'WORD_LIST_COLLECTED'
  | 'LOOK_UP'
  | 'OTHER';

export interface WordDetailRequest {
  topicId: number;
  withDict?: boolean;
  withMedia?: boolean;
  withSimilarWords?: boolean;
  bookId?: number;
  tagId?: number;
  channel?: WordDetailChannel;
}

export const bookService = {
  // 获取用户所有单词本信息
  async getBooks(): Promise<UserBookItem[]> {
    const response = await ApiService.get<UserBooksResponse>('/books');
    return response.data.user_books;
  },

  // 获取单词本中的单词列表
  async getBookWords(bookId: number): Promise<UserBookWordDetail[]> {
    const response = await ApiService.get<UserBookWordDetail[]>(
      `/book/${bookId}/words`
    );
    return response.data;
  },

  // 获取当前词书列表展示所需的轻量元信息
  async getWordListWordMeta(
    topicKeys: TopicKey[]
  ): Promise<WordListWordMetaV2[]> {
    if (topicKeys.length === 0) {
      return [];
    }

    const response = await ApiService.post<WordListWordMetaV2[]>(
      '/wordListWordMetaV2',
      topicKeys
    );
    return response.data;
  },

  // 获取单词详情
  async getWordDetail({
    topicId,
    withDict = true,
    withMedia = false,
    withSimilarWords = false,
    bookId,
    tagId,
    channel,
  }: WordDetailRequest): Promise<TopicResourceV2> {
    const params = new URLSearchParams();
    params.append('withDict', withDict.toString());
    params.append('withMedia', withMedia.toString());
    params.append('withSimilarWords', withSimilarWords.toString());
    if (bookId !== undefined) {
      params.append('bookId', String(bookId));
    }
    if (tagId !== undefined) {
      params.append('tagId', String(tagId));
    }
    if (channel) {
      params.append('channel', channel);
    }

    const response = await ApiService.get<TopicResourceV2>(
      `/word/${topicId}?${params.toString()}`
    );
    return response.data;
  },

  // 收藏单词
  async collectWord(bookId: number, topicId: number): Promise<boolean> {
    const response = await ApiService.put<boolean>(
      `/book/${bookId}/word/${topicId}`
    );
    return response.data;
  },

  // 取消收藏单词
  async cancelCollectWord(bookId: number, topicId: number): Promise<boolean> {
    const response = await ApiService.delete<boolean>(
      `/book/${bookId}/word/${topicId}`
    );
    return response.data;
  },

  // 搜索单词
  async searchWord(word: string): Promise<SearchWordResultV2[]> {
    const response = await ApiService.get<SearchWordResultV2[]>(
      `/search/word/${encodeURIComponent(word)}`
    );
    return response.data;
  },
};
