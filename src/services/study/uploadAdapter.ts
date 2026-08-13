import type { UserDoneWordRecord } from '../../types';
import type { PendingDoneRecord, TopicLearnRecord } from '../../types/studyRecord';

let pendingRequestSequence = 0;

export function toUserDoneWordRecord(
  record: TopicLearnRecord,
): UserDoneWordRecord {
  return {
    word_topic_id: record.topicId,
    current_score: record.topicScore,
    span_days: record.topicDay,
    used_time: record.totalTime,
    done_times: record.doNum,
    wrong_times: record.errNum,
    is_first_do_at_today: record.isTodayNew ? 1 : 0,
    tag_id: record.tagId ?? 0,
    spell_score: record.spellScore,
    listening_score: record.listeningScore,
    chn_score: record.chnScore,
    review_round: record.reviewRound,
  };
}

export function toPendingDoneRecord(
  record: TopicLearnRecord,
  queuedAt = Date.now(),
): PendingDoneRecord {
  const requestSequence = pendingRequestSequence++;

  return {
    topicId: record.topicId,
    queuedAt,
    // queuedAt only has millisecond precision. A newer status can be queued while
    // an older upload for the same topic is still in flight, so it needs a
    // process-local suffix to prevent the old response from clearing the new item.
    requestKey: `${record.bookId}-${record.topicId}-${queuedAt}-${requestSequence}`,
    doneRecord: toUserDoneWordRecord(record),
  };
}
