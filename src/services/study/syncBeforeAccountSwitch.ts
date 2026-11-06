import { accountSession } from '../accountSession';
import { studyService } from '../studyService';
import { studyRecordStore } from './recordStore';
import { waitForStudySyncs } from '../../stores/studyStore';

// UI 和请求层已暂停新学习操作；已有请求仍使用旧账号完成。
export async function syncBeforeAccountSwitch(): Promise<boolean> {
  const version = accountSession.getVersion();
  await accountSession.waitForRequests();
  await waitForStudySyncs();
  accountSession.assertCurrent(version);

  const books = Object.keys(studyRecordStore.getSnapshot().books).map(Number);

  for (const bookId of books) {
    const pending = studyRecordStore.getPendingDoneRecords(bookId);

    if (pending.length === 0) {
      continue;
    }

    try {
      const result = await studyService.updateDoneData(pending.map((item) => item.doneRecord), bookId, true);
      accountSession.assertCurrent(version);

      if (result.resultCode < 0) {
        throw new Error('学习记录同步失败');
      }

      studyRecordStore.clearPendingDoneRecords(bookId, pending.map((item) => item.requestKey));
      studyRecordStore.updateSyncMeta(bookId, {
        localSyncVer: result.syncVersion,
        lastSuccessfulSyncAt: Date.now(),
        lastUploadError: null,
      });
    } catch {
      accountSession.assertCurrent(version);
      // 同步失败也允许切换；只有微信登录成功后才清理剩余记录。
    }
  }

  return books.some((bookId) => studyRecordStore.getPendingDoneRecords(bookId).length > 0);
}
