import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReviewSummaryState } from '../../services/review/types';
import { ROUTES, STORAGE_KEYS } from '../../constants';
import styles from './review.module.css';

interface ReviewSummaryProps {
  state: ReviewSummaryState;
}

const ReviewSummary: React.FC<ReviewSummaryProps> = ({ state }) => {
  const navigate = useNavigate();

  const goToStatistics = () => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.STUDY_STATS_REVIEW_NAV, '1');
    } catch {
      // ignore
    }
    navigate(ROUTES.STUDY_STATISTICS, {
      state: {
        mode: 'review' as const,
        reviewStatistics: {
          totalWords: state.totalWords,
          totalErrors: state.totalErrors,
          completedWords: state.completedWords,
          records: state.records.map((r) => ({
            topicId: r.topicId,
            word: r.word,
            errorCount: r.errorCount,
            completedAt: r.completedAt,
          })),
        },
      },
    });
  };

  return (
    <div className={styles.pageShell}>
      <div className={styles.summaryCard}>
        <div className={styles.summaryTop}>
          <h1 className={styles.summaryTitle}>复习完成</h1>
          <p className={styles.summarySubtitle}>本轮复习和拼写已经全部完成</p>
        </div>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStatItem}>
            <span className={styles.summaryStatValue}>{state.totalWords}</span>
            <span className={styles.summaryStatLabel}>总词数</span>
          </div>
          <div className={styles.summaryStatItem}>
            <span className={styles.summaryStatValue}>{state.totalErrors}</span>
            <span className={styles.summaryStatLabel}>总错误次数</span>
          </div>
          <div className={styles.summaryStatItem}>
            <span className={styles.summaryStatValue}>{state.completedWords}</span>
            <span className={styles.summaryStatLabel}>已完成</span>
          </div>
        </div>

        <div className={styles.summaryList}>
          {state.records.map((record) => (
            <div key={record.topicId} className={styles.summaryRow}>
              <div>
                <strong>{record.word}</strong>
              </div>
              <div className={styles.summaryMeta}>
                <span>错误 {record.errorCount} 次</span>
                <span>
                  完成于{' '}
                  {record.completedAt
                    ? new Date(record.completedAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '未完成'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.summaryActions}>
          <button type="button" className={styles.primaryButton} onClick={goToStatistics}>
            查看统计详情
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewSummary;
