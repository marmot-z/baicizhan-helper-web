import { accountSession } from '../accountSession';
import { studyService } from '../studyService';
import type { StudyOption, StudyUIModel } from '../study/types';
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
    resumeTopicIds?: number[],
  ): Promise<ReviewInitData> {
    await useStudyStore.getState().syncCurrentBookState(bookId);
    const { homeState, preparedBookId, wordList } = useStudyStore.getState();

    if (preparedBookId !== bookId) {
      throw new Error('当前词书学习进度加载失败，请重新加载');
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
  ): Promise<void> {
    const version = accountSession.getVersion();
    const store = useStudyStore.getState();
    store.loadLocalLearnRecords(context.bookId);
    store.recomputeHomeState(context.bookId);
    void store.syncCurrentBookState(context.bookId).then((result) => {
      accountSession.assertCurrent(version);
      if (result?.upload !== 'synced') return;
      return studyService.reportFinishDailyPlan(
        context.bookId, records.length, 0, useStudyStore.getState().homeState.unlearnedWords.length === 0,
      );
    }).catch(console.error);
  },
};
