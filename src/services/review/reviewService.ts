import { accountSession } from '../accountSession';
import { studyService } from '../studyService';
import type { StudyOption, StudyUIModel } from '../study/types';
import type { UserRoadMapElementV2 } from '../../types';
import { applyReviewCorrect, applyReviewWrong, studyRecordStore } from '../study';
import { toPendingDoneRecord } from '../study/uploadAdapter';
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

const runOptionalReviewInitialization = (bookId: number, topicIds: number[]) => {
  const requests = [
    ['复习设置', studyService.getSettings()],
    ['信用状态', studyService.getCreditStatus()],
    ['远端学习记录', studyService.getStudyRecord(bookId, topicIds)],
  ] as const;

  requests.forEach(([label, request]) => {
    void request.catch((error) => {
      console.warn(`${label}加载失败，继续使用本地复习状态:`, error);
    });
  });
};

export const reviewService = {
  async initializeReviewWords(
    bookId: number,
    reviewPlanCount: number,
    resumeTopicIds?: number[],
  ): Promise<ReviewInitData> {
    await useStudyStore.getState().syncCurrentBookState(bookId);
    const { homeState, syncedBookId, wordList } = useStudyStore.getState();

    if (syncedBookId !== bookId) {
      throw new Error('当前书学习状态同步未完成，请重新加载');
    }

    const targetCount = reviewPlanCount || 10;
    const roadmapByTopicId = new Map(wordList.map((word) => [word.topic_id, word]));
    const reviewWords = resumeTopicIds
      ? resumeTopicIds
          .map((topicId) => roadmapByTopicId.get(topicId))
          .filter((word): word is UserRoadMapElementV2 => word !== undefined)
      : homeState.unreviewedWords.slice(0, targetCount);

    const topicIds = reviewWords.map((word) => word.topic_id);
    const { words, missingTopicIds } = await studyService.getXModeWordDetails(bookId, topicIds);

    if ((resumeTopicIds ?? topicIds).length > 0 && words.length === 0) {
      throw new Error('本轮单词暂时无法加载，请重新加载');
    }

    const availableIds = new Set(words.map((word) => word.topicId));
    if (words.length > 0) {
      // 这三个接口只用于对齐百词斩 X 模式的辅助初始化，当前页面不消费其返回值。
      runOptionalReviewInitialization(bookId, [...availableIds]);
    }

    const availableRoadmapWords = reviewWords.filter((word) => availableIds.has(word.topic_id));
    return {
      words,
      missingTopicIds: resumeTopicIds ? resumeTopicIds.filter((topicId) => !availableIds.has(topicId)) : missingTopicIds,
      roadmapMap: new Map(availableRoadmapWords.map((word) => [word.topic_id, word])),
      context: {
        bookId,
        planType: REVIEW_PLAN_TYPE,
      },
    };
  },

  async getChoiceOptions(word: StudyUIModel): Promise<StudyOption[]> {
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

  async finishReview(
    records: ReviewWordRecord[],
    context: ReviewContext,
    killedTopicIds: number[],
  ): Promise<void> {
    const version = accountSession.getVersion();
    const updatedAt = Date.now();
    const killedTopicIdSet = new Set(killedTopicIds);
    const nextRecords = records
      .filter((reviewRecord) => !killedTopicIdSet.has(reviewRecord.topicId))
      .map((reviewRecord) => {
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

    studyRecordStore.queuePendingDoneRecords(
      context.bookId,
      nextRecords.map((record) => toPendingDoneRecord(record)),
    );
    void store.syncCurrentBookState(context.bookId).then(() => {
      accountSession.assertCurrent(version);
      const latestHomeState = useStudyStore.getState().homeState;
      return studyService.reportFinishDailyPlan(
        context.bookId,
        records.length,
        0,
        latestHomeState.unlearnedWords.length === 0,
      );
    }).catch(console.error);
  },
};
