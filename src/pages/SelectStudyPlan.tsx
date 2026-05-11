import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import StudyPlanMergeModal from '../components/StudyPlanMergeModal';
import { studyService } from '../services/studyService';
import { useStudyStore } from '../stores/studyStore';
import type { UserBookBasicInfo } from '../types';
import styles from './SelectStudyPlan.module.css';

function getIntegerError(value: string, allowZero: boolean): string {
  if (value.trim() === '') {
    return '请输入数字';
  }

  if (!/^\d+$/.test(value.trim())) {
    return '请输入整数';
  }

  const parsed = Number(value);
  if (!allowZero && parsed <= 0) {
    return '必须大于 0';
  }

  if (allowZero && parsed < 0) {
    return '不能小于 0';
  }

  return '';
}

function formatDateLabel(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

function formatShortDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
}

const COVER_THEMES = [
  styles.coverOrange,
  styles.coverGold,
  styles.coverGreen,
  styles.coverBlue,
  styles.coverPurple,
  styles.coverRose,
];

function getBookTag(name: string): string {
  return name.trim().slice(0, 6) || '词书';
}

function getCoverTheme(bookId: number): string {
  return COVER_THEMES[Math.abs(bookId) % COVER_THEMES.length];
}

const SelectStudyPlan: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId: string }>();
  const studyPlan = useStudyStore((state) => state.studyPlan);
  const currentBook = useStudyStore((state) => state.currentBook);
  const refreshStudyDataForBook = useStudyStore((state) => state.refreshStudyDataForBook);

  const [book, setBook] = useState<UserBookBasicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [dailyPlanInput, setDailyPlanInput] = useState('');
  const [reviewPlanInput, setReviewPlanInput] = useState('');
  const [mergeCount, setMergeCount] = useState(0);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  const routeBook = (location.state as { book?: UserBookBasicInfo } | null)?.book ?? null;

  useEffect(() => {
    const targetBookId = Number(bookId);
    if (!targetBookId) {
      toast.error('词书信息无效');
      navigate(ROUTES.ALL_BOOKS);
      return;
    }

    const loadBook = async () => {
      setLoading(true);
      try {
        let matchedBook: UserBookBasicInfo | null = null;

        if (routeBook && routeBook.id === targetBookId) {
          matchedBook = routeBook;
        } else {
          const result = await studyService.getAllBooks();
          matchedBook = result.books.find((item) => item.id === targetBookId) ?? null;
        }

        if (!matchedBook) {
          toast.error('未找到对应词书');
          navigate(ROUTES.ALL_BOOKS);
          return;
        }

        setBook(matchedBook);
        setDailyPlanInput(String(studyPlan?.daily_plan_count ?? 10));
        setReviewPlanInput(String(studyPlan?.review_plan_count ?? 0));
      } catch (error) {
        console.error('获取词书信息失败:', error);
        toast.error('获取词书信息失败，请稍后重试');
        navigate(ROUTES.ALL_BOOKS);
      } finally {
        setLoading(false);
      }
    };

    void loadBook();
  }, [bookId, navigate, routeBook, studyPlan?.daily_plan_count, studyPlan?.review_plan_count]);

  const dailyPlanError = getIntegerError(dailyPlanInput, false);
  const reviewPlanError = getIntegerError(reviewPlanInput, true);
  const canSubmit = !dailyPlanError && !reviewPlanError && !!book && !submitting;

  const remainingWords = useMemo(() => {
    if (!book) {
      return 0;
    }

    const learnedCount =
      studyPlan?.book_id === book.id ? studyPlan.learned_words_count : 0;
    return Math.max(book.total_words_count - learnedCount, 0);
  }, [book, studyPlan]);

  const completionInfo = useMemo(() => {
    if (!book || dailyPlanError) {
      return null;
    }

    const dailyCount = Number(dailyPlanInput);
    if (!dailyCount) {
      return null;
    }

    const days = remainingWords === 0 ? 0 : Math.ceil(remainingWords / dailyCount);
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() + days);

    return {
      days,
      endDateLabel: formatDateLabel(endDate),
      shortEndDateLabel: formatShortDate(endDate),
    };
  }, [book, dailyPlanError, dailyPlanInput, remainingWords]);

  const dailyPlanNumber = Number.parseInt(dailyPlanInput, 10) || 0;
  const reviewPlanNumber = Number.parseInt(reviewPlanInput, 10) || 0;
  const learnedWordsCount =
    studyPlan && studyPlan.book_id === book?.id ? studyPlan.learned_words_count : 0;
  const progressPercent = book?.total_words_count
    ? Math.max(0, Math.min(100, Math.round((learnedWordsCount / book.total_words_count) * 100)))
    : 0;
  const ringCircumference = 2 * Math.PI * 48;
  const ringOffset = ringCircumference * (1 - progressPercent / 100);
  const startedDate = formatShortDate(new Date());

  const updatePlanValue = (value: string, delta: number, allowZero: boolean): string => {
    const parsed = Number.parseInt(value, 10);
    const nextValue = Number.isNaN(parsed) ? (allowZero ? 0 : 1) : parsed + delta;
    const minValue = allowZero ? 0 : 1;
    return String(Math.max(minValue, nextValue));
  };

  const finalizePlanSelection = async () => {
    if (book) {
      await refreshStudyDataForBook(book);
    }
    navigate(ROUTES.DASHBOARD);
  };

  const handleSubmit = async () => {
    if (!book || !canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      const selectedBookInfo = await studyService.selectBook(
        book.id,
        Number(dailyPlanInput),
        Number(reviewPlanInput),
        -1,
        0,
      );

      setMergeCount(selectedBookInfo.need_merge_count ?? 0);

      if ((selectedBookInfo.need_merge_count ?? 0) > 0) {
        setMergeModalOpen(true);
        return;
      }

      toast.success('学习计划已更新');
      await finalizePlanSelection();
    } catch (error) {
      console.error('切换学习计划失败:', error);
      toast.error(error instanceof Error ? error.message : '切换学习计划失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipMerge = async () => {
    setMergeModalOpen(false);
    toast.success('学习计划已更新');
    await finalizePlanSelection();
  };

  const handleConfirmMerge = async () => {
    if (!book) {
      return;
    }

    setMergeLoading(true);
    try {
      await studyService.mergeAlreadyLearnedWordsAsync(book.id, []);
      setMergeModalOpen(false);
      toast.success('学习记录导入任务已创建');
      await finalizePlanSelection();
    } catch (error) {
      console.error('导入学习记录失败:', error);
      toast.error(error instanceof Error ? error.message : '导入学习记录失败');
    } finally {
      setMergeLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
            返回
          </button>
          <div>
            <h1 className={styles.title}>制定计划</h1>
            <p className={styles.subtitle}>设置每日学习与复习数量，新的单词计划会立即生效。</p>
          </div>
        </header>

        {loading || !book ? (
          <section className={styles.placeholderCard}>词书信息加载中...</section>
        ) : (
          <>
            <section className={styles.bookCard}>
              {book.img ? <img className={styles.bookCoverImage} src={book.img} alt={book.name} /> : (
                <div className={`${styles.bookCover} ${getCoverTheme(book.id)}`}>
                  <span className={styles.tileTag}>{getBookTag(book.name)}</span>
                  <span className={styles.coverDeco} />
                  <span className={styles.coverDecoSmall} />
                </div>
              )}
              <div className={styles.bookMeta}>
                <h2 className={styles.bookName}>{book.name}</h2>
                <p className={styles.bookDesc}>{book.desc || '暂无词书描述'}</p>
                <p className={styles.bookCount}>共 {book.total_words_count} 词</p>
                {currentBook?.id === book.id ? (
                  <span className={styles.currentBadge}>当前学习中的词书</span>
                ) : null}
              </div>
            </section>

            <div className={styles.planBody}>
              <div className={styles.planMain}>
                <section className={styles.summaryCard}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>剩余词数</span>
                    <span className={styles.summaryValue}>{remainingWords}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={`${styles.summaryValue} ${styles.summaryHighlight}`}>
                      {completionInfo ? completionInfo.endDateLabel : '请输入有效的每日学习数'}
                    </span>
                    <span className={styles.summaryLabel}>完成日期</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryValue}>
                      {completionInfo ? completionInfo.days : '--'}
                      <span className={styles.summaryUnit}>天</span>
                    </span>
                    <span className={styles.summaryLabel}>预计完成天数</span>
                  </div>
                </section>

                <section className={styles.formCard}>
                  <p className={styles.formTitle}>每日设置</p>

                  <div className={styles.formRow}>
                    <label className={styles.label} htmlFor="dailyPlanCount">每日学习数</label>
                    <div className={`${styles.inputShell} ${dailyPlanError ? styles.inputShellError : ''}`}>
                      <button
                        type="button"
                        className={styles.stepButton}
                        onClick={() => setDailyPlanInput((value) => updatePlanValue(value, -5, false))}
                      >
                        −
                      </button>
                      <span className={styles.stepDivider} />
                      <input
                        id="dailyPlanCount"
                        className={styles.input}
                        inputMode="numeric"
                        value={dailyPlanInput}
                        onChange={(event) => setDailyPlanInput(event.target.value)}
                        placeholder="请输入每日学习数"
                      />
                      <span className={styles.stepDivider} />
                      <button
                        type="button"
                        className={styles.stepButton}
                        onClick={() => setDailyPlanInput((value) => updatePlanValue(value, 5, false))}
                      >
                        +
                      </button>
                    </div>
                    {dailyPlanError ? <p className={styles.errorText}>{dailyPlanError}</p> : null}
                  </div>

                  <div className={styles.formRow}>
                    <label className={styles.label} htmlFor="reviewPlanCount">每日复习数</label>
                    <div className={`${styles.inputShell} ${reviewPlanError ? styles.inputShellError : ''}`}>
                      <button
                        type="button"
                        className={styles.stepButton}
                        onClick={() => setReviewPlanInput((value) => updatePlanValue(value, -5, true))}
                      >
                        −
                      </button>
                      <span className={styles.stepDivider} />
                      <input
                        id="reviewPlanCount"
                        className={styles.input}
                        inputMode="numeric"
                        value={reviewPlanInput}
                        onChange={(event) => setReviewPlanInput(event.target.value)}
                        placeholder="请输入每日复习数"
                      />
                      <span className={styles.stepDivider} />
                      <button
                        type="button"
                        className={styles.stepButton}
                        onClick={() => setReviewPlanInput((value) => updatePlanValue(value, 5, true))}
                      >
                        +
                      </button>
                    </div>
                    {reviewPlanError ? <p className={styles.errorText}>{reviewPlanError}</p> : null}
                  </div>

                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                  >
                    {submitting ? '保存中...' : '开始学习该计划'}
                  </button>
                </section>
              </div>

              <aside className={styles.rightPanel}>
                <section className={styles.infoCard}>
                  <p className={styles.infoCardTitle}>完成进度</p>
                  <div className={styles.progressWrap}>
                    <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
                      <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" className={styles.progressTrack} strokeWidth="9" />
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke="currentColor"
                        className={styles.progressValue}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        transform="rotate(-90 60 60)"
                      />
                      <text x="60" y="55" textAnchor="middle" className={styles.progressText}>
                        {progressPercent}%
                      </text>
                      <text x="60" y="72" textAnchor="middle" className={styles.progressHint}>
                        已掌握
                      </text>
                    </svg>
                  </div>
                </section>

                <section className={styles.infoCard}>
                  <p className={styles.infoCardTitle}>学习时间线</p>
                  <div className={styles.timeline}>
                    <div className={styles.timelineItem}>
                      <span className={`${styles.timelineDot} ${styles.timelineDotDone}`} />
                      <div>
                        <p className={styles.timelineLabel}>开始学习</p>
                        <p className={styles.timelineDate}>{startedDate}</p>
                      </div>
                    </div>
                    <div className={styles.timelineItem}>
                      <span className={`${styles.timelineDot} ${styles.timelineDotNow}`} />
                      <div>
                        <p className={`${styles.timelineLabel} ${styles.timelineLabelActive}`}>进行中</p>
                        <p className={styles.timelineDate}>每天 {dailyPlanNumber || 0} 新词 + {reviewPlanNumber || 0} 复习</p>
                      </div>
                    </div>
                    <div className={styles.timelineItem}>
                      <span className={styles.timelineDot} />
                      <div>
                        <p className={styles.timelineLabel}>全部完成</p>
                        <p className={styles.timelineDate}>
                          {completionInfo ? completionInfo.shortEndDateLabel : '--'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.todayBox}>
                    <p className={styles.todayLabel}>今日任务</p>
                    <p className={styles.todayValue}>
                      学习 <span>{dailyPlanNumber || 0}</span> 词 · 复习 <span>{reviewPlanNumber || 0}</span> 词
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>

      <StudyPlanMergeModal
        open={mergeModalOpen}
        mergeCount={mergeCount}
        loading={mergeLoading}
        onSkip={() => {
          void handleSkipMerge();
        }}
        onConfirm={() => {
          void handleConfirmMerge();
        }}
      />
    </div>
  );
};

export default SelectStudyPlan;
