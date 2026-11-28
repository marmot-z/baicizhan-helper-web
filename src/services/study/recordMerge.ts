import {
  createRecordFromLearnedWordInfo,
  isKilledScore,
  type TopicLearnRecord,
} from '../../types/studyRecord';
import type { UserLearnedWordInfo } from '../../types';

/** LearnRecordManager.Z score precedence, without deleting local outbox data. */
export function mergeLearnedRecord(bookId: number, local: TopicLearnRecord | undefined,
  remoteWord: UserLearnedWordInfo, hasPendingState: boolean, now = Date.now()): TopicLearnRecord {
  const remote = createRecordFromLearnedWordInfo(bookId, remoteWord, now);
  if (!local) return remote;
  const counters = {
    doNum: Math.max(local.doNum, remote.doNum),
    errNum: Math.max(local.errNum, remote.errNum),
    totalTime: Math.max(local.totalTime, remote.totalTime),
  };
  if (hasPendingState) return { ...local, ...counters };
  const mergeScores = remote.topicScore > local.topicScore || remote.spellScore > local.spellScore
    || remote.listeningScore > local.listeningScore || remote.chnScore > local.chnScore
    || remote.reviewRound > local.reviewRound || (isKilledScore(remote.topicScore) && !isKilledScore(local.topicScore));
  return {
    ...local, ...counters, topicDay: remote.topicDay, isTodayNew: remote.isTodayNew,
    createdAt: remote.createdAt, normalizedDate: remote.normalizedDate, updatedAt: now,
    ...(mergeScores ? {
      topicScore: isKilledScore(remote.topicScore) ? remote.topicScore : Math.max(local.topicScore, remote.topicScore),
      spellScore: Math.max(local.spellScore, remote.spellScore),
      listeningScore: Math.max(local.listeningScore, remote.listeningScore),
      chnScore: Math.max(local.chnScore, remote.chnScore),
      reviewRound: Math.max(local.reviewRound, remote.reviewRound),
    } : {}),
  };
}
