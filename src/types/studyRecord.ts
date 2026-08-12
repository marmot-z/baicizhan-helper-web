import type {
  UserDoneWordRecord,
  UserLearnedWordInfo,
  UserRoadMapElementV2,
} from './index';

export const UNLEARNED_SCORE = -1024;
export const DEFAULT_KILLED_SCORE = -1;
export const MIN_KILLED_SCORE = -9;
export const DEFAULT_UNKILLED_SCORE = 5;
export const MAX_UNKILLED_SCORE = 9;

export interface TopicLearnExtraScores {
  tagId?: number;
  spellScore: number;
  listeningScore: number;
  chnScore: number;
}

export interface TopicLearnRecord extends TopicLearnExtraScores {
  topicId: number;
  bookId: number;
  topicScore: number;
  topicDay: number;
  isTodayNew: boolean;
  errNum: number;
  reviewRound: number;
  lastDoTime: number;
  doNum: number;
  totalTime: number;
  createdAt: number;
  updatedAt: number;
}

export interface StudyHomeState {
  unlearnedWords: UserRoadMapElementV2[];
  killedWords: UserRoadMapElementV2[];
  todayLearnedWords: UserRoadMapElementV2[];
  unreviewedWords: UserRoadMapElementV2[];
  reviewedWords: UserRoadMapElementV2[];
  todayReviewedWords: UserRoadMapElementV2[];
  reviewingPoolCount: number;
  learnPlanCount: number;
  reviewPlanCount: number;
  increasedCount: number;
  planCount: number;
}

export interface HomeStateCalculatorInput {
  records: Record<number, TopicLearnRecord>;
  roadmap: UserRoadMapElementV2[];
  learnPlanCount: number;
  reviewPlanCount: number;
  increasedCount?: number;
}

export interface TopicLearnRecordUpdateInput {
  bookId: number;
  topicId: number;
  tagId?: number;
  usedTime?: number;
  doNumDelta?: number;
  errNumDelta?: number;
  now?: number;
  isFirstDoAtToday?: boolean;
  nextScore?: number;
  nextSpanDays?: number;
  nextReviewRound?: number;
  spellScore?: number;
  listeningScore?: number;
  chnScore?: number;
}

export interface StudyDayTransitionInput {
  now?: number;
  nextSpanDays?: number;
  nextScore?: number;
}

export interface RemoteLearnRecordMergeResult {
  mergedRecords: TopicLearnRecord[];
  touchedTopicIds: number[];
}

export type TopicLearnRecordMap = Record<number, TopicLearnRecord>;

export interface PendingDoneRecord {
  topicId: number;
  queuedAt: number;
  requestKey: string;
  doneRecord: UserDoneWordRecord;
}

export interface StudySyncMeta {
  localSyncVer: number;
  remoteSyncVer: number;
  lastSuccessfulSyncAt: number;
  lastUploadAttemptAt: number;
  lastUploadError: string | null;
}

export interface StudyBookStateSnapshot {
  totalRecords: TopicLearnRecordMap;
  pendingDoneQueue: PendingDoneRecord[];
  syncMeta: StudySyncMeta;
}

export interface StudyRecordStoreSnapshotV1 {
  version: 1;
  books: Record<number, TopicLearnRecordMap>;
}

export interface StudyRecordStoreSnapshot {
  version: 2;
  books: Record<number, StudyBookStateSnapshot>;
}

export function createEmptyHomeState(
  overrides: Partial<StudyHomeState> = {},
): StudyHomeState {
  return {
    unlearnedWords: [],
    killedWords: [],
    todayLearnedWords: [],
    unreviewedWords: [],
    reviewedWords: [],
    todayReviewedWords: [],
    reviewingPoolCount: 0,
    learnPlanCount: 0,
    reviewPlanCount: 0,
    increasedCount: 0,
    planCount: 0,
    ...overrides,
  };
}

export function createTopicLearnRecord(
  input: Pick<TopicLearnRecord, 'bookId' | 'topicId'> &
    Partial<Omit<TopicLearnRecord, 'bookId' | 'topicId'>>,
): TopicLearnRecord {
  const now = input.updatedAt ?? Date.now();
  return {
    topicId: input.topicId,
    bookId: input.bookId,
    topicScore: input.topicScore ?? UNLEARNED_SCORE,
    topicDay: input.topicDay ?? 0,
    isTodayNew: input.isTodayNew ?? false,
    errNum: input.errNum ?? 0,
    reviewRound: input.reviewRound ?? 0,
    lastDoTime: input.lastDoTime ?? 0,
    doNum: input.doNum ?? 0,
    totalTime: input.totalTime ?? 0,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    tagId: input.tagId,
    spellScore: input.spellScore ?? 0,
    listeningScore: input.listeningScore ?? 0,
    chnScore: input.chnScore ?? 0,
  };
}

export function createRecordMap(
  records: TopicLearnRecord[],
): TopicLearnRecordMap {
  return records.reduce<TopicLearnRecordMap>((acc, record) => {
    acc[record.topicId] = record;
    return acc;
  }, {});
}

export function createEmptySyncMeta(
  overrides: Partial<StudySyncMeta> = {},
): StudySyncMeta {
  return {
    localSyncVer: 0,
    remoteSyncVer: 0,
    lastSuccessfulSyncAt: 0,
    lastUploadAttemptAt: 0,
    lastUploadError: null,
    ...overrides,
  };
}

export function createEmptyBookStateSnapshot(
  overrides: Partial<StudyBookStateSnapshot> = {},
): StudyBookStateSnapshot {
  return {
    totalRecords: {},
    pendingDoneQueue: [],
    syncMeta: createEmptySyncMeta(),
    ...overrides,
  };
}

export function isUnlearnedRecord(
  record: TopicLearnRecord | undefined,
): boolean {
  return !record || record.topicScore === UNLEARNED_SCORE;
}

export function isKilledScore(score: number): boolean {
  return score < 0 && score !== UNLEARNED_SCORE;
}

export function isKilledRecord(
  record: TopicLearnRecord | undefined,
): boolean {
  return Boolean(record && isKilledScore(record.topicScore));
}

export function toKilledScore(score: number): number {
  if (isKilledScore(score)) {
    return Math.max(score, MIN_KILLED_SCORE);
  }

  if (score === UNLEARNED_SCORE || score === 0) {
    return DEFAULT_KILLED_SCORE;
  }

  return Math.max(-Math.abs(score), MIN_KILLED_SCORE);
}

export function toUnkilledScore(score: number): number {
  if (!isKilledScore(score)) {
    return score;
  }

  if (score >= -4) {
    return DEFAULT_UNKILLED_SCORE;
  }

  return Math.min(Math.abs(score), MAX_UNKILLED_SCORE);
}

export function createRecordFromLearnedWordInfo(
  bookId: number,
  learnedWord: UserLearnedWordInfo,
  now = Date.now(),
): TopicLearnRecord {
  return createTopicLearnRecord({
    bookId,
    topicId: learnedWord.topic_id,
    topicScore: learnedWord.score,
    topicDay: learnedWord.span_days,
    isTodayNew: false,
    errNum: learnedWord.wrong_times,
    reviewRound: learnedWord.review_round,
    lastDoTime: learnedWord.created_at,
    doNum: learnedWord.done_times,
    totalTime: learnedWord.used_time,
    createdAt: learnedWord.created_at || now,
    updatedAt: now,
    spellScore: learnedWord.spell_score,
    listeningScore: learnedWord.listening_score,
    chnScore: learnedWord.chn_score,
  });
}
