// 背单词功能相关类型定义
import type { TopicResourceV2 } from '../../types';

// 选项接口
export interface StudyOption {
  id: number,
  word: string;
  translation: string;
  isCorrect: boolean;
}

// 单词信息接口
export interface StudyWord {
  word: TopicResourceV2,
  options: StudyOption[],
}

// 答案结果接口
export interface AnswerResult {
  isCorrect: boolean;
  hint?: string;
  isMaxAttemptsReached: boolean;
}

// 学习统计数据接口
export interface StudyStatistics {
  totalWords: number;
  completedWords: number;
  correctFirstAttempt: number;
  averageAttempts: number;
  timeSpent: number;
}

// 环节统计数据接口
export interface IteratorStatistics {
  totalWords: number;
  completedWords: number;
  failedWords: number;
  retryCount: number;
}

// 学习状态类型
export type StudyStatus = 'not_started' | 'in_progress' | 'paused' | 'completed';

// 单词卡片状态类型
export type WordCardStatus = 'not_started' | 'in_progress' | 'passed' | 'failed';

// 学习环节类型
export type StudyStage = 'recognition' | 'understanding' | 'mastery';