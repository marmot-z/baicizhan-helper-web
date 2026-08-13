import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../constants';
import { bookService } from '../services/bookService';
import { wordStatusService } from '../services/study/wordStatusService';
import { useStudyStore } from '../stores/studyStore';
import type { WordListWordMetaV2 } from '../types';
import {
  categorizeCurrentBookWords,
  createWordMetadataMap,
  parseWordListTab,
  parseWordSortOrder,
  sortCurrentBookWords,
  type WordListTab,
  type WordSortOrder,
} from './currentBookWordListModel';
import styles from './CurrentBookWordList.module.css';

const TABS: Array<{ id: WordListTab; label: string }> = [
  { id: 'learned', label: '已学单词' },
  { id: 'unlearned', label: '未学单词' },
  { id: 'killed', label: '已斩单词' },
];

export default function CurrentBookWordList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentBook,
    studyPlan,
    wordList,
    wordListBookId,
    learnRecords,
    syncingBookId,
    fetchStudyData,
  } = useStudyStore();
  const [initializing, setInitializing] = useState(true);
  const [metadata, setMetadata] = useState<WordListWordMetaV2[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [restoringTopicId, setRestoringTopicId] = useState<number | null>(null);
  const [revealedTopicIds, setRevealedTopicIds] = useState<Set<number>>(
    () => new Set()
  );
  const activeTab = parseWordListTab(searchParams.get('tab'));
  const sortOrder = parseWordSortOrder(searchParams.get('sort'));

  const plannedBookId = studyPlan?.book_id ?? null;
  const hasValidPlan = Boolean(
    plannedBookId && currentBook && currentBook.id === plannedBookId
  );
  const hasCurrentRoadmap = Boolean(
    hasValidPlan && wordListBookId === plannedBookId
  );
  const topicKeySignature = useMemo(
    () =>
      hasCurrentRoadmap
        ? wordList
            .map(
              ({ topic_id, word_level_id, tag_id }) =>
                `${topic_id}:${word_level_id}:${tag_id}`
            )
            .join('|')
        : '',
    [hasCurrentRoadmap, wordList]
  );

  useEffect(() => {
    let active = true;

    void fetchStudyData().finally(() => {
      if (active) {
        setInitializing(false);
      }
    });

    return () => {
      active = false;
    };
  }, [fetchStudyData]);

  useEffect(() => {
    if (
      searchParams.get('tab') === activeTab &&
      searchParams.get('sort') === sortOrder
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', activeTab);
    nextParams.set('sort', sortOrder);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams, sortOrder]);

  useEffect(() => {
    if (!hasCurrentRoadmap) {
      setMetadata([]);
      setMetadataError(null);
      setMetadataLoading(false);
      return;
    }

    if (wordList.length === 0) {
      setMetadata([]);
      setMetadataError(null);
      setMetadataLoading(false);
      return;
    }

    let active = true;
    setMetadata([]);
    setMetadataError(null);
    setMetadataLoading(true);

    const topicKeys = wordList.map(({ topic_id, word_level_id, tag_id }) => ({
      topic_id,
      word_level_id,
      tag_id,
    }));

    void bookService
      .getWordListWordMeta(topicKeys)
      .then((result) => {
        if (active) {
          setMetadata(result);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch word list metadata:', error);
        if (active) {
          setMetadataError('单词信息加载失败，请检查网络后重试。');
        }
      })
      .finally(() => {
        if (active) {
          setMetadataLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hasCurrentRoadmap, retryVersion, topicKeySignature, wordList]);

  const metadataByTopicId = useMemo(
    () => createWordMetadataMap(metadata),
    [metadata]
  );
  const categorizedWords = useMemo(
    () => categorizeCurrentBookWords(wordList, learnRecords, metadataByTopicId),
    [learnRecords, metadataByTopicId, wordList]
  );
  const visibleWords = useMemo(
    () => sortCurrentBookWords(categorizedWords[activeTab], sortOrder),
    [activeTab, categorizedWords, sortOrder]
  );
  const missingMetadataCount = useMemo(
    () =>
      wordList.reduce(
        (count, item) => count + (metadataByTopicId.has(item.topic_id) ? 0 : 1),
        0
      ),
    [metadataByTopicId, wordList]
  );
  const studyDataLoading =
    initializing || (plannedBookId !== null && syncingBookId === plannedBookId);

  const toggleMeaning = (topicId: number) => {
    setRevealedTopicIds((current) => {
      const next = new Set(current);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  const updateListView = (tab: WordListTab, order: WordSortOrder) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.set('sort', order);
    setSearchParams(nextParams, { replace: true });
  };

  const handleUnkill = (topicId: number) => {
    if (!plannedBookId || restoringTopicId !== null) {
      return;
    }

    setRestoringTopicId(topicId);
    try {
      wordStatusService.unkillWord(plannedBookId, topicId);
      toast.success('已取消斩词，记录正在同步');
    } catch (error) {
      console.error('取消斩词失败:', error);
      toast.error(
        error instanceof Error ? error.message : '取消斩词失败，请重试'
      );
    } finally {
      setRestoringTopicId(null);
    }
  };

  if (studyDataLoading && !hasCurrentRoadmap) {
    return <PageSkeleton />;
  }

  if (!hasValidPlan) {
    return (
      <div className={styles.page}>
        <section className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            📚
          </div>
          <h1>还没有可用的学习计划</h1>
          <p>选择一本词书并创建学习计划后，就可以在这里查看单词列表。</p>
          <div className={styles.emptyActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => navigate(ROUTES.ALL_BOOKS)}
            >
              选择词书
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(ROUTES.DASHBOARD)}
            >
              返回控制台
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.bookHero} aria-labelledby="current-book-title">
        <div className={styles.coverFrame}>
          {currentBook?.img ? (
            <img src={currentBook.img} alt={`${currentBook.name}封面`} />
          ) : (
            <div className={styles.coverPlaceholder} aria-hidden="true">
              A
            </div>
          )}
        </div>
        <div className={styles.bookSummary}>
          <h1 id="current-book-title">{currentBook?.name}</h1>
          <p className={styles.wordTotal}>
            单词数 {currentBook?.total_words_count ?? wordList.length}
          </p>
          <p className={styles.description}>
            {currentBook?.desc || '暂无词书介绍'}
          </p>
        </div>
      </section>

      <section className={styles.wordPanel} aria-label="当前词书单词">
        <div className={styles.tabs} role="tablist" aria-label="单词学习状态">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`word-list-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="current-book-word-list"
              className={activeTab === tab.id ? styles.activeTab : styles.tab}
              onClick={() => updateListView(tab.id, sortOrder)}
            >
              <span>{tab.label}</span>
              <span className={styles.tabCount}>
                {categorizedWords[tab.id].length}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <span>单词数：{categorizedWords[activeTab].length}</span>
          <div
            className={styles.sortControl}
            role="group"
            aria-label="单词排序方式"
          >
            <button
              type="button"
              aria-pressed={sortOrder === 'asc'}
              className={sortOrder === 'asc' ? styles.activeSort : undefined}
              onClick={() => updateListView(activeTab, 'asc')}
            >
              A → Z
            </button>
            <button
              type="button"
              aria-pressed={sortOrder === 'desc'}
              className={sortOrder === 'desc' ? styles.activeSort : undefined}
              onClick={() => updateListView(activeTab, 'desc')}
            >
              Z → A
            </button>
          </div>
        </div>

        {metadataLoading ? (
          <ListSkeleton />
        ) : metadataError && metadata.length === 0 ? (
          <div className={styles.errorState} role="alert">
            <strong>暂时无法加载单词</strong>
            <p>{metadataError}</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setRetryVersion((value) => value + 1)}
            >
              重新加载
            </button>
          </div>
        ) : (
          <>
            {missingMetadataCount > 0 && (
              <p className={styles.warning} role="status">
                有 {missingMetadataCount} 个单词的信息暂未返回，已放在列表末尾。
              </p>
            )}
            <div
              id="current-book-word-list"
              role="tabpanel"
              aria-labelledby={`word-list-tab-${activeTab}`}
              className={styles.wordList}
            >
              {visibleWords.length === 0 ? (
                <div className={styles.listEmpty}>这个列表暂时没有单词</div>
              ) : (
                visibleWords.map((entry) => {
                  const topicId = entry.roadmap.topic_id;
                  const isRevealed = revealedTopicIds.has(topicId);
                  const word =
                    entry.metadata?.word.trim() || `单词 #${topicId}`;
                  const meaning = entry.metadata?.mean_cn.trim() || '暂无释义';

                  const canUnkill = activeTab === 'killed';

                  return (
                    <div
                      key={topicId}
                      className={`${styles.wordRow} ${canUnkill ? styles.wordRowWithAction : ''}`}
                    >
                      <Link
                        className={styles.wordDetailLink}
                        to={ROUTES.WORD_DETAIL.replace(
                          ':word',
                          String(topicId)
                        )}
                        aria-label={`查看 ${word} 的详情`}
                      >
                        <span className={styles.word}>{word}</span>
                        <span
                          className={styles.detailChevron}
                          aria-hidden="true"
                        >
                          ›
                        </span>
                      </Link>
                      <button
                        type="button"
                        className={styles.meaningRevealButton}
                        aria-label={`${word}，${isRevealed ? '点击遮挡释义' : '点击显示释义'}`}
                        onClick={() => toggleMeaning(topicId)}
                      >
                        <span className={styles.meaning}>
                          {isRevealed ? (
                            meaning
                          ) : (
                            <span
                              className={styles.meaningMask}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </button>
                      {canUnkill && (
                        <button
                          type="button"
                          className={styles.unkillButton}
                          disabled={restoringTopicId !== null}
                          onClick={() => handleUnkill(topicId)}
                        >
                          {restoringTopicId === topicId
                            ? '正在恢复…'
                            : '取消斩词'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="正在加载当前词书">
      <div className={`${styles.skeleton} ${styles.skeletonHero}`} />
      <div className={styles.wordPanel}>
        <ListSkeleton />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      className={styles.skeletonList}
      aria-busy="true"
      aria-label="正在加载单词"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <span className={styles.skeleton} />
          <span className={styles.skeleton} />
        </div>
      ))}
    </div>
  );
}
