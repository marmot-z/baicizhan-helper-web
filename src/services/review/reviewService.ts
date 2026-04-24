import { studyService } from '../studyService';
import type { StudyOption, StudyUIModel } from '../study/types';
import { applyReviewCorrect, applyReviewWrong, studyRecordStore } from '../study';
import { toUserDoneWordRecord } from '../study/uploadAdapter';
import type { UserRoadMapElementV2 } from '../../types';
import { useStudyStore } from '../../stores/studyStore';
import type {
  ReviewContext,
  ReviewDisplayPhase,
  ReviewInitData,
  ReviewWordRecord,
} from './types';

const REVIEW_DETAIL_STAT_GROUP = 'study-detail-common';
const REVIEW_FINISH_STAT_GROUP = 'main-study';
const REVIEW_PLAN_TYPE = 'XModelReviewStudy';
const DETAIL_PLAN_TYPE = 'XModelNewStudy';
const DETAIL_CHANNEL = 'study_mainstream';

export const reviewService = {
  async initializeReviewWords(
    bookId: number,
    reviewPlanCount: number,
    _roadmapWords: UserRoadMapElementV2[]
  ): Promise<ReviewInitData> {
    await useStudyStore.getState().syncCurrentBookState(bookId);
    const { homeState, syncedBookId } = useStudyStore.getState();

    if (syncedBookId !== bookId) {
      return {
        words: [],
        roadmapMap: new Map(),
        context: {
          bookId,
          planType: REVIEW_PLAN_TYPE,
        },
      };
    }

    const targetCount = reviewPlanCount || 10;
    const reviewWords = homeState.unreviewedWords.slice(0, targetCount);

    if (!reviewWords.length) {
      return {
        words: [],
        roadmapMap: new Map(),
        context: {
          bookId,
          planType: REVIEW_PLAN_TYPE,
        },
      };
    }

    const topicIds = reviewWords.map((word) => word.topic_id);
    await studyService.getSettings();
    await studyService.getCreditStatus();
    const words = await studyService.getXModeWordDetails(bookId, topicIds);
    await studyService.getStudyRecord(bookId, topicIds);

    return {
      words,
      roadmapMap: new Map(reviewWords.map((word) => [word.topic_id, word])),
      context: {
        bookId,
        planType: REVIEW_PLAN_TYPE,
      },
    };
  },

  async getChoiceOptions(
    word: StudyUIModel,
    _roadmapMap: Map<number, UserRoadMapElementV2>
  ): Promise<StudyOption[]> {
    if (!word.front.options.length) {
      return [
        {
          id: word.topicId,
          word: word.word,
          translation: word.front.chnMean,
          isCorrect: true,
        },
      ];
    }

    return word.front.options;
  },

  shuffleOptions(options: StudyOption[]): StudyOption[] {
    const shuffled = [...options];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  },

  async reportWordShown(
    word: StudyUIModel,
    phase: ReviewDisplayPhase
  ): Promise<void> {
    const strategyId = phase === 'choice' ? 'q2' : 'q4';
    await studyService.reportEvent(
      'strategy_study_enter',
      JSON.stringify({
        topic_id: word.topicId,
        strategy_id: strategyId,
        plan_type: REVIEW_PLAN_TYPE,
      }),
      REVIEW_DETAIL_STAT_GROUP
    );
  },

  async reportChoiceResult(
    word: StudyUIModel,
    choiceTopicId: number,
    isCorrect: boolean
  ): Promise<void> {
    await studyService.reportEvent(
      'choose_in_recite_click',
      JSON.stringify({
        topic_id: word.topicId,
        strategy_id: 'q2',
        choice_topic_id: choiceTopicId,
        is_right: isCorrect ? 1 : 0,
        plan_type: REVIEW_PLAN_TYPE,
      }),
      REVIEW_DETAIL_STAT_GROUP
    );
  },

  async reportSpellResult(
    word: StudyUIModel,
    isCorrect: boolean
  ): Promise<void> {
    await studyService.reportEvent(
      'choose_in_recite_click',
      JSON.stringify({
        topic_id: word.topicId,
        strategy_id: 'q4',
        choice_topic_id: null,
        is_right: isCorrect ? 1 : 0,
        plan_type: REVIEW_PLAN_TYPE,
      }),
      REVIEW_DETAIL_STAT_GROUP
    );
  },

  async reportWordDetailShown(word: StudyUIModel, context: ReviewContext): Promise<void> {
    await studyService.reportEvent(
      'topic_wiki_show',
      JSON.stringify({
        topic_id: word.topicId,
        book_id: context.bookId,
        channel: DETAIL_CHANNEL,
        plan_type: DETAIL_PLAN_TYPE,
      }),
      REVIEW_DETAIL_STAT_GROUP
    );
  },

  async reportReviewFinished(): Promise<void> {
    await studyService.reportEvent(
      'finish-normal-plan',
      JSON.stringify({
        plan_type: REVIEW_PLAN_TYPE,
      }),
      REVIEW_FINISH_STAT_GROUP
    );
  },

  async finishReview(records: ReviewWordRecord[], context: ReviewContext): Promise<void> {
    const updatedAt = Date.now();
    const nextRecords = records.map((reviewRecord) => {
      const existingRecord = studyRecordStore.getRecord(context.bookId, reviewRecord.topicId);
      const usedTime =
        reviewRecord.completedAt && reviewRecord.reviewStartedAt
          ? Math.max(0, reviewRecord.completedAt - reviewRecord.reviewStartedAt)
          : 0;

      const nextScore =
        reviewRecord.errorCount === 0
          ? Math.max(existingRecord?.topicScore ?? 0, 5)
          : Math.min(Math.max(existingRecord?.topicScore ?? 0, 0), 4);

      const input = {
        bookId: context.bookId,
        topicId: reviewRecord.topicId,
        usedTime,
        doNumDelta: 1,
        errNumDelta: reviewRecord.errorCount,
        now: reviewRecord.completedAt ?? updatedAt,
        isFirstDoAtToday: false,
        nextScore,
        nextSpanDays: existingRecord?.topicDay ?? 0,
        nextReviewRound:
          reviewRecord.errorCount === 0
            ? (existingRecord?.reviewRound ?? 0) + 1
            : existingRecord?.reviewRound ?? 0,
      };

      if (reviewRecord.errorCount === 0) {
        return applyReviewCorrect(existingRecord, input);
      }

      return applyReviewWrong(existingRecord, input);
    });

    studyRecordStore.upsertRecords(context.bookId, nextRecords);
    const store = useStudyStore.getState();
    store.loadLocalLearnRecords(context.bookId);
    store.recomputeHomeState(context.bookId);

    const uploadedRecords = records
      .map((reviewRecord) =>
        studyRecordStore.getRecord(context.bookId, reviewRecord.topicId),
      )
      .filter((record) => record != null)
      .map((record) => toUserDoneWordRecord(record));

    if (!uploadedRecords.length) {
      console.warn('No local review records found for upload.');
      return;
    }

    const { wordList, wordListBookId } = store;
    const currentRoadmap =
      wordListBookId === context.bookId ? wordList : [];
    const wordLevelId =
      currentRoadmap.find((word) => records.some((record) => record.topicId === word.topic_id))
        ?.word_level_id ?? 0;

    await studyService.updateDoneData(uploadedRecords, wordLevelId);
    await studyService.reportFinishDailyPlan(
      context.bookId,
      records.length,
      0,
      store.homeState.unlearnedWords.length === 0,
    );
  },
};
