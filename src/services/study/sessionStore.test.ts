import { beforeEach, describe, expect, it } from 'vitest';
import { ProcessIterator } from './ProcessIterator';
import { Study } from './Study';
import {
  getLocalPlanDate,
  studySessionStore,
} from './sessionStore';
import type { LearnSessionDraftV1, LearnSessionState } from './sessionTypes';
import type { StudyUIModel } from './types';
import type { UserRoadMapElementV2 } from '../../types';

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

describe('studySessionStore', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
  });

  it('saves, loads, expires and clears a versioned draft', () => {
    const draft: LearnSessionDraftV1 = {
      version: 1,
      mode: 'learn',
      bookId: 10,
      planDate: '2026-07-17',
      createdAt: 1,
      updatedAt: 2,
      sessionId: 'session-1',
      state: createLearnState(),
    };

    expect(studySessionStore.save(draft)).toBe(true);
    expect(studySessionStore.load('learn', 10)).toEqual(draft);
    studySessionStore.removeExpired('2026-07-18');
    expect(studySessionStore.load('learn', 10)).toBeNull();
  });

  it('drops corrupted storage safely', () => {
    window.localStorage.setItem('study-session-store', '{bad json');
    expect(studySessionStore.load('learn', 1)).toBeNull();
    expect(window.localStorage.getItem('study-session-store')).toBeNull();
  });

  it('uses a local calendar date instead of UTC slicing', () => {
    expect(getLocalPlanDate(new Date(2026, 6, 7, 23, 30))).toBe('2026-07-07');
  });
});

describe('learn flow snapshots', () => {
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
});
