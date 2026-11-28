import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ProcessIterator } from './ProcessIterator';
import { Study } from './Study';
import {
  getLocalPlanDate,
  studySessionStore,
} from './sessionStore';
import type { LearnSessionDraft, LearnSessionState, ReviewSessionState } from './sessionTypes';
import type { StudyUIModel } from './types';
import type { UserRoadMapElementV2 } from '../../types';
import { createEmptyBookStateSnapshot, createTopicLearnRecord } from '../../types/studyRecord';
import { studyRecordStore } from './recordStore';
import { mutateStudyAccount } from './database';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const createModel = (topicId: number): StudyUIModel => ({
  topicId,
  word: `word-${topicId}`,
  collected: false,
  front: {
    media: null,
    accent: { us: '', uk: '', usAudio: '', ukAudio: '' },
    options: [],
    chnMean: '',
  },
  back: { cnMeans: [], sentences: [] },
  extensions: { enMeans: [], phrases: [], variants: [], synonyms: [], antonyms: [], similars: [] },
});

const createLearnState = (): LearnSessionState => ({
  sessionId: 'session-1',
  question: { questionId: 'current-question', topicId: 1, phase: 'understanding', hadWrong: true, elapsedTime: 600, committed: true },
  wordTopicIds: [1, 2],
  process: {
    currentIteratorIndex: 1,
    queues: { recognition: [], understanding: [2], mastery: [1, 2] },
  },
  currentCard: {
    topicId: 1,
    stage: 'understanding',
    showAnswer: true,
    attemptCount: 2,
    clickedOptionIds: [9],
  },
  failMap: { 1: 2 },
  useTimeMap: { 1: 1200 },
  elapsedTime: 5000,
  currentWordElapsedTime: 600,
});

beforeEach(async () => {
    await studyRecordStore.closeDatabase();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
    await studyRecordStore.initialize();
});
afterEach(() => studyRecordStore.closeDatabase());

describe('studySessionStore', () => {

  it('saves, loads, expires and clears a versioned draft', async () => {
    const draft: LearnSessionDraft = {
      version: 1,
      mode: 'learn',
      bookId: 10,
      planDate: getLocalPlanDate(),
      createdAt: 1,
      updatedAt: 2,
      sessionId: 'session-1',
      state: createLearnState(),
    };

    expect(await studySessionStore.save(draft)).toBe(true);
    expect(studySessionStore.load('learn', 10)).toEqual(draft);
    await studySessionStore.removeExpired('2000-01-01');
    expect(studySessionStore.load('learn', 10)).toBeNull();
  });

  it('ignores and cleans corrupted old storage without loading a draft', async () => {
    await studyRecordStore.closeDatabase();
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    window.localStorage.setItem('study-session-store', '{bad json');
    await studyRecordStore.initialize();
    expect(studySessionStore.load('learn', 1)).toBeNull();
    expect(window.localStorage.getItem('study-session-store')).toBeNull();
  });

  it('ignores malformed current drafts and permits a fresh session', async () => {
    const valid = studySessionStore.buildCheckpoint('learn', 10, createLearnState());
    await mutateStudyAccount((account) => {
      account.drafts['learn:10'] = { ...valid, state: null } as unknown as LearnSessionDraft;
    });
    expect(studySessionStore.load('learn', 10)).toBeNull();
    expect(await studySessionStore.save(valid)).toBe(true);
    expect(studySessionStore.load('learn', 10)).toEqual(valid);
    await mutateStudyAccount((account) => {
      account.drafts['learn:10'] = { ...valid, state: { ...valid.state, sessionId: 'mismatched' } };
    });
    expect(studySessionStore.load('learn', 10)).toBeNull();
    expect(await studySessionStore.save(valid)).toBe(true);
  });

  it.each(['missing question', 'missing question ID'])('ignores an active learn draft with %s and retains saved records', async (damage) => {
    const valid = studySessionStore.buildCheckpoint('learn', 10, createLearnState());
    await mutateStudyAccount((account) => {
      account.books[10] = createEmptyBookStateSnapshot({ totalRecords: {
        1: createTopicLearnRecord({ bookId: 10, topicId: 1, doNum: 7, topicScore: 5 }),
      } });
      account.drafts['learn:10'] = { ...valid, state: {
        ...valid.state,
        question: damage === 'missing question' ? undefined : { ...valid.state.question!, questionId: '' },
      } };
    });
    await studyRecordStore.closeDatabase();
    await studyRecordStore.initialize();
    expect(studySessionStore.load('learn', 10)).toBeNull();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(7);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
    const fresh = studySessionStore.buildCheckpoint('learn', 10, {
      ...createLearnState(), sessionId: 'fresh-session',
    });
    expect(await studySessionStore.save(fresh)).toBe(true);
    expect(studySessionStore.load('learn', 10)?.sessionId).toBe('fresh-session');
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(7);
  });

  it('ignores an active review draft without its question and preserves the account', async () => {
    const state: ReviewSessionState = {
      sessionId: 'review-session', wordTopicIds: [1], stage: 'choice',
      question: { questionId: 'review-question', topicId: 1, phase: 'choice', elapsedTime: 100, hadWrong: false, committed: false },
      completedChoiceWords: 0, completedSpellWords: 0,
      records: [{ topicId: 1, word: 'word-1', errorCount: 0, completedAt: null, reviewStartedAt: 100,
        savedStudyRecord: false, choicePassed: false, spellingPassed: false, choiceFailed: false, spellingFailed: false,
        activeTime: 100, scoreSettled: false, scoreBeforeReview: 5, reviewRoundBeforeReview: 1 }],
      choiceQueueTopicIds: [], choiceRetryQueueTopicIds: [], choiceRetryTopicIds: [],
      currentChoiceTopicId: 1, currentChoiceOptionIds: [1, 2], currentChoiceAttemptCount: 0, currentChoiceClickedOptionIds: [],
      detailTopicId: null, detailReason: null, spellQueueTopicIds: [1], spellRetryQueueTopicIds: [], spellRetryTopicIds: [],
      currentSpellTopicId: null, currentSpellWrong: false,
    };
    const valid = studySessionStore.buildCheckpoint('review', 10, state);
    expect(await studySessionStore.save(valid)).toBe(true);
    await mutateStudyAccount((account) => {
      account.books[10] = createEmptyBookStateSnapshot({ totalRecords: {
        1: createTopicLearnRecord({ bookId: 10, topicId: 1, doNum: 7, topicScore: 5 }),
      } });
      account.drafts['review:10'] = { ...valid, state: { ...state, question: undefined } };
    });
    await studyRecordStore.closeDatabase();
    await studyRecordStore.initialize();
    expect(studySessionStore.load('review', 10)).toBeNull();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(7);
    expect(await studySessionStore.save(valid)).toBe(true);
    expect(studySessionStore.load('review', 10)?.state.question?.questionId).toBe('review-question');
  });

  it('does not load expired drafts or accept malformed writes', async () => {
    const draft = studySessionStore.buildCheckpoint('learn', 10, createLearnState());
    expect(await studySessionStore.save({ ...draft, planDate: '2000-01-01' })).toBe(true);
    expect(studySessionStore.load('learn', 10)).toBeNull();
    expect(await studySessionStore.save({ ...draft, state: { ...draft.state, failMap: null } } as unknown as LearnSessionDraft)).toBe(false);
    await studySessionStore.removeExpired(getLocalPlanDate());
    expect(studySessionStore.load('learn', 10)).toBeNull();
  });

  it('uses a local calendar date instead of UTC slicing', () => {
    expect(getLocalPlanDate(new Date(2026, 6, 7, 23, 30))).toBe('2026-07-07');
  });
});

describe('learn flow snapshots', () => {
  it('does not report negative progress when the first word is put back', () => {
    const models = [1, 2, 3, 4, 5].map(createModel);
    const iterator = new ProcessIterator(models);
    const current = iterator.next();

    expect(current?.getId()).toBe(1);
    expect(iterator.getProgress(current?.getId())).toBe(0);

    iterator.putback(models[0]);

    expect(iterator.getProgress(current?.getId())).toBe(0);
  });

  it('round-trips iterator queues', () => {
    const models = [createModel(1), createModel(2)];
    const state = createLearnState().process;
    expect(ProcessIterator.restore(models, state).exportState()).toEqual(state);
  });

  it('restores the current card, retries, statistics and clocks', () => {
    const models = [createModel(1), createModel(2)];
    const words = [
      { topic_id: 1, tag_id: 1 },
      { topic_id: 2, tag_id: 2 },
    ] as UserRoadMapElementV2[];
    const restored = Study.restore(
      words,
      models,
      { planType: 'XModelNewStudy', bookId: 10 },
      createLearnState(),
    ).exportState();

    expect(restored.process).toEqual(createLearnState().process);
    expect(restored.currentCard).toEqual(createLearnState().currentCard);
    expect(restored.failMap).toEqual({ 1: 2 });
    expect(restored.useTimeMap).toEqual({ 1: 1200 });
    expect(restored.elapsedTime).toBeGreaterThanOrEqual(5000);
    expect(restored.currentWordElapsedTime).toBeGreaterThanOrEqual(600);
  });

  it('uses formal killed records to remove stale cards from an old draft', async () => {
    await mutateStudyAccount((account) => {
      account.books[10] = createEmptyBookStateSnapshot({ totalRecords: {
        1: createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 }),
      } });
    });
    const models = [createModel(1), createModel(2)];
    const words = [
      { topic_id: 1, tag_id: 1 },
      { topic_id: 2, tag_id: 2 },
    ] as UserRoadMapElementV2[];
    const study = Study.restore(
      words,
      models,
      { planType: 'XModelNewStudy', bookId: 10 },
      createLearnState(),
    );

    await study.resume();

    expect(study.getCurrentWord()?.getId()).toBe(2);
    expect(study.exportState().killedTopicIds).toEqual([1]);
    expect(Object.values(study.exportState().process.queues).flat()).not.toContain(1);
  });

  it('keeps a word skipped for the current session after it is un-killed elsewhere', async () => {
    await mutateStudyAccount((account) => {
      account.books[10] = createEmptyBookStateSnapshot({ totalRecords: {
        1: createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: 5 }),
      } });
    });
    const models = [createModel(1), createModel(2)];
    const words = [
      { topic_id: 1, tag_id: 1 },
      { topic_id: 2, tag_id: 2 },
    ] as UserRoadMapElementV2[];
    const study = Study.restore(
      words,
      models,
      { planType: 'XModelNewStudy', bookId: 10 },
      { ...createLearnState(), killedTopicIds: [1] },
    );

    await study.resume();

    expect(study.getCurrentWord()?.getId()).toBe(2);
    expect(study.exportState().killedTopicIds).toEqual([1]);
  });
});
