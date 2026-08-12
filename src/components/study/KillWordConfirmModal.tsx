import { useEffect, useRef } from 'react';
import styles from './KillWordConfirmModal.module.css';

interface KillWordConfirmModalProps {
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const KillWordConfirmModal: React.FC<KillWordConfirmModalProps> = ({
  open,
  submitting,
  onCancel,
  onConfirm,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={submitting ? undefined : onCancel}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kill-word-title"
        aria-describedby="kill-word-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="kill-word-title">确定斩掉该单词？</h2>
        <p id="kill-word-description">
          这个单词已经掌握了吗？斩掉的单词就不会再学习了
        </p>
        <div className={styles.actions}>
          <button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={submitting}>
            取消
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? '正在保存…' : '斩掉'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default KillWordConfirmModal;
