import { describe, expect, it } from 'vitest';
import { ReviewFlow } from './ReviewFlow';
import type { ReviewInitData } from './types';
import type { ReviewSessionState } from '../study/sessionTypes';
import type { StudyUIModel } from '../study/types';

const createModel = (topicId: number): StudyUIModel => ({
  topicId,
  word: `word-${topicId}`,
  collected: false,
  front: {
    media: null,
    accent: { us: '', uk: '', usAudio: '', ukAudio: '' },
    chnMean: '',
    options: [
      { id: topicId, word: `word-${topicId}`, translation: 'ok', isCorrect: true },
      { id: topicId + 100, word: 'wrong', translation: 'wrong', isCorrect: false },
    ],
  },
  back: { cnMeans: [], sentences: [] },
  extensions: { enMeans: [], phrases: [], variants: [], synonyms: [], antonyms: [], similars: [] },
});

const initData: ReviewInitData = {
  words: [createModel(1), createModel(2)],
  roadmapMap: new Map(),
  context: { bookId: 10, planType: 'XModelReviewStudy' },
};

const state: ReviewSessionState = {
  wordTopicIds: [1, 2],
  stage: 'choice',
  completedChoiceWords: 0,
  completedSpellWords: 0,
  records: [1, 2].map((topicId) => ({
    topicId,
    word: `word-${topicId}`,
    errorCount: topicId === 1 ? 1 : 0,
    completedAt: null,
    reviewStartedAt: 100,
    savedStudyRecord: false,
    choicePassed: false,
    spellingPassed: false,
    choiceFailed: topicId === 1,
    spellingFailed: false,
  })),
  choiceQueueTopicIds: [2],
  choiceRetryQueueTopicIds: [1],
  choiceRetryTopicIds: [1],
  currentChoiceTopicId: 1,
  currentChoiceOptionIds: [101, 1],
  currentChoiceAttemptCount: 1,
  currentChoiceClickedOptionIds: [101],
  detailTopicId: null,
  detailReason: null,
  spellQueueTopicIds: [],
  spellRetryQueueTopicIds: [],
  spellRetryTopicIds: [],
  currentSpellTopicId: null,
  currentSpellWrong: false,
};

describe('ReviewFlow snapshots', () => {
  it('restores choice position, option order and retry queues exactly', () => {
    const flow = ReviewFlow.restore(initData, state);
    expect(flow.exportState()).toEqual(state);
    const snapshot = flow.getSnapshot();
    expect(snapshot.stage).toBe('choice');
    expect(snapshot.choiceState?.options.map((option) => option.id)).toEqual([101, 1]);
    expect(snapshot.choiceState?.selectedOptionIds).toEqual([101]);
    expect(snapshot.choiceState?.retryCount).toBe(1);
  });

  it('rejects a draft whose word resources are incomplete', () => {
    expect(() => ReviewFlow.restore(
      { ...initData, words: [createModel(1)] },
      state,
    )).toThrow(/Cannot restore review/);
  });

  it('restores the detail phase', () => {
    const detailState: ReviewSessionState = {
      ...state,
      stage: 'detail',
      currentChoiceTopicId: null,
      currentChoiceOptionIds: [],
      currentChoiceAttemptCount: 0,
      currentChoiceClickedOptionIds: [],
      detailTopicId: 1,
      detailReason: 'choice_retry',
    };
    const flow = ReviewFlow.restore(initData, detailState);
    expect(flow.exportState()).toEqual(detailState);
    expect(flow.getSnapshot().detailState?.reason).toBe('choice_retry');
  });

  it('restores the spelling phase and retry queue', () => {
    const spellState: ReviewSessionState = {
      ...state,
      stage: 'spelling',
      choiceQueueTopicIds: [],
      choiceRetryQueueTopicIds: [],
      choiceRetryTopicIds: [],
      currentChoiceTopicId: null,
      currentChoiceOptionIds: [],
      currentChoiceAttemptCount: 0,
      currentChoiceClickedOptionIds: [],
      spellQueueTopicIds: [1],
      spellRetryQueueTopicIds: [2],
      spellRetryTopicIds: [2],
      currentSpellTopicId: 2,
      currentSpellWrong: true,
    };
    const flow = ReviewFlow.restore(initData, spellState);
    expect(flow.exportState()).toEqual(spellState);
    expect(flow.getSnapshot().spellState?.isWrong).toBe(true);
    expect(flow.getSnapshot().spellState?.retryCount).toBe(1);
  });
});
