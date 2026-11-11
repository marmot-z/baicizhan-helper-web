import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRoadMapElementV2 } from '../../types';
import {
  createEmptyHomeState,
  createTopicLearnRecord,
  isKilledScore,
  toKilledScore,
  toUnkilledScore,
} from '../../types/studyRecord';
import { calculateHomeState } from './homeStateCalculator';
import { ProcessIterator } from './ProcessIterator';
import { applyDayTransition, applyKill, applyUnkill } from './recordReducers';
import { Study } from './Study';
import type { StudyUIModel } from './types';
import { wordStatusService } from './wordStatusService';
import { studyRecordStore } from './recordStore';
import { studyService } from '../studyService';
import { useStudyStore } from '../../stores/studyStore';
import { ApiService } from '../api';
import { ReviewFlow } from '../review/ReviewFlow';
import { reviewService } from '../review/reviewService';
import { feedbackSoundPlayer } from '../../utils/feedbackSound';
import type { LearnSessionState } from './sessionTypes';

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
    chnMean: `meaning-${topicId}`,
  },
  back: { cnMeans: [], sentences: [] },
  extensions: { enMeans: [], phrases: [], variants: [], synonyms: [], antonyms: [], similars: [] },
});

const createRoadmapWord = (topicId: number) => ({
  topic_id: topicId,
  word_level_id: 10,
  tag_id: topicId,
  options: [],
}) satisfies UserRoadMapElementV2;

describe('kill score protocol', () => {
  it.each([
    [-1024, -1],
    [0, -1],
    [1, -1],
    [4, -4],
    [9, -9],
    [12, -9],
    [-3, -3],
  ])('converts %i to killed score %i', (score, expected) => {
    expect(toKilledScore(score)).toBe(expected);
    expect(isKilledScore(expected)).toBe(true);
  });

  it.each([
    [-1, 5],
    [-4, 5],
    [-5, 5],
    [-8, 8],
    [-9, 9],
  ])('restores %i to APP-compatible score %i', (score, expected) => {
    expect(toUnkilledScore(score)).toBe(expected);
  });

  it('records kill once and does not turn negative scores positive across days', () => {
    const killed = applyKill(undefined, {
      bookId: 10,
      topicId: 1,
      usedTime: 800,
      doNumDelta: 1,
      errNumDelta: 0,
      now: new Date(2026, 6, 17, 10).getTime(),
      isFirstDoAtToday: true,
    });
    expect(killed.topicScore).toBe(-1);
    expect(killed.doNum).toBe(1);
    expect(killed.totalTime).toBe(800);
    expect(applyKill(killed, {
      bookId: 10,
      topicId: 1,
      usedTime: 100,
      doNumDelta: 1,
    })).toBe(killed);

    const nextDay = applyDayTransition(killed, {
      now: new Date(2026, 6, 18, 10).getTime(),
    });
    expect(nextDay.topicScore).toBe(-1);
    expect(nextDay.topicDay).toBe(1);
    expect(nextDay.isTodayNew).toBe(false);

    const restored = applyUnkill(killed, {
      bookId: 10,
      topicId: 1,
      doNumDelta: 0,
      now: new Date(2026, 6, 18, 10).getTime(),
    });
    expect(restored.topicScore).toBe(5);
    expect(restored.doNum).toBe(1);
  });
});

describe('killed word scheduling', () => {
  it('counts a newly killed word as learned but excludes it from learn and review pools', () => {
    const killedRecord = createTopicLearnRecord({
      bookId: 10,
      topicId: 1,
      topicScore: -1,
      isTodayNew: true,
    });
    const state = calculateHomeState({
      records: { 1: killedRecord },
      roadmap: [createRoadmapWord(1), createRoadmapWord(2)],
      learnPlanCount: 2,
      reviewPlanCount: 2,
    });

    expect(state.killedWords.map((word) => word.topic_id)).toEqual([1]);
    expect(state.todayLearnedWords.map((word) => word.topic_id)).toEqual([1]);
    expect(state.unlearnedWords.map((word) => word.topic_id)).toEqual([2]);
    expect(state.unreviewedWords).toEqual([]);
  });

  it('preserves the APP today-reviewed classification for a review word killed today', () => {
    const killedRecord = createTopicLearnRecord({
      bookId: 10,
      topicId: 1,
      topicScore: -5,
      topicDay: 0,
      isTodayNew: false,
    });
    const state = calculateHomeState({
      records: { 1: killedRecord },
      roadmap: [createRoadmapWord(1)],
      learnPlanCount: 1,
      reviewPlanCount: 1,
    });

    expect(state.killedWords.map((word) => word.topic_id)).toEqual([1]);
    expect(state.todayReviewedWords.map((word) => word.topic_id)).toEqual([1]);
    expect(state.unreviewedWords).toEqual([]);
  });

  it('removes a topic from all three learning queues', () => {
    const iterator = new ProcessIterator([createModel(1), createModel(2)]);
    iterator.removeTopic(1);
    const state = iterator.exportState();
    expect(state.queues.recognition).toEqual([2]);
    expect(state.queues.understanding).toEqual([2]);
    expect(state.queues.mastery).toEqual([2]);
  });
});

describe('wordStatusService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
    useStudyStore.setState({
      wordList: [createRoadmapWord(1)],
      wordListBookId: 10,
      learnRecords: {},
      homeState: createEmptyHomeState(),
      studyPlan: {
        book_id: 10,
        learned_words_count: 0,
        group_id: 0,
        daily_plan_count: 1,
        review_plan_count: 0,
      },
    });
    vi.spyOn(
      useStudyStore.getState(),
      'syncCurrentBookState'
    ).mockResolvedValue();
  });

  it('persists a killed word, updates live lists and queues the remote payload', () => {
    const killed = wordStatusService.killWord({
      bookId: 10,
      topicId: 1,
      tagId: 7,
      isTodayNew: true,
    });

    expect(killed.topicScore).toBe(-1);
    expect(studyRecordStore.getRecord(10, 1)?.topicScore).toBe(-1);
    expect(
      studyRecordStore
        .getPendingDoneRecords(10)
        .map((item) => item.doneRecord.current_score)
    ).toEqual([-1]);
    expect(useStudyStore.getState().learnRecords[1]?.topicScore).toBe(-1);
    expect(
      useStudyStore
        .getState()
        .homeState.killedWords.map((word) => word.topic_id)
    ).toEqual([1]);
    expect(useStudyStore.getState().syncCurrentBookState).toHaveBeenCalledWith(
      10
    );
  });

  it('replaces the pending kill with an unkill and moves the word out of killed lists', () => {
    wordStatusService.killWord({
      bookId: 10,
      topicId: 1,
      isTodayNew: true,
    });

    const restored = wordStatusService.unkillWord(10, 1);

    expect(restored.topicScore).toBe(5);
    expect(studyRecordStore.getRecord(10, 1)?.topicScore).toBe(5);
    expect(
      studyRecordStore
        .getPendingDoneRecords(10)
        .map((item) => item.doneRecord.current_score)
    ).toEqual([5]);
    expect(useStudyStore.getState().homeState.killedWords).toEqual([]);
    expect(
      useStudyStore
        .getState()
        .homeState.todayLearnedWords.map((word) => word.topic_id)
    ).toEqual([1]);
  });

  it('rejects unkill when the word is not currently killed', () => {
    expect(() => wordStatusService.unkillWord(10, 1)).toThrow(
      '该单词当前不是已斩状态'
    );
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
  });
});

describe('Study.killCurrent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
    useStudyStore.setState({ lastStudyStatistics: null });
  });

  it('persists once, removes retries and advances to the next word', async () => {
    const killSpy = vi.spyOn(wordStatusService, 'killWord').mockReturnValue(
      createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 }),
    );
    const study = new Study(
      [createRoadmapWord(1), createRoadmapWord(2)],
      [createModel(1), createModel(2)],
      { bookId: 10, planType: 'XModelNewStudy' },
    );
    await study.start();
    study.getFailMap().set(1, 2);

    await Promise.all([study.killCurrent(), study.killCurrent()]);

    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(killSpy).toHaveBeenCalledWith(expect.objectContaining({ topicId: 1, errNumDelta: 2 }));
    expect(study.getCurrentWord()?.getId()).toBe(2);
    expect(study.exportState().killedTopicIds).toEqual([1]);
    expect(Object.values(study.exportState().process.queues).flat()).not.toContain(1);
    expect(study.getAllWords().map((word) => word.topicId)).toEqual([2]);
  });

  it('completes normally when the final word is killed', async () => {
    vi.spyOn(wordStatusService, 'killWord').mockReturnValue(
      createTopicLearnRecord({ bookId: 10, topicId: 1, topicScore: -1 }),
    );
    const study = new Study(
      [createRoadmapWord(1)],
      [createModel(1)],
      { bookId: 10, planType: 'XModelNewStudy' },
    );
    const completeSpy = vi.spyOn(study, 'complete').mockImplementation(async () => {
      study.completed = true;
    });
    await study.start();
    await study.killCurrent();
    expect(completeSpy).toHaveBeenCalledOnce();
    expect(study.completed).toBe(true);
  });

  it('does not overwrite the negative record during real completion', async () => {
    const killed = createTopicLearnRecord({
      bookId: 10,
      topicId: 1,
      topicScore: -1,
      doNum: 1,
      isTodayNew: true,
    });
    studyRecordStore.upsertRecord(10, killed);
    vi.spyOn(wordStatusService, 'killWord').mockReturnValue(killed);
    vi.spyOn(studyService, 'xModeDaka').mockResolvedValue();
    vi.spyOn(studyService, 'reportEvent').mockResolvedValue();
    vi.spyOn(studyService, 'reportFinishDailyPlan').mockResolvedValue();
    vi.spyOn(useStudyStore.getState(), 'syncCurrentBookState').mockResolvedValue();
    const study = new Study(
      [createRoadmapWord(1)],
      [createModel(1)],
      { bookId: 10, planType: 'XModelNewStudy' },
    );

    await study.start();
    await study.killCurrent();

    expect(study.completed).toBe(true);
    expect(studyRecordStore.getRecord(10, 1)?.topicScore).toBe(-1);
    expect(useStudyStore.getState().lastStudyStatistics?.killedTopicIds).toEqual([1]);
  });
});

describe('sessions with unavailable word resources', () => {
  const roadmap = [1, 2, 3].map(createRoadmapWord);
  const learnContext = { bookId: 10, planType: 'XModelNewStudy' };

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
    useStudyStore.setState({
      wordList: roadmap,
      wordListBookId: 10,
      syncedBookId: 10,
      homeState: createEmptyHomeState(),
      learnRecords: {},
      lastStudyStatistics: null,
    });
    vi.spyOn(useStudyStore.getState(), 'syncCurrentBookState').mockResolvedValue();
    vi.spyOn(studyService, 'reportEvent').mockResolvedValue();
    vi.spyOn(studyService, 'reportFinishDailyPlan').mockResolvedValue();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('resumes learning at the same stage after removing the unavailable card and retries', async () => {
    const state: LearnSessionState = {
      wordTopicIds: [1, 2, 3],
      process: { currentIteratorIndex: 1, queues: { recognition: [], understanding: [2, 3], mastery: [1, 2, 3] } },
      currentCard: { topicId: 2, stage: 'understanding', showAnswer: false, attemptCount: 1, clickedOptionIds: [10] },
      failMap: { 1: 1, 2: 2 },
      useTimeMap: { 1: 100, 2: 200 },
      elapsedTime: 400,
      currentWordElapsedTime: 50,
    };
    const study = Study.restore(roadmap, [createModel(1), createModel(3)], learnContext, state);

    await study.resume();

    expect(study.getCurrentWord()).toMatchObject({ stage: 'understanding', uiModel: { topicId: 3 } });
    expect(study.exportState()).toMatchObject({
      wordTopicIds: [1, 3],
      failMap: { 1: 1 },
      useTimeMap: { 1: 100 },
      process: { currentIteratorIndex: 1, queues: { recognition: [], understanding: [], mastery: [1, 3] } },
    });
    expect(study.getFailMap().has(2)).toBe(false);
    expect(study.getUseTimeMap().has(2)).toBe(false);
  });

  it('completes learning for the available words and leaves the missing word pending', async () => {
    vi.spyOn(studyService, 'xModeDaka').mockResolvedValue();
    const study = new Study(roadmap, [createModel(1), createModel(3)], learnContext);

    await study.start();
    for (const topicId of [1, 1, 3, 3, 1, 3, 1, 3]) {
      expect(study.getCurrentWord()?.getId()).toBe(topicId);
      await study.pass();
    }

    expect(study.completed).toBe(true);
    expect(studyRecordStore.getAllRecords(10).map((record) => record.topicId)).toEqual([1, 3]);
    expect(studyRecordStore.getPendingDoneRecords(10).map((record) => record.topicId)).toEqual([1, 3]);
    expect(useStudyStore.getState().homeState.unlearnedWords.map((word) => word.topic_id)).toEqual([2]);
    expect(studyService.reportFinishDailyPlan).toHaveBeenCalledWith(10, 2, 2, false);
  });

  it('continues a partial review after a failed batch and only saves completed words', async () => {
    const priorRecords = roadmap.map((word) => createTopicLearnRecord({ bookId: 10, topicId: word.topic_id, topicScore: 2 }));
    studyRecordStore.upsertRecords(10, priorRecords);
    useStudyStore.getState().loadLocalLearnRecords(10);
    useStudyStore.getState().recomputeHomeState(10);
    vi.spyOn(studyService, 'getSettings').mockResolvedValue();
    vi.spyOn(studyService, 'getCreditStatus').mockResolvedValue({
      inExperiment: false, reviewCreditObtained: false, studyCreditObtained: false,
    });
    vi.spyOn(studyService, 'getStudyRecord').mockResolvedValue();
    vi.spyOn(studyService, 'saveStudyRecord').mockResolvedValue();
    vi.spyOn(feedbackSoundPlayer, 'playCorrect').mockImplementation(() => {});
    vi.spyOn(ApiService, 'post')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ code: 200, success: true, data: [null, null, null] })
      .mockResolvedValueOnce({
        code: 200,
        success: true,
        data: [3, 1].map((topicId) => ({ resource: { word: { topicId, word: `word-${topicId}` } } })),
      });

    await expect(reviewService.initializeReviewWords(10, 3, [1, 2, 3])).rejects.toThrow('network error');
    await expect(reviewService.initializeReviewWords(10, 3, [1, 2, 3])).rejects.toThrow('本轮单词暂时无法加载');
    const initData = await reviewService.initializeReviewWords(10, 3, [1, 2, 3]);
    expect(initData.missingTopicIds).toEqual([2]);
    expect([...initData.roadmapMap.keys()]).toEqual([1, 3]);

    const flow = new ReviewFlow(initData);
    await flow.start();
    for (const topicId of [1, 3]) {
      expect(flow.getSnapshot().choiceState?.word.topicId).toBe(topicId);
      await flow.chooseOption(topicId);
    }

    for (const topicId of [1, 3]) {
      expect(flow.getSnapshot().spellState?.word.topicId).toBe(topicId);
      await flow.submitSpell(`word-${topicId}`);
    }

    expect(flow.getSnapshot().summaryState).toMatchObject({ totalWords: 2, completedWords: 2 });
    expect(studyRecordStore.getRecord(10, 2)).toEqual(priorRecords[1]);
    expect(studyRecordStore.getPendingDoneRecords(10).map((record) => record.topicId)).toEqual([1, 3]);
    expect(useStudyStore.getState().homeState.unreviewedWords.map((word) => word.topic_id)).toEqual([2]);
    expect(studyService.saveStudyRecord).not.toHaveBeenCalledWith(10, 2, expect.any(Number));
  });
});
