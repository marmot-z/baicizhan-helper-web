import type { UserRoadMapElementV2 } from '../../types';
import {
  createEmptyHomeState,
  isUnlearnedRecord,
  type HomeStateCalculatorInput,
  type StudyHomeState,
  type TopicLearnRecord,
} from '../../types/studyRecord';

function shouldCountAsTodayReviewed(record: TopicLearnRecord): boolean {
  if (record.isTodayNew) {
    return false;
  }

  return record.topicDay === 0 && (record.topicScore > 4 || record.topicScore < 0);
}

function pushWord(
  collection: UserRoadMapElementV2[],
  word: UserRoadMapElementV2,
): void {
  collection.push(word);
}

export function calculateHomeState(
  input: HomeStateCalculatorInput,
): StudyHomeState {
  const increasedCount = input.increasedCount ?? 0;
  const result = createEmptyHomeState({
    learnPlanCount: input.learnPlanCount,
    reviewPlanCount: input.reviewPlanCount,
    increasedCount,
    planCount: input.learnPlanCount + increasedCount,
  });

  for (const word of input.roadmap) {
    const record = input.records[word.topic_id];

    if (isUnlearnedRecord(record)) {
      pushWord(result.unlearnedWords, word);
      continue;
    }

    if (record.isTodayNew) {
      pushWord(result.todayLearnedWords, word);
      continue;
    }

    if (record.topicScore >= 0 && record.topicScore <= 4) {
      pushWord(result.unreviewedWords, word);
    } else if (record.topicScore > 4) {
      pushWord(result.reviewedWords, word);
    }

    if (shouldCountAsTodayReviewed(record)) {
      pushWord(result.todayReviewedWords, word);
    }
  }

  result.reviewingPoolCount = result.unreviewedWords.length;

  return result;
}
