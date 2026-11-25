import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { accountSession } from '../services/accountSession';
import { learningAgentService } from '../services/learningAgentService';
import type { LearningAgentProfile } from '../services/learningAgentService';
import { useAuthStore } from '../stores/authStore';
import LearningAgentBookPicker from './LearningAgentBookPicker';
import styles from './LearningAgent.module.css';

const planFields = [
  { name: 'dailyNew', label: '每日新学' },
  { name: 'dailyReview', label: '每日复习' },
] as const;

export default function LearningAgent() {
  const accountVersion = useAuthStore(accountSession.getVersion);
  return <LearningAgentPage key={accountVersion} />;
}

function LearningAgentPage() {
  const [profile, setProfile] = useState<LearningAgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bookAction = useRef<HTMLButtonElement>(null);
  const [plan, setPlan] = useState({ dailyNew: 10, dailyReview: 5 });
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const book = profile?.book;
  const bookTitle = book?.name ?? (profile ? `词书 #${profile.bookId}` : '词书介绍');

  useEffect(() => {
    const controller = new AbortController();

    void learningAgentService.getProfile(controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        setProfile(data);
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setLoadError('学习档案加载失败，请重试。');
      }
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });

    return () => controller.abort();
  }, [loadAttempt]);

  function retryProfile() {
    setLoading(true);
    setLoadError('');
    setLoadAttempt((attempt) => attempt + 1);
  }

  function closeBookPicker() {
    setPickerOpen(false);
    window.requestAnimationFrame(() => bookAction.current?.focus());
  }

  function closePlanEditor() {
    setIsEditing(false);
    editButton.current?.focus();
  }

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPlan({
      dailyNew: Number(fields.get('dailyNew')),
      dailyReview: Number(fields.get('dailyReview')),
    });
    closePlanEditor();
  }

  return (
    <section className={styles.page} aria-labelledby="learning-agent-title">
      <h1 id="learning-agent-title" className={styles.pageTitle}>
        英语学习 Agent
      </h1>

      <div className={styles.overview} data-empty={!profile || undefined}>
        <div className={styles.bookPanel}>
          {profile ? (
            <>
              <div className={styles.coverFrame}>
                {book?.img ? (
                  <img className={styles.coverImage} src={book.img} alt="" />
                ) : (
                  <div className={styles.cover} aria-hidden="true">
                    <span className={styles.coverTitle}>{bookTitle}</span>
                  </div>
                )}
                <button
                  ref={bookAction}
                  className={`${styles.editButton} ${styles.bookEditButton}`}
                  type="button"
                  title="更换词书"
                  aria-label="更换词书"
                  aria-haspopup="dialog"
                  onClick={() => setPickerOpen(true)}
                >
                  <FontAwesomeIcon icon={faPencil} aria-hidden="true" />
                </button>
              </div>
              {book && (
                <div className={styles.progress}>
                  <label htmlFor="learning-agent-progress">已学单词</label>
                  <div className={styles.progressCount}>
                    <strong>0</strong>
                    <span> / {book.total_words_count.toLocaleString('zh-CN')} 词</span>
                  </div>
                  <progress id="learning-agent-progress" value={0} max={Math.max(1, book.total_words_count)} />
                </div>
              )}
            </>
          ) : loading ? (
            <p className={styles.feedback} role="status">学习档案加载中…</p>
          ) : loadError ? (
            <div className={styles.feedback}>
              <p role="alert">{loadError}</p>
              <button className={styles.secondaryAction} type="button" onClick={retryProfile}>重试</button>
            </div>
          ) : (
            <button
              ref={bookAction}
              className={styles.emptyCover}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setPickerOpen(true)}
            >
              未选择词书
            </button>
          )}
        </div>

        <div className={styles.details}>
          <section className={styles.introduction}>
            <h2>{bookTitle}</h2>
            {profile?.bookIntroduction && <p>{profile.bookIntroduction}</p>}
          </section>

          <section className={styles.detailSection}>
            <h3>学习路线概要</h3>
            {profile?.learningRoute && <p>{profile.learningRoute}</p>}
          </section>

          <section className={styles.detailSection}>
            <div className={styles.planHeader}>
              <h3>每日学习计划</h3>
              <button
                ref={editButton}
                className={styles.editButton}
                type="button"
                title="修改每日学习计划"
                aria-label="修改每日学习计划"
                aria-expanded={isEditing}
                aria-controls="learning-agent-plan"
                onClick={() => setIsEditing(!isEditing)}
              >
                <FontAwesomeIcon icon={faPencil} aria-hidden="true" />
              </button>
            </div>

            <div id="learning-agent-plan">
              {isEditing ? (
                <form onSubmit={savePlan}>
                  <div className={styles.plan}>
                    {planFields.map(({ name, label }) => (
                      <label className={styles.planEntry} key={name}>
                        {label}
                        <input
                          className={styles.planInput}
                          type="number"
                          name={name}
                          min={0}
                          max={book?.total_words_count ?? Number.MAX_SAFE_INTEGER}
                          step={1}
                          required
                          defaultValue={plan[name]}
                          autoFocus={name === 'dailyNew'}
                        />
                      </label>
                    ))}
                  </div>
                  <div className={styles.planActions}>
                    <button type="button" onClick={closePlanEditor}>取消</button>
                    <button className={styles.savePlan} type="submit">保存</button>
                  </div>
                </form>
              ) : (
                <dl className={styles.plan}>
                  {planFields.map(({ name, label }) => (
                    <div className={styles.planEntry} key={name}>
                      <dt>{label}</dt>
                      <dd><strong>{plan[name]}</strong> 词</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.startButton} data-empty={!profile || undefined} type="button" disabled>
          开始学习
        </button>
      </div>

      {pickerOpen && (
        <LearningAgentBookPicker
          currentBookId={profile?.bookId}
          onClose={closeBookPicker}
          onSelected={(updatedProfile) => {
            setProfile(updatedProfile);
            closeBookPicker();
          }}
        />
      )}
    </section>
  );
}
