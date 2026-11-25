import { useEffect, useRef, useState } from 'react';
import { learningAgentService } from '../services/learningAgentService';
import type { LearningAgentProfile } from '../services/learningAgentService';
import { studyService } from '../services/studyService';
import type { AllBooksResponse } from '../services/studyService';
import type { UserBookBasicInfo } from '../types';
import WordBookCatalog from './WordBookCatalog';
import styles from './LearningAgent.module.css';

interface LearningAgentBookPickerProps {
  currentBookId?: number;
  onClose: () => void;
  onSelected: (profile: LearningAgentProfile) => void;
}

export default function LearningAgentBookPicker({ currentBookId, onClose, onSelected }: LearningAgentBookPickerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmTitle = useRef<HTMLHeadingElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [catalog, setCatalog] = useState<AllBooksResponse | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [candidate, setCandidate] = useState<UserBookBasicInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void studyService.getAllBooks(controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        setCatalog(data);
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setCatalogError('词书列表加载失败，请重试。');
      }
    });

    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    if (confirming) {
      confirmTitle.current?.focus();
    }
  }, [confirming]);

  function retryCatalog() {
    setCatalogError('');
    setLoadAttempt((attempt) => attempt + 1);
  }

  function returnToCatalog() {
    setConfirming(false);
    setSaveError('');
    window.requestAnimationFrame(() => confirmButton.current?.focus());
  }

  async function saveSelection() {
    if (!candidate || candidate.id === currentBookId || saving) {
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      onSelected(await learningAgentService.selectBook(candidate.id));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '更换词书失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className={styles.bookPicker}
      aria-labelledby={confirming ? 'agent-book-confirm-title' : 'agent-book-picker-title'}
      onCancel={(event) => {
        event.preventDefault();
        if (saving) return;
        if (confirming) returnToCatalog();
        else onClose();
      }}
    >
      <div hidden={confirming} className={styles.pickerCatalog}>
        <h2 className={styles.pickerTitle} id="agent-book-picker-title">选择词书</h2>
        <div className={styles.pickerBody}>
          {catalogError ? (
            <div className={styles.feedback}>
              <p role="alert">{catalogError}</p>
              <button className={styles.secondaryAction} type="button" onClick={retryCatalog}>重试</button>
            </div>
          ) : !catalog ? (
            <p className={styles.feedback} role="status">词书加载中…</p>
          ) : (
            <WordBookCatalog
              data={catalog}
              currentBookId={currentBookId}
              currentBookLabel="当前词书"
              selectedBookId={candidate?.id ?? null}
              onBookClick={setCandidate}
            />
          )}
        </div>
        <div className={styles.pickerActions}>
          <button className={styles.secondaryAction} type="button" onClick={onClose}>取消</button>
          <button
            ref={confirmButton}
            className={styles.primaryAction}
            type="button"
            disabled={!candidate || candidate.id === currentBookId}
            onClick={() => setConfirming(true)}
          >
            确认
          </button>
        </div>
      </div>

      {confirming && candidate && (
        <div className={styles.pickerConfirmation}>
          <h2 className={styles.pickerTitle} id="agent-book-confirm-title" ref={confirmTitle} tabIndex={-1}>
            是否确认修改词书
          </h2>
          <p>{candidate.name}</p>
          {saveError && <p className={styles.pickerError} role="alert">{saveError}</p>}
          <div className={styles.pickerActions}>
            <button className={styles.secondaryAction} type="button" disabled={saving} onClick={returnToCatalog}>取消</button>
            <button className={styles.primaryAction} type="button" disabled={saving} onClick={saveSelection}>
              {saving ? '保存中…' : '确认更换'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
