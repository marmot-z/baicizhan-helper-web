import { studyService } from '../studyService';
import { StudyUtils } from '../study/StudyUtils';
import type { StudyOption, StudyUIModel } from '../study/types';
import type { UserRoadMapElementV2 } from '../../types';
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
    roadmapWords: UserRoadMapElementV2[]
  ): Promise<ReviewInitData> {
    const learnedWords = await studyService.getLearnedWords(bookId);
    if (!learnedWords.length) {
      return {
        words: [],
        roadmapMap: new Map(),
        context: {
          bookId,
          planType: REVIEW_PLAN_TYPE,
        },
      };
    }

    const roadmapMap = new Map(roadmapWords.map((word) => [word.topic_id, word]));
    const targetCount = reviewPlanCount || 10;
    const sortedLearnedWords = [...learnedWords].sort(
      (left, right) => right.update_days - left.update_days
    );
    const reviewWords = sortedLearnedWords
      .slice(0, targetCount)
      .map((item) => roadmapMap.get(item.topic_id))
      .filter((item): item is UserRoadMapElementV2 => Boolean(item));

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
    roadmapMap: Map<number, UserRoadMapElementV2>
  ): Promise<StudyOption[]> {
    const cached = StudyUtils.getCachedOptions(word.topicId);
    if (cached?.length) {
      return cached;
    }

    const roadmapWord = roadmapMap.get(word.topicId);
    if (!roadmapWord) {
      return [
        {
          id: word.topicId,
          word: word.word,
          translation: word.front.chnMean,
          isCorrect: true,
        },
      ];
    }

    return StudyUtils.loadOptionsForTopic(roadmapWord, word);
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

  async finishReview(records: ReviewWordRecord[]): Promise<void> {
    console.log('[reviewService] finishReview', records);
  },
};
