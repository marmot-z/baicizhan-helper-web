import type { ReviewDetailReason, ReviewStage, ReviewWordRecord } from '../review/types';
import type { StudyStage } from './types';

export type StudySessionMode = 'learn' | 'review';

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
  wordTopicIds: number[];
  process: LearnProcessState;
  currentCard: LearnWordCardState | null;
  failMap: Record<number, number>;
  useTimeMap: Record<number, number>;
  elapsedTime: number;
  currentWordElapsedTime: number;
}

export interface ReviewSessionState {
  wordTopicIds: number[];
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

export interface LearnSessionDraftV1 extends StudySessionDraftBase {
  mode: 'learn';
  state: LearnSessionState;
}

export interface ReviewSessionDraftV1 extends StudySessionDraftBase {
  mode: 'review';
  state: ReviewSessionState;
}

export type StudySessionDraftV1 = LearnSessionDraftV1 | ReviewSessionDraftV1;

export interface StudySessionStore {
  load(mode: 'learn', bookId: number): LearnSessionDraftV1 | null;
  load(mode: 'review', bookId: number): ReviewSessionDraftV1 | null;
  save(draft: StudySessionDraftV1): boolean;
  clear(mode: StudySessionMode, bookId: number): void;
  clearAll(): void;
  removeExpired(currentPlanDate: string): void;
}
