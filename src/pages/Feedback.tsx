import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { FeedbackItem, FeedbackPageResponse } from '../types';
import { FeedbackApiError, feedbackService } from '../services/feedbackService';
import {
  FEEDBACK_MAX_LENGTH,
  countFeedbackCharacters,
  getFeedbackPaginationItems,
  normalizeFeedbackContent,
  parseFeedbackPage,
  validateFeedbackContent,
} from './feedbackModel';
import styles from './Feedback.module.css';

const formatTime = (value: string | null): string => {
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 16);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '请求失败，请稍后重试';

export default function Feedback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseFeedbackPage(searchParams.get('page'));
  const [pageData, setPageData] = useState<FeedbackPageResponse | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyErrors, setReplyErrors] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  const contentLength = countFeedbackCharacters(content);
  const contentValidationError = content ? validateFeedbackContent(content) : null;

  useEffect(() => {
    const textarea = feedbackTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setPageData(await feedbackService.list(page));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const paginationItems = useMemo(
    () => getFeedbackPaginationItems(page, pageData?.totalPages ?? 0),
    [page, pageData?.totalPages],
  );
  const visibleItems = useMemo(() => {
    if (!pageData) return [];
    return pageData.isAdmin
      ? pageData.items
      : pageData.items.filter((item) => Boolean(item.replyContent));
  }, [pageData]);

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page || nextPage > (pageData?.totalPages ?? 1)) return;
    setSearchParams({ page: String(nextPage) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const validationError = validateFeedbackContent(content);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await feedbackService.create(normalizeFeedbackContent(content));
      setContent('');
      toast.success(
        pageData?.isAdmin
          ? '问题已提交'
          : '问题已提交，管理员回复后将在列表中显示',
      );
      if (page === 1) {
        await loadFeedback();
      } else {
        setSearchParams({ page: '1' });
      }
    } catch (error) {
      const message = errorMessage(error);
      setSubmitError(message);
      if (error instanceof FeedbackApiError && error.code === 429) {
        setDailyLimitReached(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (item: FeedbackItem) => {
    const draft = replyDrafts[item.id] ?? '';
    const validationError = validateFeedbackContent(draft);
    if (validationError) {
      setReplyErrors((current) => ({ ...current, [item.id]: validationError }));
      return;
    }

    setReplyingId(item.id);
    setReplyErrors((current) => ({ ...current, [item.id]: '' }));
    try {
      const updated = await feedbackService.reply(item.id, normalizeFeedbackContent(draft));
      setPageData((current) => current ? {
        ...current,
        items: current.items.map((entry) => entry.id === item.id ? updated : entry),
      } : current);
      setReplyDrafts((current) => ({ ...current, [item.id]: '' }));
      toast.success('回复已发布');
    } catch (error) {
      setReplyErrors((current) => ({ ...current, [item.id]: errorMessage(error) }));
    } finally {
      setReplyingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>问题反馈</p>
            <h1>告诉我们你遇到的问题</h1>
          </div>
        </header>

        <section className={styles.composer} aria-labelledby="feedback-form-title">
          <h2 id="feedback-form-title" className={styles.visuallyHidden}>提交问题</h2>
          <label htmlFor="feedback-content" className={styles.label}>问题内容</label>
          <textarea
            id="feedback-content"
            ref={feedbackTextareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setSubmitError('');
            }}
            className={`${styles.textarea} ${contentValidationError ? styles.invalid : ''}`}
            placeholder="请填写你遇到的问题"
            rows={3}
            disabled={submitting || dailyLimitReached}
            aria-describedby="feedback-counter feedback-submit-error"
          />
          <div className={styles.composerFooter}>
            <span
              id="feedback-counter"
              className={contentLength > FEEDBACK_MAX_LENGTH ? styles.counterError : styles.counter}
            >
              {contentLength}/{FEEDBACK_MAX_LENGTH}
            </span>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSubmit}
              disabled={submitting || dailyLimitReached || Boolean(validateFeedbackContent(content))}
            >
              {submitting ? '提交中…' : dailyLimitReached ? '今日提交次数已用完' : '提交'}
            </button>
          </div>
          {(submitError || contentValidationError) && (
            <p id="feedback-submit-error" className={styles.errorMessage} role="alert">
              {submitError || contentValidationError}
            </p>
          )}
        </section>

        <section className={styles.listSection} aria-labelledby="feedback-list-title">
          <div className={styles.listHeader}>
            <div>
              <p className={styles.eyebrow}>{pageData?.isAdmin ? '全部反馈' : '公开反馈'}</p>
              <h2 id="feedback-list-title">
                {pageData?.isAdmin ? '全部问题' : '已回复的问题'}
              </h2>
            </div>
            {pageData && <span className={styles.total}>{pageData.total} 个问题</span>}
          </div>

          {loading ? (
            <div className={styles.stateCard} role="status">正在加载问题…</div>
          ) : loadError ? (
            <div className={styles.stateCard}>
              <p className={styles.errorMessage} role="alert">{loadError}</p>
              <button type="button" className={styles.secondaryButton} onClick={() => void loadFeedback()}>
                重新加载
              </button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className={styles.stateCard}>
              {pageData?.isAdmin
                ? '还没有问题，欢迎提交第一条反馈。'
                : '暂时还没有已回复的问题。'}
            </div>
          ) : (
            <ul className={styles.feedbackList}>
              {visibleItems.map((item) => {
                const replyDraft = replyDrafts[item.id] ?? '';
                const replyLength = countFeedbackCharacters(replyDraft);
                return (
                  <li key={item.id} className={styles.feedbackCard}>
                    <div className={styles.questionHeader}>
                      <time dateTime={item.createdTime}>{formatTime(item.createdTime)}</time>
                    </div>
                    {pageData?.isAdmin && item.adminInfo && (
                      <div className={styles.adminMetadata} aria-label="反馈人信息">
                        <span className={styles.adminMetadataItem}>
                          <span className={styles.adminMetadataLabel}>昵称：</span>
                          {item.adminInfo.nickname}
                        </span>
                        <span className={styles.adminMetadataItem}>
                          <span className={styles.adminMetadataLabel}>会员：</span>
                          {item.adminInfo.memberType}
                        </span>
                        <span
                          className={`${styles.visibilityBadge} ${
                            item.adminInfo.publicVisible
                              ? styles.publicVisibility
                              : styles.privateVisibility
                          }`}
                        >
                          {item.adminInfo.publicVisible ? '公开' : '仅管理员可见'}
                        </span>
                      </div>
                    )}
                    <p className={styles.content}>{item.content}</p>

                    {item.replyContent ? (
                      <div className={styles.replyBox}>
                        <div className={styles.replyHeader}>
                          <span>管理员回复</span>
                          <time dateTime={item.repliedTime ?? undefined}>{formatTime(item.repliedTime)}</time>
                        </div>
                        <p className={styles.content}>{item.replyContent}</p>
                      </div>
                    ) : pageData?.isAdmin ? (
                      <div className={styles.replyComposer}>
                        <label htmlFor={`reply-${item.id}`}>管理员回复</label>
                        <textarea
                          id={`reply-${item.id}`}
                          value={replyDraft}
                          onChange={(event) => {
                            const value = event.target.value;
                            setReplyDrafts((current) => ({ ...current, [item.id]: value }));
                            setReplyErrors((current) => ({ ...current, [item.id]: '' }));
                          }}
                          rows={3}
                          placeholder="填写一次性回复"
                          disabled={replyingId === item.id}
                        />
                        <div className={styles.replyActions}>
                          <span className={replyLength > FEEDBACK_MAX_LENGTH ? styles.counterError : styles.counter}>
                            {replyLength}/{FEEDBACK_MAX_LENGTH}
                          </span>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void handleReply(item)}
                            disabled={replyingId === item.id || Boolean(validateFeedbackContent(replyDraft))}
                          >
                            {replyingId === item.id ? '回复中…' : '发布回复'}
                          </button>
                        </div>
                        {replyErrors[item.id] && (
                          <p className={styles.errorMessage} role="alert">{replyErrors[item.id]}</p>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !loadError && (pageData?.totalPages ?? 0) > 1 && (
            <nav className={styles.pagination} aria-label="问题列表分页">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                aria-label="上一页"
              >
                ‹
              </button>
              {paginationItems.map((item) => typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  className={item === page ? styles.activePage : ''}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => goToPage(item)}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className={styles.ellipsis} aria-hidden="true">…</span>
              ))}
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page === pageData?.totalPages}
                aria-label="下一页"
              >
                ›
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
