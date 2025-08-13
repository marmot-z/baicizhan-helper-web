// 路由常量
export const ROUTES = {
  HOME: '/',
  LOGIN: '/page/login',
  DASHBOARD: '/page/dashboard',
  PROFILE: '/page/profile',
  WORD_BOOK: '/page/wordbook/:id',
  STUDY_PLAN: '/page/study-plan',
  STUDY_CALENDAR: '/page/study-calendar',
  WORD_DETAIL: '/page/word-detail/:word',
  VIP_CENTER: '/page/vip-center',
} as const;

// API端点常量
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
  },
  WORDS: {
    LIST: '/words',
    DETAIL: '/words/:id',
    SEARCH: '/words/search',
  },
  STUDY: {
    PLANS: '/study/plans',
    RECORDS: '/study/records',
    CALENDAR: '/study/calendar',
  },
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth-token',
  USER_PREFERENCES: 'user-preferences',
  THEME: 'theme',
} as const;

// 主题常量
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

// 学习难度等级
export const DIFFICULTY_LEVELS = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  EXPERT: 4,
} as const;

// 学习状态
export const STUDY_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  PAUSED: 'paused',
} as const;

// 分页默认值
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// 时间格式
export const DATE_FORMATS = {
  DATE: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  TIME: 'HH:mm:ss',
  DISPLAY_DATE: 'MM月DD日',
  DISPLAY_DATETIME: 'MM月DD日 HH:mm',
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  UNAUTHORIZED: '登录已过期，请重新登录',
  FORBIDDEN: '没有权限访问该资源',
  NOT_FOUND: '请求的资源不存在',
  SERVER_ERROR: '服务器内部错误，请稍后重试',
  VALIDATION_ERROR: '输入数据格式不正确',
  UNKNOWN_ERROR: '未知错误，请联系管理员',
} as const;

// 成功消息
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: '登录成功',
  LOGOUT_SUCCESS: '退出成功',
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  UPDATE_SUCCESS: '更新成功',
} as const;