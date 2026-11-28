import { accountSession } from '../accountSession';
import { studyRecordStore } from './recordStore';
import { waitForStudySyncs } from '../../stores/studyStore';
import { syncLearningRecords } from './syncEngine';

// New mutations are paused; frozen batches still use the original account.
export async function syncBeforeAccountSwitch(): Promise<boolean> {
  const version = accountSession.getVersion();
  await accountSession.waitForRequests();
  await waitForStudySyncs();
  accountSession.assertCurrent(version);
  await studyRecordStore.initialize();
  const books = Object.keys(studyRecordStore.getSnapshot().books).map(Number);
  for (const bookId of books) {
    if (!studyRecordStore.getPendingDoneRecords(bookId).length) continue;
    try {
      await syncLearningRecords(bookId, { allowDuringAccountSwitch: true });
    } catch {
      accountSession.assertCurrent(version);
    }
  }
  return books.some(bookId => studyRecordStore.getPendingDoneRecords(bookId).length > 0);
}
