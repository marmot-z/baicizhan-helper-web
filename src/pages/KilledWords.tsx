import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ROUTES } from '../constants';
import { studyService } from '../services/studyService';
import type { StudyUIModel } from '../services/study/types';
import { studyRecordStore } from '../services/study/recordStore';
import { wordStatusService } from '../services/study/wordStatusService';
import { useStudyStore } from '../stores/studyStore';
import styles from './KilledWords.module.css';

const PAGE_SIZE = 20;

function toComparableTimestamp(timestamp: number): number {
  if (!timestamp) return 0;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

const KilledWords: React.FC = () => {
  const navigate = useNavigate();
  const { studyPlan, currentBook, homeState, fetchStudyData } = useStudyStore();
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<Record<number, StudyUIModel>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoringTopicId, setRestoringTopicId] = useState<number | null>(null);
  const bookId = studyPlan?.book_id ?? currentBook?.id ?? null;

  useEffect(() => {
    void fetchStudyData();
  }, [fetchStudyData]);

  const sortedKilledWords = useMemo(() => {
    if (!bookId) return [];
    return [...(homeState.killedWords ?? [])].sort((a, b) => {
      const aRecord = studyRecordStore.getRecord(bookId, a.topic_id);
      const bRecord = studyRecordStore.getRecord(bookId, b.topic_id);
      const aTime = toComparableTimestamp(aRecord?.lastDoTime ?? aRecord?.updatedAt ?? 0);
      const bTime = toComparableTimestamp(bRecord?.lastDoTime ?? bRecord?.updatedAt ?? 0);
      return bTime - aTime;
    });
  }, [bookId, homeState.killedWords]);

  const pageCount = Math.max(1, Math.ceil(sortedKilledWords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageWords = useMemo(
    () => sortedKilledWords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, sortedKilledWords],
  );
  const pageTopicIdsKey = pageWords.map((word) => word.topic_id).join(',');

  useEffect(() => {
    if (!bookId || !pageTopicIdsKey) {
      setDetails({});
      setLoadError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);
    studyService
      .getXModeWordDetails(bookId, pageTopicIdsKey.split(',').map(Number))
      .then((models) => {
        if (!active) return;
        setDetails(Object.fromEntries(models.map((model) => [model.topicId, model])));
      })
      .catch((error) => {
        if (!active) return;
        console.error('加载已斩单词详情失败:', error);
        setDetails({});
        setLoadError('单词详情加载失败，请稍后重试');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId, pageTopicIdsKey]);

  const handleUnkill = (topicId: number) => {
    if (!bookId || restoringTopicId !== null) return;

    setRestoringTopicId(topicId);
    try {
      wordStatusService.unkillWord(bookId, topicId);
      toast.success('已取消斩词，记录正在同步');
    } catch (error) {
      console.error('取消斩词失败:', error);
      toast.error(error instanceof Error ? error.message : '取消斩词失败，请重试');
    } finally {
      setRestoringTopicId(null);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <button type="button" className={styles.backLink} onClick={() => navigate(ROUTES.DASHBOARD)}>
            ← 返回
          </button>
          <h1>已斩单词</h1>
          <p>{currentBook?.name ?? '当前单词书'} · 共 {sortedKilledWords.length} 词</p>
        </div>
      </header>

      {!sortedKilledWords.length ? (
        <section className={styles.emptyState}>
          <h2>还没有已斩单词</h2>
          <p>在学习页确认已经掌握某个单词后，可以使用左下角的“斩”。</p>
          <button type="button" onClick={() => navigate(ROUTES.STUDY_VIEW)}>去学习</button>
        </section>
      ) : (
        <>
          {loadError && <div className={styles.errorBanner}>{loadError}</div>}
          <section className={styles.list} aria-busy={loading}>
            {pageWords.map((word) => {
              const detail = details[word.topic_id];
              const meaning = detail?.front.chnMean || detail?.back.cnMeans
                .map((item) => `${item.type}.${item.text}`)
                .join('；');
              return (
                <article key={word.topic_id} className={styles.wordCard}>
                  <div className={styles.wordContent}>
                    <h2>{detail?.word ?? (loading ? '加载中…' : `单词 #${word.topic_id}`)}</h2>
                    <p>{meaning || (loading ? '正在加载释义…' : '暂无释义')}</p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.detailButton}
                      onClick={() => navigate(ROUTES.WORD_DETAIL.replace(':word', String(word.topic_id)))}
                    >
                      查看详情
                    </button>
                    <button
                      type="button"
                      className={styles.restoreButton}
                      disabled={restoringTopicId !== null}
                      onClick={() => handleUnkill(word.topic_id)}
                    >
                      {restoringTopicId === word.topic_id ? '正在恢复…' : '取消斩词'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {pageCount > 1 && (
            <nav className={styles.pagination} aria-label="已斩单词分页">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                上一页
              </button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                下一页
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
};

export default KilledWords;
