import { useStudyStore } from '../../stores/studyStore';
import { isKilledRecord, type TopicLearnRecord } from '../../types/studyRecord';
import { applyKill, applyUnkill } from './recordReducers';
import { studyRecordStore } from './recordStore';
import { toPendingDoneRecord } from './uploadAdapter';

export interface KillWordInput {
  bookId: number;
  topicId: number;
  tagId?: number;
  usedTime?: number;
  errNumDelta?: number;
  isTodayNew?: boolean;
}

function persistAndRefresh(bookId: number, record: TopicLearnRecord): TopicLearnRecord {
  studyRecordStore.upsertAndQueue(
    bookId,
    [record],
    [toPendingDoneRecord(record)],
  );

  const store = useStudyStore.getState();
  store.loadLocalLearnRecords(bookId);
  store.recomputeHomeState(bookId);

  void store.syncCurrentBookState(bookId).catch((error) => {
    console.error(`Failed to sync word status for book ${bookId}:`, error);
  });

  return record;
}

export const wordStatusService = {
  killWord(input: KillWordInput): TopicLearnRecord {
    const existingRecord = studyRecordStore.getRecord(input.bookId, input.topicId);
    if (isKilledRecord(existingRecord)) {
      return existingRecord!;
    }

    const record = applyKill(existingRecord, {
      bookId: input.bookId,
      topicId: input.topicId,
      tagId: input.tagId,
      usedTime: input.usedTime ?? 0,
      doNumDelta: 1,
      errNumDelta: input.errNumDelta ?? 0,
      now: Date.now(),
      isFirstDoAtToday: input.isTodayNew ?? existingRecord?.isTodayNew ?? true,
      nextReviewRound: existingRecord?.reviewRound ?? 0,
    });

    return persistAndRefresh(input.bookId, record);
  },

  unkillWord(bookId: number, topicId: number): TopicLearnRecord {
    const existingRecord = studyRecordStore.getRecord(bookId, topicId);
    if (!existingRecord || !isKilledRecord(existingRecord)) {
      throw new Error('该单词当前不是已斩状态');
    }

    const record = applyUnkill(existingRecord, {
      bookId,
      topicId,
      tagId: existingRecord.tagId,
      usedTime: 0,
      doNumDelta: 0,
      errNumDelta: 0,
      now: Date.now(),
      isFirstDoAtToday: existingRecord.isTodayNew,
      nextReviewRound: existingRecord.reviewRound,
    });

    return persistAndRefresh(bookId, record);
  },
};
