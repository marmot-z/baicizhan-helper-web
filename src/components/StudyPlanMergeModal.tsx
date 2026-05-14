import React from 'react';
import styles from './StudyPlanMergeModal.module.css';

interface StudyPlanMergeModalProps {
  open: boolean;
  mergeCount: number;
  onSkip: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const StudyPlanMergeModal: React.FC<StudyPlanMergeModalProps> = ({
  open,
  mergeCount,
  onSkip,
  onConfirm,
  loading = false,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="merge-modal-title">
        <h2 id="merge-modal-title" className={styles.title}>导入学习记录</h2>
        <p className={styles.description}>
          当前计划已有 {mergeCount} 个单词在其他计划中学过，导入后无需再次学习，是否需要导入学习记录？
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={onSkip} disabled={loading}>
            不导入
          </button>
          <button type="button" className={styles.primaryButton} onClick={onConfirm} disabled={loading}>
            {loading ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanMergeModal;
