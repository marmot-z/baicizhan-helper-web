import { useEffect, useRef, useState } from 'react';
import { learningAgentService } from '../services/learningAgentService';
import type { LearningAgentProfile, LearningRouteUpdate } from '../services/learningAgentService';
import styles from './LearningAgent.module.css';

const stages = {
  loading_words: '获取完整词表',
  planning: 'AI 正在分析学习顺序',
  ordering: '生成单词顺序',
  saving: '校验并保存',
};

export default function LearningAgentRouteDialog({ profile, onSaved, onClose }: {
  profile: LearningAgentProfile;
  onSaved: (profile: LearningAgentProfile) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<Extract<LearningRouteUpdate, { type: 'progress' }>>({ type: 'progress', stage: 'loading_words', completed: 0, total: 0 });
  const [rationale, setRationale] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const { bookId, bookRevision } = profile;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const start = Date.now();
    setProgress({ type: 'progress', stage: 'loading_words', completed: 0, total: 0 });
    setRationale('');
    setElapsed(0);
    setError('');
    setDone(false);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    // StrictMode replays effects before this microtask. Its cancelled first setup
    // must not start a second HTTP request (and potentially a second model call).
    void Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return learningAgentService.planRoute({ bookId, bookRevision }, controller.signal, (event) => {
        if (controller.signal.aborted) return;
        if (event.type === 'rationale_delta') setRationale((text) => text + event.text);
        else setProgress(event);
      });
    }).then((saved) => {
      if (controller.signal.aborted) return;
      setRationale(saved.learningRoute ?? '');
      setProgress({ type: 'progress', stage: 'saving', completed: saved.wordOrder?.length ?? 0, total: saved.wordOrder?.length ?? 0 });
      setDone(true);
      onSaved(saved);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '学习路线规划失败，请重试');
    }).finally(() => window.clearInterval(timer));
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [bookId, bookRevision, attempt, onSaved]);

  const busy = !done && !error;
  const counted = progress.total > 0 && (progress.stage === 'loading_words' || progress.stage === 'ordering');
  return (
    <dialog ref={dialog} className={`${styles.bookPicker} ${styles.routeDialog}`} aria-labelledby="agent-route-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <h2 className={styles.pickerTitle} id="agent-route-title">{done ? '学习路线已保存' : '规划学习路线'}</h2>
      <div className={styles.routeBody}>
        <p className={styles.routeBookName}>{profile.book?.name ?? `词书 #${bookId}`}</p>
        {busy && (
          <div className={styles.routeStatus} role="status">
            <div className={styles.routeStatusHeading}><span className={styles.routeSpinner} aria-hidden="true" />{stages[progress.stage]}</div>
            {counted && <p>{progress.completed.toLocaleString('zh-CN')} / {progress.total.toLocaleString('zh-CN')} 词</p>}
            <progress aria-label={stages[progress.stage]} value={counted ? Math.min(progress.completed, progress.total) : undefined} max={counted ? progress.total : 1} />
            <p className={styles.routeElapsed}>已等待 {elapsed} 秒{elapsed >= 30 ? ' · 整本词书规划需要一些时间，请稍候' : ''}</p>
          </div>
        )}
        {error && <p className={styles.pickerError} role="alert">{error}</p>}
        {rationale && (
          <section className={styles.routeRationale}>
            <h3>规划依据{busy ? '（生成中）' : error ? '（尚未完成）' : ''}</h3>
            <p>{rationale}</p>
          </section>
        )}
        {done && <p className={styles.routeSaved}>已为全部 {progress.total.toLocaleString('zh-CN')} 个单词保存学习顺序。</p>}
      </div>
      <div className={styles.pickerActions}>
        {!done && <button className={styles.secondaryAction} type="button" onClick={onClose}>{busy ? '取消规划' : '关闭'}</button>}
        {error && <button className={styles.primaryAction} type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button>}
        {done && <button className={styles.primaryAction} type="button" onClick={onClose}>完成</button>}
      </div>
    </dialog>
  );
}
