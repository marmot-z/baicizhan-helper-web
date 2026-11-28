import { accountSession, AccountSessionChangedError } from '../accountSession';
import { useStudyStore } from '../../stores/studyStore';
import { isKilledRecord, type TopicLearnRecord } from '../../types/studyRecord';
import { applyKill, applyUnkill } from './recordReducers';
import { studyRecordStore } from './recordStore';
import { createStudySessionId } from './sessionStore';
import type { StudySessionDraft } from './sessionTypes';

export interface KillWordInput {
  bookId: number;
  topicId: number;
  tagId?: number;
  usedTime?: number;
  errNumDelta?: number;
  isTodayNew?: boolean;
  eventId?: string;
  checkpoint?: StudySessionDraft;
}

function refresh(bookId: number): void {
  const store = useStudyStore.getState();
  store.loadLocalLearnRecords(bookId);
  store.recomputeHomeState(bookId);
  void store.syncCurrentBookState(bookId).catch((error) => {
    console.error(`Failed to sync word status for book ${bookId}:`, error);
  });
}

export const wordStatusService = {
  async killWord(input: KillWordInput): Promise<TopicLearnRecord> {
    if (accountSession.isSwitching()) throw new AccountSessionChangedError();
    const version = accountSession.getVersion();
    const record = await studyRecordStore.commitMutation({
      bookId: input.bookId,
      topicId: input.topicId,
      eventId: input.eventId ?? `kill:${createStudySessionId()}`,
      checkpoint: input.checkpoint,
      mutate: (existing) => isKilledRecord(existing) ? existing! : applyKill(existing, {
        bookId: input.bookId, topicId: input.topicId, tagId: input.tagId,
        usedTime: input.usedTime ?? 0, doNumDelta: 1,
        errNumDelta: input.errNumDelta ?? 0, now: Date.now(),
        isFirstDoAtToday: input.isTodayNew ?? existing?.isTodayNew ?? true,
        nextReviewRound: existing?.reviewRound ?? 0,
      }),
    });
    accountSession.assertCurrent(version);
    refresh(input.bookId);
    return record;
  },

  async unkillWord(bookId: number, topicId: number): Promise<TopicLearnRecord> {
    if (accountSession.isSwitching()) throw new AccountSessionChangedError();
    const version = accountSession.getVersion();
    const record = await studyRecordStore.commitMutation({
      bookId, topicId, eventId: `unkill:${createStudySessionId()}`,
      mutate: (existing) => {
        if (!existing || !isKilledRecord(existing)) throw new Error('该单词当前不是已斩状态');
        return applyUnkill(existing, {
          bookId, topicId, tagId: existing.tagId, usedTime: 0,
          doNumDelta: 0, errNumDelta: 0, now: Date.now(),
          isFirstDoAtToday: existing.isTodayNew, nextReviewRound: existing.reviewRound,
        });
      },
    });
    accountSession.assertCurrent(version);
    refresh(bookId);
    return record;
  },
};
