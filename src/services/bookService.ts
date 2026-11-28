import { ApiService } from './api';
import { accountSession } from './accountSession';
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

interface WordMetaCache {
  signature: string;
  expiresAt: number;
  data?: WordListWordMetaV2[];
  pending?: Promise<WordListWordMetaV2[]>;
}
let wordMetaCache: WordMetaCache | undefined;
let wordMetaSession = '';
const wordMetaRequests = new Map<string, WordMetaCache>();
const topicKeySignature = (key: TopicKey) => `${key.topic_id}:${key.word_level_id}:${key.tag_id}`;
const copyMetadata = (data: WordListWordMetaV2[]) => data.map(item => ({ ...item, topic_key: { ...item.topic_key } }));

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
    topicKeys: TopicKey[],
    options: { force?: boolean } = {},
  ): Promise<WordListWordMetaV2[]> {
    if (topicKeys.length === 0) {
      return [];
    }

    const version = accountSession.getVersion();
    const account = accountSession.getStorageKey();
    accountSession.assertCurrent(version);
    const session = JSON.stringify([account, version]);
    if (wordMetaSession !== session) {
      wordMetaCache = undefined;
      wordMetaRequests.clear();
      wordMetaSession = session;
    }
    const signature = topicKeys.map(topicKeySignature).join('|');
    const previous = wordMetaCache?.signature === signature ? wordMetaCache : undefined;
    // An in-progress request is already fresh, including for an explicit reload.
    const activeRequest = wordMetaRequests.get(signature);
    if (activeRequest?.pending) {
      wordMetaCache = activeRequest;
      return activeRequest.pending.then(copyMetadata);
    }
    if (!options.force && previous?.data && previous.expiresAt > Date.now()) return copyMetadata(previous.data);

    const entry: WordMetaCache = { signature, expiresAt: 0 };
    wordMetaCache = entry;
    wordMetaRequests.set(signature, entry);
    entry.pending = ApiService.post<WordListWordMetaV2[]>('/wordListWordMetaV2', topicKeys)
      .then(response => {
        accountSession.assertCurrent(version);
        const data = response.data;
        if (!Array.isArray(data)) throw new Error('单词信息响应格式异常，请重新加载');
        const returnedKeys = new Set(data.map(item => item?.topic_key ? topicKeySignature(item.topic_key) : ''));
        const complete = topicKeys.every(key => returnedKeys.has(topicKeySignature(key)))
          && data.every(item => item?.topic_key && typeof item.word === 'string' && typeof item.mean_cn === 'string');
        if (wordMetaCache === entry && complete) {
          entry.data = copyMetadata(data);
          entry.expiresAt = Date.now() + 10 * 60 * 1000;
        }
        return data;
      }).finally(() => {
        if (wordMetaRequests.get(signature) === entry) wordMetaRequests.delete(signature);
        if (wordMetaCache === entry) {
          entry.pending = undefined;
          if (!entry.data) wordMetaCache = undefined;
        }
      });
    return entry.pending.then(copyMetadata);
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
