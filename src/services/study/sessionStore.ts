import type {
  LearnSessionDraft, LearnSessionState, ReviewSessionDraft, ReviewSessionState,
  StudySessionDraft, StudySessionMode, StudySessionStore,
} from './sessionTypes';
import { getStudyAccount, mutateStudyAccount } from './database';

function draftKey(mode: StudySessionMode, bookId: number): string { return `${mode}:${bookId}`; }
export function getLocalPlanDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function createStudySessionId(): string {
  return typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function isCount(value: unknown): boolean { return isNumber(value) && value >= 0; }
function isIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isSafeInteger(id) && id > 0);
}
function isNumberMap(value: unknown): boolean { return isObject(value) && Object.values(value).every(isCount); }
function isNullableNumber(value: unknown): boolean { return value === null || isNumber(value); }
function isDraftValid(value: unknown, mode: StudySessionMode, bookId: number): value is StudySessionDraft {
  if (!isObject(value) || value.version !== 1 || !['learn', 'review'].includes(String(value.mode))
    || value.mode !== mode || value.bookId !== bookId
    || typeof value.sessionId !== 'string' || !value.sessionId || typeof value.planDate !== 'string'
    || !isNumber(value.createdAt) || !isNumber(value.updatedAt) || !isObject(value.state)) return false;
  const state = value.state;
  if (state.sessionId !== value.sessionId || !isIds(state.wordTopicIds)
    || (state.killedTopicIds !== undefined && !isIds(state.killedTopicIds))) return false;
  const wordTopicIds = state.wordTopicIds;
  if (state.question !== undefined) {
    const question = state.question;
    if (!isObject(question) || typeof question.questionId !== 'string' || !question.questionId
      || !wordTopicIds.includes(Number(question.topicId)) || typeof question.phase !== 'string'
      || typeof question.hadWrong !== 'boolean' || typeof question.committed !== 'boolean'
      || !isCount(question.elapsedTime)) return false;
  }
  if (mode === 'learn') {
    const process = state.process;
    if (!isObject(process) || !isObject(process.queues)
      || !Number.isInteger(process.currentIteratorIndex) || Number(process.currentIteratorIndex) < 0
      || Number(process.currentIteratorIndex) > 3
      || !['recognition', 'understanding', 'mastery'].every((stage) => isIds((process.queues as Record<string, unknown>)[stage]))
      || !isNumberMap(state.failMap) || !isNumberMap(state.useTimeMap)
      || !isCount(state.elapsedTime) || !isCount(state.currentWordElapsedTime)) return false;
    const card = state.currentCard;
    return card === null || (isObject(card) && isObject(state.question)
      && state.question.topicId === card.topicId && state.question.phase === card.stage
      && wordTopicIds.includes(Number(card.topicId))
      && ['recognition', 'understanding', 'mastery'].includes(String(card.stage))
      && typeof card.showAnswer === 'boolean' && isCount(card.attemptCount) && isIds(card.clickedOptionIds));
  }
  if ([state.currentChoiceTopicId, state.currentSpellTopicId, state.detailTopicId].some((id) => id !== null)
    && !isObject(state.question)) return false;
  return ['loading', 'empty', 'choice', 'detail', 'spelling', 'summary', 'error'].includes(String(state.stage))
    && isCount(state.completedChoiceWords) && isCount(state.completedSpellWords)
    && ['choiceQueueTopicIds', 'choiceRetryQueueTopicIds', 'choiceRetryTopicIds', 'currentChoiceOptionIds',
      'currentChoiceClickedOptionIds', 'spellQueueTopicIds', 'spellRetryQueueTopicIds', 'spellRetryTopicIds']
      .every((name) => isIds(state[name]))
    && ['currentChoiceTopicId', 'detailTopicId', 'currentSpellTopicId'].every((name) => isNullableNumber(state[name]))
    && (state.detailReason === null || ['choice_retry', 'choice_max_errors', 'spell_error'].includes(String(state.detailReason)))
    && isCount(state.currentChoiceAttemptCount) && typeof state.currentSpellWrong === 'boolean'
    && Array.isArray(state.records) && state.records.every((record) => isObject(record)
      && wordTopicIds.includes(Number(record.topicId)) && typeof record.word === 'string'
      && isCount(record.errorCount) && isNullableNumber(record.completedAt) && isNullableNumber(record.reviewStartedAt)
      && ['savedStudyRecord', 'choicePassed', 'spellingPassed', 'choiceFailed', 'spellingFailed', 'scoreSettled']
        .every((name) => typeof record[name] === 'boolean')
      && isCount(record.activeTime) && isNumber(record.scoreBeforeReview) && isCount(record.reviewRoundBeforeReview));
}
function loadStudySession(mode: 'learn', bookId: number): LearnSessionDraft | null;
function loadStudySession(mode: 'review', bookId: number): ReviewSessionDraft | null;
function loadStudySession(mode: StudySessionMode, bookId: number): StudySessionDraft | null {
  const draft = getStudyAccount().drafts[draftKey(mode, bookId)];
  return isDraftValid(draft, mode, bookId) && draft.planDate === getLocalPlanDate() ? draft : null;
}

export function buildCheckpoint(mode: 'learn', bookId: number, state: LearnSessionState): LearnSessionDraft;
export function buildCheckpoint(mode: 'review', bookId: number, state: ReviewSessionState): ReviewSessionDraft;
export function buildCheckpoint(mode: StudySessionMode, bookId: number,
  state: LearnSessionState | ReviewSessionState): StudySessionDraft {
  const previousDraft = getStudyAccount().drafts[draftKey(mode, bookId)];
  const previous = isDraftValid(previousDraft, mode, bookId) ? previousDraft : undefined;
  const now = Date.now();
  const header = {
    version: 1 as const, bookId, planDate: getLocalPlanDate(),
    createdAt: previous?.sessionId === state.sessionId ? previous.createdAt : now,
    updatedAt: now, sessionId: state.sessionId,
  };
  return mode === 'learn'
    ? { ...header, mode, state: state as LearnSessionState }
    : { ...header, mode, state: state as ReviewSessionState };
}

export const studySessionStore: StudySessionStore = {
  buildCheckpoint,
  load: loadStudySession,
  async save(draft: StudySessionDraft, canWrite?: () => boolean): Promise<boolean> {
    if (!isDraftValid(draft, draft.mode, draft.bookId)) return false;
    if (canWrite && !canWrite()) return true;
    try {
      await mutateStudyAccount((account) => {
        if (canWrite && !canWrite()) return;
        if (account.closedSessions[draft.sessionId]) return;
        const key = draftKey(draft.mode, draft.bookId);
        const previousDraft = account.drafts[key];
        const previous = isDraftValid(previousDraft, draft.mode, draft.bookId) ? previousDraft : undefined;
        const question = draft.state.question;
        // A callback queued before an atomic result commit must not resurrect its old question.
        if (question && account.receipts[question.questionId]
          && (!question.committed || previous?.state.question?.questionId !== question.questionId)) return;
        if (previous?.sessionId === draft.sessionId && previous.updatedAt > draft.updatedAt) return;
        account.drafts[key] = draft;
      });
      return true;
    } catch { return false; }
  },
  async clear(mode: StudySessionMode, bookId: number): Promise<void> {
    await mutateStudyAccount((account) => {
      const key = draftKey(mode, bookId);
      const draft = account.drafts[key];
      if (draft?.sessionId) account.closedSessions[draft.sessionId] = true;
      delete account.drafts[key];
    });
  },
  async clearAll(): Promise<void> {
    await mutateStudyAccount((account) => {
      for (const draft of Object.values(account.drafts)) {
        if (draft?.sessionId) account.closedSessions[draft.sessionId] = true;
      }
      account.drafts = {};
    });
  },
  async removeExpired(currentPlanDate: string): Promise<void> {
    await mutateStudyAccount((account) => {
      for (const draft of Object.values(account.drafts)) {
        if (draft?.sessionId && draft.planDate !== currentPlanDate) account.closedSessions[draft.sessionId] = true;
      }
      account.drafts = Object.fromEntries(Object.entries(account.drafts).filter(([, draft]) => draft && isDraftValid(draft, draft.mode, draft.bookId) && draft.planDate === currentPlanDate));
    });
  },
};
