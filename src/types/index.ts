export interface LoginRequest {
  phoneNum: string;
  smsVerifyCode: string;
}

// 发送验证码请求
export interface SendSmsRequest {
  phoneNum: string;
}

// 发送验证码响应
export interface SendSmsResponse {
  verifyCode: string;
}

// 学习相关类型
export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  meaning: string;
  example: string;
  difficulty: number;
  isLearned: boolean;
  learnedAt?: string;
}

export interface StudyPlan {
  id: string;
  name: string;
  description: string;
  totalWords: number;
  learnedWords: number;
  dailyTarget: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface StudyRecord {
  id: string;
  date: string;
  wordsLearned: number;
  timeSpent: number; // 分钟
  accuracy: number; // 百分比
}

export interface SelectBookPlanInfo {
  book_id: number;
  learned_words_count: number;
  group_id: number;
  daily_plan_count: number;
  review_plan_count: number;
}

export interface UserBookBasicInfo {
  id: number;
  name: string;
  total_words_count: number;
  is_word_course: boolean;
  group_count: number;
  book_flag: number;
  img: string;
  desc: string;
}

export interface BooksInfoResponse {
  books_info: UserBookBasicInfo[];
}

// 用户单词本项目
export interface UserBookItem {
  user_book_id: number;
  book_name: string;
  word_num: number;
  cover: string;
  updated_at: number;
}

// 用户单词本响应
export interface UserBooksResponse {
  user_books: UserBookItem[];
}

// 单词本中的单词详情
export interface UserBookWordDetail {
  topic_id: number;
  book_id: number;
  created_at: number;
  word: string;
  mean: string;
  audio_us: string;
  audio_uk: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
}

// 用户绑定信息类型
export interface UserBindInfo {
  nickname: string;
  openid: string;
  provider: string;
  setNickname: boolean;
  setOpenid: boolean;
  setProvider: boolean;
  setUnionid: boolean;
  unionid: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 通用类型
export interface SelectOption {
  label: string;
  value: string | number;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// 日历学习内容相关类型
export interface CalendarDailyWord {
  topic_id: number;
  word: string;
  mean: string;
  accent: string;
  audio_url: string;
  word_level_id: number;
}

export interface CalendarDailyInfo {
  state: number;
  hint: string;
  daily_wod_count: number;
  words: CalendarDailyWord[];
  resign_state: number;
  resign_message: string;
}

// 单词详情相关类型定义
export interface TopicKey {
  topic_id: number;
  word_level_id: number;
  tag_id: number;
}

export interface ZpkInfo {
  topic_key: TopicKey;
  zpk_uri: string;
  zpk_md5: string;
  zpk_size: number;
  zpk_version: number;
}

export interface WordBasicInfo {
  topic_id: number;
  word: string;
  accent_usa: string;
  accent_uk: string;
  accent_usa_audio_uri: string;
  accent_uk_audio_uri: string;
  deformation_img_uri: string;
  etyma: string;
}

export interface MeanInfo {
  id: number;
  topic_id: number;
  mean_type: string;
  mean: string;
  accent_usa: string;
  accent_uk: string;
  accent_usa_audio_uri: string;
  accent_uk_audio_uri: string;
}

export interface SentenceInfo {
  id: number;
  topic_id: number;
  chn_mean_id: number;
  sentence: string;
  sentence_trans: string;
  highlight_phrase: string;
  img_uri: string;
  audio_uri: string;
}

export interface ShortPhraseInfo {
  id: number;
  topic_id: number;
  chn_mean_id: number;
  short_phrase: string;
  short_phrase_trans: string;
  short_phrase_topic_id: number;
}

export interface SynAntInfo {
  syn_ant_id: number;
  topic_id: number;
  chn_mean_id: number;
  syn_ant_topic_id: number;
  syn_ant: string;
}

export interface VariantInfo {
  topic_id: number;
  pl: string;
  pl_topic_id: number;
  third: string;
  third_topic_id: number;
  past: string;
  past_topic_id: number;
  done: string;
  done_topic_id: number;
  ing: string;
  ing_topic_id: number;
  er: string;
  er_topic_id: number;
  est: string;
  est_topic_id: number;
  prep: string;
  prep_topic_id: number;
  adv: string;
  adv_topic_id: number;
  verb: string;
  verb_topic_id: number;
  noun: string;
  noun_topic_id: number;
  adj: string;
  adj_topic_id: number;
  conn: string;
  conn_topic_id: number;
}

export interface WordDictV2 {
  word_basic_info: WordBasicInfo;
  chn_means: MeanInfo[];
  en_means: MeanInfo[];
  sentences: SentenceInfo[];
  short_phrases: ShortPhraseInfo[];
  antonyms: SynAntInfo[];
  synonyms: SynAntInfo[];
  variant_info: VariantInfo;
  exams: string[];
}

export interface DictWiki {
  dict: WordDictV2;
  origin_word: string;
  variant_type: string;
}

export interface WordMedia {
  topic_id: number;
  m4a_audio_path: string;
  amr_audio_path: string;
  tv_path: string;
  tv_snapshot_path: string;
  word: string;
  word_mean_cn: string;
  word_type: string;
  word_sentence: string;
  fm_updated_at: number;
  tv_updated_at: number;
  poster_updated_at: number;
  poster_zpk: string;
}

export interface SimilarWord {
  topic_id: number;
  word_level_id: number;
  word: string;
}

export interface TopicResourceV2 {
  zpk_info: ZpkInfo;
  dict: WordDictV2;
  dict_wiki: DictWiki;
  media: WordMedia;
  similar_words: SimilarWord[];
}
