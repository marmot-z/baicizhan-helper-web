import { useEffect, useState } from 'react';
import { useStudyStore } from '../../stores/studyStore';
import { studyRecordStore } from '../../services/study/recordStore';
import './StudySyncStatus.css';

export default function StudySyncStatus() {
  const bookId = useStudyStore(state => state.studyPlan?.book_id);
  const syncing = useStudyStore(state => state.syncingBookId);
  const result = useStudyStore(state => bookId ? state.syncResults[bookId] : undefined);
  const [, redraw] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const unsubscribe = studyRecordStore.subscribe(() => redraw(value => value + 1));
    void studyRecordStore.initialize().catch(() => setError('学习数据暂时无法保存，请重试'));
    return unsubscribe;
  }, []);
  if (!bookId) return null;
  const pending = studyRecordStore.getPendingDoneRecords(bookId).length;
  const meta = studyRecordStore.getSyncMeta(bookId);
  const saving = busy || syncing === bookId;
  const prepared = meta.lastPulledAt > 0 || studyRecordStore.getAllRecords(bookId).length > 0;
  const permissionPaused = result?.pauseReason === 'permission';
  const label = (permissionPaused && !saving ? '权限不足，进度已保存本地；权限恢复后点击立即同步' : error) ?? (saving ? '正在同步学习记录…' : !prepared
    ? '学习进度尚未就绪，请重试' : pending
    ? `已保存本地，${pending} 个单词等待补传`
    : meta.needsFullPull ? '已保存本地，等待远端对账'
    : '学习记录已同步');
  const sync = async () => {
    setBusy(true); setError(null);
    try {
      const status = await useStudyStore.getState().syncCurrentBookState(bookId, { forcePull: true, userInitiated: true });
      if (status?.errors.length) setError('已保存本地，同步暂时失败，请重试');
    } catch { setError('学习数据同步失败，请重试'); }
    finally { setBusy(false); }
  };
  return <aside className="study-sync-status" aria-label="学习记录同步">
    <div className="study-sync-status__line">
      <span role="status" aria-live="polite">{label}</span>
      <button type="button" disabled={saving} onClick={() => void sync()}>立即同步</button>
    </div>
    {(result?.upload === 'failed' || result?.download === 'failed') && !permissionPaused && !error &&
      <p>连接恢复后会自动重试。</p>}

  </aside>;
}
