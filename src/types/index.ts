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