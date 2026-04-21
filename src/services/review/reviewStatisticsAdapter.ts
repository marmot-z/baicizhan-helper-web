import type { StudyStatistcs, StudyUIModel } from '../study/types';
import type { ReviewSummaryState } from './types';

const buildUsedTimeMap = (summaryState: ReviewSummaryState): Record<number, number> => {
  const usedTimeMap: Record<number, number> = {};

  summaryState.records.forEach((record) => {
    if (record.reviewStartedAt == null || record.completedAt == null) {
      usedTimeMap[record.topicId] = 0;
      return;
    }

    usedTimeMap[record.topicId] = Math.max(0, record.completedAt - record.reviewStartedAt);
  });

  return usedTimeMap;
};

const buildTotalTime = (summaryState: ReviewSummaryState): number => {
  const startedAtList = summaryState.records
    .map((record) => record.reviewStartedAt)
    .filter((value): value is number => value != null);
  const completedAtList = summaryState.records
    .map((record) => record.completedAt)
    .filter((value): value is number => value != null);

  if (!startedAtList.length || !completedAtList.length) {
    return 0;
  }

  return Math.max(0, Math.max(...completedAtList) - Math.min(...startedAtList));
};

export const reviewStatisticsAdapter = {
  toStudyStatistics(summaryState: ReviewSummaryState, words: StudyUIModel[]): StudyStatistcs {
    const wordMap = new Map(words.map((word) => [word.topicId, word]));

    return {
      failMap: Object.fromEntries(
        summaryState.records.map((record) => [record.topicId, record.errorCount])
      ),
      usedTimeMap: buildUsedTimeMap(summaryState),
      totalTime: buildTotalTime(summaryState),
      words: summaryState.records.map((record) => {
        const word = wordMap.get(record.topicId);

        return {
          topic_id: record.topicId,
          word: record.word,
          mean_cn: word?.front.chnMean || '',
          accent: word?.front.accent.uk || word?.front.accent.us || '',
        };
      }),
      updateTime: Date.now(),
    };
  },
};
