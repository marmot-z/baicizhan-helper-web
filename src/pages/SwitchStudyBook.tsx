import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import { studyService } from '../services/studyService';
import { useStudyStore } from '../stores/studyStore';
import type { UserBookBasicInfo } from '../types';
import {
  buildSwitchStudyBookItems,
  type SwitchStudyBookItem,
} from './switchStudyBookModel';
import styles from './SwitchStudyBook.module.css';

const COVER_THEMES = [
  styles.coverOrange,
  styles.coverGold,
  styles.coverGreen,
  styles.coverBlue,
  styles.coverPurple,
  styles.coverRose,
];

function getBookName(item: SwitchStudyBookItem): string {
  return item.book?.name ?? `词书 ${item.plan.book_id}`;
}

function getBookDescription(item: SwitchStudyBookItem): string {
  return item.book?.desc || '暂无词书描述';
}

function getBookTag(name: string): string {
  return name.trim().slice(0, 6) || '词书';
}

function getCoverTheme(bookId: number): string {
  return COVER_THEMES[Math.abs(bookId) % COVER_THEMES.length];
}

const SwitchStudyBook: React.FC = () => {
  const navigate = useNavigate();
  const studyPlans = useStudyStore((state) => state.studyPlans);
  const refreshStudyPlans = useStudyStore((state) => state.refreshStudyPlans);
  const switchStudyBook = useStudyStore((state) => state.switchStudyBook);

  const [books, setBooks] = useState<UserBookBasicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<SwitchStudyBookItem | null>(null);
  const [switchingBookId, setSwitchingBookId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [, booksData] = await Promise.all([
        refreshStudyPlans(),
        studyService.getAllBooks(),
      ]);
      setBooks(booksData.books);
    } catch (error) {
      console.error('获取已选词书计划失败:', error);
      const message = error instanceof Error ? error.message : '获取已选词书计划失败';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [refreshStudyPlans]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const items = useMemo(
    () => buildSwitchStudyBookItems(studyPlans, books),
    [studyPlans, books],
  );

  const handleSwitchConfirm = async () => {
    if (!confirmItem || switchingBookId !== null) {
      return;
    }

    setSwitchingBookId(confirmItem.plan.book_id);

    try {
      await switchStudyBook(confirmItem.plan);
      toast.success('已切换当前词书');
      navigate(ROUTES.DASHBOARD);
    } catch (error) {
      console.error('切换词书失败:', error);
      toast.error(error instanceof Error ? error.message : '切换词书失败');
    } finally {
      setSwitchingBookId(null);
      setConfirmItem(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            返回
          </button>
          <div>
            <h1 className={styles.title}>更换词书</h1>
            <p className={styles.subtitle}>选择已经制定过计划的词书，保留原计划数量并切换当前学习。</p>
          </div>
        </header>

        {loading ? (
          <section className={styles.placeholderCard}>已选词书计划加载中...</section>
        ) : loadError ? (
          <section className={styles.placeholderCard}>
            <p className={styles.placeholderTitle}>加载失败</p>
            <p className={styles.placeholderText}>{loadError}</p>
            <button type="button" className={styles.secondaryButton} onClick={loadData}>
              重试
            </button>
          </section>
        ) : items.length === 0 ? (
          <section className={styles.placeholderCard}>
            <p className={styles.placeholderTitle}>暂无已选词书计划</p>
            <p className={styles.placeholderText}>先添加词书并制定计划后，就可以在这里快速切换。</p>
          </section>
        ) : (
          <div className={styles.planList}>
            {items.map((item) => {
              const bookName = getBookName(item);
              const switching = switchingBookId === item.plan.book_id;

              return (
                <button
                  key={item.plan.book_id}
                  type="button"
                  className={`${styles.planCard} ${item.isCurrent ? styles.planCardCurrent : ''}`}
                  disabled={item.isCurrent || switchingBookId !== null}
                  onClick={() => setConfirmItem(item)}
                  aria-current={item.isCurrent ? 'true' : undefined}
                >
                  <div className={styles.cardTop}>
                    {item.book?.img ? (
                      <img className={styles.bookCoverImage} src={item.book.img} alt={bookName} />
                    ) : (
                      <div className={`${styles.bookCover} ${getCoverTheme(item.plan.book_id)}`}>
                        <span className={styles.tileTag}>{getBookTag(bookName)}</span>
                        <span className={styles.coverDeco} />
                        <span className={styles.coverDecoSmall} />
                      </div>
                    )}

                    <div className={styles.bookMeta}>
                      <div className={styles.bookTitleRow}>
                        <h2 className={styles.bookName}>{bookName}</h2>
                        {item.isCurrent ? (
                          <span className={styles.currentBadge}>当前在学</span>
                        ) : null}
                      </div>
                      <p className={styles.planLine}>
                        每日 {item.plan.daily_plan_count} 词，剩余 {item.remainingDays} 天
                      </p>
                      <p className={styles.bookDesc}>{getBookDescription(item)}</p>
                    </div>
                  </div>

                  <div className={styles.progressBlock}>
                    <div className={styles.progressTrack}>
                      <span
                        className={styles.progressFill}
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                    <div className={styles.progressMeta}>
                      <span>已学 {item.learnedWordsCount}</span>
                      <span>{item.totalWordsCount}词</span>
                    </div>
                  </div>

                  {!item.isCurrent ? (
                    <span className={styles.switchHint}>{switching ? '切换中...' : '点击切换'}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.footerBar}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate(ROUTES.ALL_BOOKS)}
          >
            添加词书
          </button>
        </div>
      </div>

      {confirmItem ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-study-book-title"
          >
            <h2 id="switch-study-book-title" className={styles.modalTitle}>
              切换到{getBookName(confirmItem)}？
            </h2>
            <p className={styles.modalText}>
              将保留该词书原有的每日 {confirmItem.plan.daily_plan_count} 词计划，并作为当前学习词书。
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setConfirmItem(null)}
                disabled={switchingBookId !== null}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSwitchConfirm}
                disabled={switchingBookId !== null}
              >
                {switchingBookId !== null ? '切换中...' : '确认切换'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default SwitchStudyBook;
