import type { ReviewDetailReason, ReviewStage, ReviewWordRecord } from '../review/types';
import type { StudyStage } from './types';

export type StudySessionMode = 'learn' | 'review';

export interface StudyQuestionState {
  questionId: string;
  topicId: number;
  phase: string;
  hadWrong: boolean;
  elapsedTime: number;
  committed: boolean;
}

export interface LearnWordCardState {
  topicId: number;
  stage: StudyStage;
  showAnswer: boolean;
  attemptCount: number;
  clickedOptionIds: number[];
}

export interface LearnProcessState {
  currentIteratorIndex: number;
  queues: Record<StudyStage, number[]>;
}

export interface LearnSessionState {
  sessionId: string;
  question?: StudyQuestionState;
  wordTopicIds: number[];
  process: LearnProcessState;
  currentCard: LearnWordCardState | null;
  failMap: Record<number, number>;
  useTimeMap: Record<number, number>;
  elapsedTime: number;
  currentWordElapsedTime: number;
  killedTopicIds?: number[];
}

export interface ReviewSessionState {
  sessionId: string;
  question?: StudyQuestionState;
  wordTopicIds: number[];
  killedTopicIds?: number[];
  stage: ReviewStage;
  completedChoiceWords: number;
  completedSpellWords: number;
  records: ReviewWordRecord[];
  choiceQueueTopicIds: number[];
  choiceRetryQueueTopicIds: number[];
  choiceRetryTopicIds: number[];
  currentChoiceTopicId: number | null;
  currentChoiceOptionIds: number[];
  currentChoiceAttemptCount: number;
  currentChoiceClickedOptionIds: number[];
  detailTopicId: number | null;
  detailReason: ReviewDetailReason | null;
  spellQueueTopicIds: number[];
  spellRetryQueueTopicIds: number[];
  spellRetryTopicIds: number[];
  currentSpellTopicId: number | null;
  currentSpellWrong: boolean;
}

interface StudySessionDraftBase {
  version: 1;
  bookId: number;
  planDate: string;
  createdAt: number;
  updatedAt: number;
  sessionId: string;
}

export interface LearnSessionDraft extends StudySessionDraftBase {
  mode: 'learn';
  state: LearnSessionState;
}

export interface ReviewSessionDraft extends StudySessionDraftBase {
  mode: 'review';
  state: ReviewSessionState;
}

export type StudySessionDraft = LearnSessionDraft | ReviewSessionDraft;

export interface StudySessionStore {
  buildCheckpoint(mode: 'learn', bookId: number, state: LearnSessionState): LearnSessionDraft;
  buildCheckpoint(mode: 'review', bookId: number, state: ReviewSessionState): ReviewSessionDraft;
  load(mode: 'learn', bookId: number): LearnSessionDraft | null;
  load(mode: 'review', bookId: number): ReviewSessionDraft | null;
  save(draft: StudySessionDraft, canWrite?: () => boolean): Promise<boolean>;
  clear(mode: StudySessionMode, bookId: number): Promise<void>;
  clearAll(): Promise<void>;
  removeExpired(currentPlanDate: string): Promise<void>;
}
