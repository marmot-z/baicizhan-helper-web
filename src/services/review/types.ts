import type { StudyOption, StudyUIModel } from '../study/types';
import type { UserRoadMapElementV2 } from '../../types';

export type ReviewStage =
  | 'loading'
  | 'empty'
  | 'choice'
  | 'detail'
  | 'spelling'
  | 'summary'
  | 'error';

export type ReviewDisplayPhase = 'choice' | 'spelling';

export type ReviewDetailReason = 'choice_retry' | 'choice_max_errors' | 'spell_error';

export interface ReviewWordRecord {
  topicId: number;
  word: string;
  errorCount: number;
  completedAt: number | null;
  reviewStartedAt: number | null;
  savedStudyRecord: boolean;
  choicePassed: boolean;
  spellingPassed: boolean;
  choiceFailed: boolean;
  spellingFailed: boolean;
}

export interface ReviewContext {
  bookId: number;
  planType: string;
}

export interface ReviewInitData {
  words: StudyUIModel[];
  roadmapMap: Map<number, UserRoadMapElementV2>;
  context: ReviewContext;
}

export interface ReviewChoiceOptionView extends StudyOption {
  disabled: boolean;
  status: 'idle' | 'correct' | 'incorrect';
  showOptionWord: boolean;
  showOptionTranslation: boolean;
}

export interface ReviewChoiceState {
  word: StudyUIModel;
  options: ReviewChoiceOptionView[];
  selectedOptionIds: number[];
  attemptCount: number;
  isOptionsLoading: boolean;
  remainingInRound: number;
  retryCount: number;
  showWord: boolean;
  showSentence: boolean;
  showTranslation: boolean;
  showEnglishTranslation: boolean;
}

export interface ReviewDetailState {
  word: StudyUIModel;
  reason: ReviewDetailReason;
  nextLabel: string;
}

export interface ReviewSpellState {
  word: StudyUIModel;
  isWrong: boolean;
  remainingInRound: number;
  retryCount: number;
}

export interface ReviewSummaryState {
  totalWords: number;
  completedWords: number;
  totalErrors: number;
  records: ReviewWordRecord[];
}

/** 跳转至统计页时通过路由 state 传递的复习汇总（精简可序列化字段） */
export interface ReviewStatisticsRoutePayload {
  totalWords: number;
  totalErrors: number;
  completedWords: number;
  records: Array<{
    topicId: number;
    word: string;
    errorCount: number;
    completedAt: number | null;
  }>;
}

export interface ReviewSnapshot {
  stage: ReviewStage;
  totalWords: number;
  completedChoiceWords: number;
  completedSpellWords: number;
  choiceState: ReviewChoiceState | null;
  detailState: ReviewDetailState | null;
  spellState: ReviewSpellState | null;
  summaryState: ReviewSummaryState | null;
  errorMessage: string | null;
}
