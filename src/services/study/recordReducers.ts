import {
  UNLEARNED_SCORE,
  createTopicLearnRecord,
  type StudyDayTransitionInput,
  type TopicLearnRecord,
  type TopicLearnRecordUpdateInput,
} from '../../types/studyRecord';

function getNow(now?: number): number {
  return now ?? Date.now();
}

function isSameDay(timestampA: number, timestampB: number): boolean {
  const dateA = new Date(timestampA);
  const dateB = new Date(timestampB);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function getDayDiff(timestampA: number, timestampB: number): number {
  const dateA = new Date(timestampA);
  const dateB = new Date(timestampB);
  const startOfDayA = new Date(
    dateA.getFullYear(),
    dateA.getMonth(),
    dateA.getDate(),
  ).getTime();
  const startOfDayB = new Date(
    dateB.getFullYear(),
    dateB.getMonth(),
    dateB.getDate(),
  ).getTime();

  return Math.max(0, Math.floor((startOfDayB - startOfDayA) / 86400000));
}

function applyCrossDayScoreFix(topicDay: number, topicScore: number): number {
  if (topicDay > 7 && topicScore < 4) {
    return 4;
  }

  if (topicDay > 0 && topicDay < 8 && topicScore < 3) {
    return 3;
  }

  return topicScore;
}

function createBaseRecord(input: TopicLearnRecordUpdateInput): TopicLearnRecord {
  const now = getNow(input.now);
  return createTopicLearnRecord({
    bookId: input.bookId,
    topicId: input.topicId,
    tagId: input.tagId,
    lastDoTime: now,
    createdAt: now,
    updatedAt: now,
  });
}

function applyCommonMutation(
  record: TopicLearnRecord | undefined,
  input: TopicLearnRecordUpdateInput,
  overrides: Partial<TopicLearnRecord>,
): TopicLearnRecord {
  const now = getNow(input.now);
  const baseRecord = record ?? createBaseRecord(input);
  const sameDay = baseRecord.lastDoTime > 0 && isSameDay(baseRecord.lastDoTime, now);
  const usedTime = input.usedTime ?? 0;
  const doNumDelta = input.doNumDelta ?? 1;
  const errNumDelta = input.errNumDelta ?? 0;

  return {
    ...baseRecord,
    updatedAt: now,
    lastDoTime: now,
    totalTime: baseRecord.totalTime + usedTime,
    doNum: baseRecord.doNum + doNumDelta,
    errNum: baseRecord.errNum + errNumDelta,
    tagId: input.tagId ?? baseRecord.tagId,
    spellScore: input.spellScore ?? baseRecord.spellScore,
    listeningScore: input.listeningScore ?? baseRecord.listeningScore,
    chnScore: input.chnScore ?? baseRecord.chnScore,
    isTodayNew:
      input.isFirstDoAtToday ??
      (baseRecord.isTodayNew || (!sameDay && baseRecord.topicScore === UNLEARNED_SCORE)),
    ...overrides,
  };
}

export function applyStudyCorrect(
  record: TopicLearnRecord | undefined,
  input: TopicLearnRecordUpdateInput,
): TopicLearnRecord {
  return applyCommonMutation(record, input, {
    topicScore: input.nextScore ?? Math.max(record?.topicScore ?? 0, 0),
    topicDay: input.nextSpanDays ?? record?.topicDay ?? 0,
    reviewRound: input.nextReviewRound ?? record?.reviewRound ?? 0,
  });
}

export function applyStudyWrong(
  record: TopicLearnRecord | undefined,
  input: TopicLearnRecordUpdateInput,
): TopicLearnRecord {
  const baseRecord = record ?? createBaseRecord(input);
  return applyCommonMutation(baseRecord, input, {
    topicScore: input.nextScore ?? baseRecord.topicScore,
    topicDay: input.nextSpanDays ?? baseRecord.topicDay,
    reviewRound: input.nextReviewRound ?? baseRecord.reviewRound,
  });
}

export function applyReviewCorrect(
  record: TopicLearnRecord | undefined,
  input: TopicLearnRecordUpdateInput,
): TopicLearnRecord {
  const baseRecord = record ?? createBaseRecord(input);
  return applyCommonMutation(baseRecord, input, {
    topicScore: input.nextScore ?? Math.max(baseRecord.topicScore + 1, 5),
    topicDay: input.nextSpanDays ?? 0,
    reviewRound: input.nextReviewRound ?? baseRecord.reviewRound + 1,
    isTodayNew: false,
  });
}

export function applyReviewWrong(
  record: TopicLearnRecord | undefined,
  input: TopicLearnRecordUpdateInput,
): TopicLearnRecord {
  const baseRecord = record ?? createBaseRecord(input);
  return applyCommonMutation(baseRecord, input, {
    topicScore: input.nextScore ?? Math.min(Math.max(baseRecord.topicScore, 0), 4),
    topicDay: input.nextSpanDays ?? 0,
    reviewRound: input.nextReviewRound ?? baseRecord.reviewRound,
    isTodayNew: false,
  });
}

export function applyDayTransition(
  record: TopicLearnRecord,
  input: StudyDayTransitionInput = {},
): TopicLearnRecord {
  const now = getNow(input.now);
  if (!record.lastDoTime || isSameDay(record.lastDoTime, now)) {
    return record;
  }

  const advancedTopicDay =
    input.nextSpanDays ?? record.topicDay + getDayDiff(record.lastDoTime, now);
  const fixedTopicScore =
    input.nextScore ?? applyCrossDayScoreFix(advancedTopicDay, record.topicScore);

  return {
    ...record,
    updatedAt: now,
    isTodayNew: false,
    topicDay: advancedTopicDay,
    topicScore: fixedTopicScore,
  };
}
