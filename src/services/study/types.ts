// 背单词功能相关类型定义
import type { TopicResourceV2, SearchWordResultV2 } from '../../types';

// 选项接口
export interface StudyOption {
  id: number,
  word: string;
  translation: string;
  isCorrect: boolean;
  showOptionWord?: boolean;
  showOptionTranslation?: boolean;
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

export interface StudyStatistcs {
  failMap: Record<number, number>;
  usedTimeMap: Record<number, number>;
  totalTime: number;
  words: SearchWordResultV2[],
  updateTime: number;
}

// 学习状态类型
export type StudyStatus = 'not_started' | 'in_progress' | 'paused' | 'completed';

// 单词卡片状态类型
export type WordCardStatus = 'not_started' | 'in_progress' | 'passed' | 'failed';

// 学习环节类型
export type StudyStage = 'recognition' | 'understanding' | 'mastery';

// --- New UI Model Definitions ---

export interface StudyMedia {
  type: 'video' | 'image';
  url: string;
  poster?: string;
}

export interface StudyAccent {
  us: string;
  uk: string;
  usAudio: string;
  ukAudio: string;
}

export interface StudySentence {
  en: string;
  cn: string;
  audio?: string;
  img?: string;
  highlightPhrase?: string;
}

export interface StudyMean {
  type: string;
  text: string;
}

export interface StudyPhrase {
  phrase: string;
  cn: string;
}

export interface StudyVariant {
  label: string;
  word: string;
}

export interface StudyRelatedWord {
  word: string;
  topicId?: number;
}

export interface FrontCardUI {
  media: StudyMedia | null;
  accent: StudyAccent;
  options: StudyOption[];
  chnMean: string;
}

export interface BackCardUI {
  cnMeans: StudyMean[];
  sentences: StudySentence[];
  mnemonic?: StudyMnemonic;
}

export interface StudyMnemonic {
  type: number;
  content: string;
  imgContent: string;
}

export interface ExtensionUI {
  enMeans: StudyMean[];
  phrases: StudyPhrase[];
  variants: StudyVariant[];
  synonyms: StudyRelatedWord[];
  antonyms: StudyRelatedWord[];
  similars: StudyRelatedWord[];
}

export interface StudyUIModel {
  topicId: number;
  word: string;
  collected: boolean;
  front: FrontCardUI;
  back: BackCardUI;
  extensions: ExtensionUI;
}

export interface StudyContext {
  planType: string;
  bookId: number;
}
