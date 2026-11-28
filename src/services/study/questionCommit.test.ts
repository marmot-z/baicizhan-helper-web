import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeStudyDatabase, mutateStudyAccount } from './database';
import { Study } from './Study';
import { accountSession } from '../accountSession';
import { ReviewFlow } from '../review/ReviewFlow';
import { studyRecordStore } from './recordStore';
import { studySessionStore } from './sessionStore';
import { studyService } from '../studyService';
import { useStudyStore } from '../../stores/studyStore';
import { createEmptyBookStateSnapshot, createTopicLearnRecord, type TopicLearnRecord } from '../../types/studyRecord';
import { feedbackSoundPlayer } from '../../utils/feedbackSound';
import type { StudyUIModel } from './types';

const word: StudyUIModel = {
  topicId: 1, word: 'one', collected: false,
  front: { media: null, accent: { us: '', uk: '', usAudio: '', ukAudio: '' }, chnMean: '一',
    options: [{ id: 1, word: 'one', translation: '一', isCorrect: true },
      ...[2, 3, 4].map((id) => ({ id, word: 'wrong', translation: '错', isCorrect: false }))] },
  back: { cnMeans: [], sentences: [] },
  extensions: { enMeans: [], phrases: [], variants: [], synonyms: [], antonyms: [], similars: [] },
};
const roadmap = [{ topic_id: 1, word_level_id: 10, tag_id: 7, options: [] }];
const context = { bookId: 10, planType: 'XModelNewStudy' };
let now: number;

beforeEach(async () => {
  vi.restoreAllMocks();
  await closeStudyDatabase();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  await studyRecordStore.initialize();
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.spyOn(studyService, 'reportEvent').mockResolvedValue();
  vi.spyOn(studyService, 'saveStudyRecord').mockResolvedValue();
  vi.spyOn(studyService, 'xModeDaka').mockResolvedValue();
  vi.spyOn(studyService, 'reportFinishDailyPlan').mockResolvedValue();
  vi.spyOn(feedbackSoundPlayer, 'playCorrect').mockImplementation(() => {});
  vi.spyOn(feedbackSoundPlayer, 'playIncorrect').mockImplementation(() => {});
  vi.spyOn(useStudyStore.getState(), 'syncCurrentBookState').mockResolvedValue({
    upload: 'synced', download: 'synced', pendingCount: 0, needsFullPull: false, errors: [],
  });
  useStudyStore.setState({ wordList: roadmap, wordListBookId: 10, lastStudyStatistics: null });
});
afterEach(async () => { vi.restoreAllMocks(); await closeStudyDatabase(); });

const seedRecords = (...records: TopicLearnRecord[]) => mutateStudyAccount((account) => {
  for (const record of records) {
    const book = account.books[record.bookId] ??= createEmptyBookStateSnapshot();
    book.totalRecords[record.topicId] = record;
  }
});

const createStudy = () => new Study(roadmap, [word], context);
const createReview = () => new ReviewFlow({ words: [word], missingTopicIds: [],
  roadmapMap: new Map([[1, roadmap[0]]]), context });

describe('per-question learning commits', () => {
  it('counts one final result after several wrong clicks and excludes paused time', async () => {
    const study = createStudy();
    await study.start();
    const questionId = study.getCurrentQuestionId();
    await study.fail(2, questionId);
    await study.fail(3, questionId);
    expect(studyRecordStore.getPendingDoneRecords(10)).toEqual([]);
    now += 1000;
    study.setPaused(true);
    now += 60000;
    study.setPaused(false);
    now += 2000;
    await study.pass(1, questionId);
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 1, errNum: 1, totalTime: 3000 });
    expect(study.getFailMap().get(1)).toBe(2);
    const saved = studySessionStore.load('learn', 10);
    expect(saved?.state.question).toMatchObject({ questionId, committed: true });
    await study.pass(undefined, questionId);
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
    await study.pass(1, questionId);
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });

  it('rolls back a failed transaction and sends only a new increment after retry', async () => {
    await seedRecords(createTopicLearnRecord({ bookId: 10, topicId: 1,
      doNum: 10, errNum: 4, totalTime: 10000, topicScore: 0 }));
    const study = createStudy();
    await study.start();
    const questionId = study.getCurrentQuestionId();
    vi.spyOn(studyRecordStore, 'commitQuestionResult').mockRejectedValueOnce(new Error('disk full'));
    await expect(study.pass(1, questionId)).rejects.toThrow('disk full');
    expect(study.getCurrentQuestionId()).toBe(questionId);
    expect(study.getCurrentWord()?.showAnswer).toBe(false);
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(10);
    await Promise.all([study.pass(1, questionId), study.pass(1, questionId)]);
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(11);
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord).toMatchObject({ done_times: 1, wrong_times: 0 });
  });

  it('finishes the group without adding counters beyond its three displayed questions', async () => {
    const study = createStudy();
    await study.start();
    await study.pass(1);
    await study.continueFromDetail(study.getCurrentQuestionId());
    await study.pass(1);
    await study.pass(1);
    expect(study.completed).toBe(true);
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(3);
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord.done_times).toBe(3);
    await study.complete();
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(3);
  });

  it('restores a committed answer without recording it twice', async () => {
    const study = createStudy();
    await study.start();
    await study.pass(1);
    const state = study.exportState();
    const restored = Study.restore(roadmap, [word], context, state);
    await restored.resume();
    await restored.pass(undefined, restored.getCurrentQuestionId());
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });

  it('does not treat repeated answer callbacks as Continue and ignores an old account callback', async () => {
    const study = createStudy();
    await study.start();
    const questionId = study.getCurrentQuestionId();
    await study.pass(1, questionId);
    await study.pass(1, questionId);
    expect(study.getCurrentWord()?.stage).toBe('recognition');
    expect(study.getCurrentWord()?.showAnswer).toBe(true);
    accountSession.invalidate();
    await study.continueFromDetail(questionId);
    expect(study.getCurrentWord()?.stage).toBe('recognition');
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
  });

  it('commits exhausted attempts once and assigns a new id to the displayed retry', async () => {
    const study = createStudy();
    await study.start();
    const original = study.getCurrentQuestionId();
    for (const id of [2, 3, 4]) await study.fail(id, original);
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 1, errNum: 1 });
    await study.pass(undefined, original);
    expect(study.getCurrentQuestionId()).not.toBe(original);
    await study.pass(1, study.getCurrentQuestionId());
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 2, errNum: 1 });
  });
});

describe('per-question review commits', () => {
  it('settles choice and spelling counters independently and the score once', async () => {
    await seedRecords(createTopicLearnRecord({ bookId: 10, topicId: 1,
      topicScore: 3, doNum: 10, reviewRound: 4 }));
    const flow = createReview();
    await flow.start();
    const choiceId = flow.getCurrentQuestionId();
    await Promise.all([flow.chooseOption(1, choiceId), flow.chooseOption(1, choiceId)]);
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 11, reviewRound: 4 });
    await flow.submitSpell('one', flow.getCurrentQuestionId());
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 12, reviewRound: 5, topicScore: 5 });
    expect(studyRecordStore.getPendingDoneRecords(10)[0].doneRecord.done_times).toBe(2);
    expect(flow.getSnapshot().stage).toBe('summary');
  });

  it('keeps wrong spelling clicks in one final result and does not settle the retry score twice', async () => {
    const flow = createReview();
    await flow.start();
    await flow.chooseOption(1);
    await flow.submitSpell('wrong');
    flow.clearSpellWrongOnInput();
    await flow.submitSpell('wrong again');
    flow.clearSpellWrongOnInput();
    await flow.submitSpell('one');
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 2, errNum: 1, reviewRound: 0 });
    await flow.submitSpell('one', flow.getCurrentQuestionId());
    expect(studyRecordStore.getRecord(10, 1)).toMatchObject({ doNum: 3, errNum: 1, reviewRound: 0 });
    expect(flow.getSnapshot().stage).toBe('summary');
  });

  it('keeps the current choice when its transaction fails', async () => {
    const flow = createReview();
    await flow.start();
    const questionId = flow.getCurrentQuestionId();
    vi.spyOn(studyRecordStore, 'commitQuestionResult').mockRejectedValueOnce(new Error('disk full'));
    await expect(flow.chooseOption(1, questionId)).rejects.toThrow('disk full');
    expect(flow.getSnapshot().stage).toBe('choice');
    expect(flow.getCurrentQuestionId()).toBe(questionId);
    await flow.chooseOption(1, questionId);
    expect(studyRecordStore.getRecord(10, 1)?.doNum).toBe(1);
    expect(flow.getSnapshot().stage).toBe('spelling');
  });
});
