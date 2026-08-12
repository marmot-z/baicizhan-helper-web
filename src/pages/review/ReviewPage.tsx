import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useStudyStore } from '../../stores/studyStore';
import { ROUTES } from '../../constants';
import { AudioSequencePlayer } from '../../utils/audio';
import { ReviewFlow } from '../../services/review/ReviewFlow';
import { reviewService } from '../../services/review/reviewService';
import { reviewStatisticsAdapter } from '../../services/review/reviewStatisticsAdapter';
import type { ReviewSnapshot } from '../../services/review/types';
import type { StudyUIModel } from '../../services/study/types';
import StudyLoadingState from '../../components/study/StudyLoadingState';
import ReviewChoiceCard from './ReviewChoiceCard';
import ReviewWordDetail from './ReviewWordDetail';
import ReviewSpellCard from './ReviewSpellCard';
import styles from './review.module.css';
import {
  createStudySessionId,
  getLocalPlanDate,
  studySessionStore,
} from '../../services/study/sessionStore';
import type { ReviewSessionState } from '../../services/study/sessionTypes';

/** 防止 React Strict Mode 下同一轮复习完成触发两次 navigate */
const navigatedReviewStatisticsKeys = new Set<string>();

const buildReviewStatisticsNavKey = (state: NonNullable<ReviewSnapshot['summaryState']>) =>
  `${state.totalWords}-${state.completedWords}-${state.totalErrors}-${state.records
    .map((r) => `${r.topicId}:${r.errorCount}:${r.completedAt ?? ''}`)
    .join('|')}`;

const createLoadingSnapshot = (): ReviewSnapshot => ({
  stage: 'loading',
  totalWords: 0,
  completedChoiceWords: 0,
  completedSpellWords: 0,
  choiceState: null,
  detailState: null,
  spellState: null,
  summaryState: null,
  errorMessage: null,
});

const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentBook,
    studyPlan,
    wordList,
    fetchStudyData,
    setLastReviewStatistics,
  } = useStudyStore();
  const flowRef = useRef<ReviewFlow | null>(null);
  const reviewWordsRef = useRef<StudyUIModel[]>([]);
  const spellWordTopicIdRef = useRef<number | null>(null);
  const choiceSentenceReadyRef = useRef(false);
  const [snapshot, setSnapshot] = useState<ReviewSnapshot>(createLoadingSnapshot);
  const [spellInput, setSpellInput] = useState('');
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!studyPlan || !currentBook || !wordList.length) {
      fetchStudyData().catch(console.error);
    }
  }, [studyPlan, currentBook, wordList.length, fetchStudyData]);

  useEffect(() => {
    if (!studyPlan || !currentBook || !wordList.length) {
      return;
    }

    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    const startReview = async () => {
      try {
        const planDate = getLocalPlanDate();
        studySessionStore.removeExpired(planDate);
        const savedDraft = studySessionStore.load('review', studyPlan.book_id);
        let flow: ReviewFlow;
        let restored = false;
        let initData;

        if (savedDraft) {
          try {
            initData = await reviewService.initializeReviewWords(
              studyPlan.book_id,
              studyPlan.review_plan_count,
              savedDraft.state.wordTopicIds,
            );
            const persistCheckpoint = (state: ReviewSessionState) => {
              const saved = studySessionStore.save({
                ...savedDraft,
                updatedAt: Date.now(),
                state,
              });
              if (isActive) setDraftSaveFailed(!saved);
            };
            flow = ReviewFlow.restore(initData, savedDraft.state, persistCheckpoint);
            restored = true;
          } catch (restoreError) {
            console.error('恢复复习进度失败，将重新开始:', restoreError);
            studySessionStore.clear('review', studyPlan.book_id);
            initData = await reviewService.initializeReviewWords(
              studyPlan.book_id,
              studyPlan.review_plan_count,
            );
            const now = Date.now();
            const sessionId = createStudySessionId();
            flow = new ReviewFlow(initData, (state) => {
              const saved = studySessionStore.save({
                version: 1,
                mode: 'review',
                bookId: studyPlan.book_id,
                planDate,
                createdAt: now,
                updatedAt: Date.now(),
                sessionId,
                state,
              });
              if (isActive) setDraftSaveFailed(!saved);
            });
          }
        } else {
          initData = await reviewService.initializeReviewWords(
            studyPlan.book_id,
            studyPlan.review_plan_count,
          );
          const now = Date.now();
          const sessionId = createStudySessionId();
          flow = new ReviewFlow(initData, (state) => {
            const saved = studySessionStore.save({
              version: 1,
              mode: 'review',
              bookId: studyPlan.book_id,
              planDate,
              createdAt: now,
              updatedAt: Date.now(),
              sessionId,
              state,
            });
            if (isActive) setDraftSaveFailed(!saved);
          });
        }

        if (!isActive) {
          return;
        }

        reviewWordsRef.current = initData.words;
        flowRef.current = flow;
        unsubscribe = flow.subscribe((nextSnapshot) => {
          if (!isActive) {
            return;
          }

          setSnapshot(nextSnapshot);
          if (nextSnapshot.stage === 'spelling' && nextSnapshot.spellState) {
            const topicId = nextSnapshot.spellState.word.topicId;
            if (spellWordTopicIdRef.current !== topicId) {
              spellWordTopicIdRef.current = topicId;
              setSpellInput('');
            }
          } else {
            spellWordTopicIdRef.current = null;
          }
        });

        if (restored) {
          await flow.resume();
          toast.success('已恢复上次复习进度');
        } else {
          await flow.start();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '复习初始化失败';
        if (!isActive) {
          return;
        }

        setSnapshot((prev) => ({
          ...prev,
          stage: 'error',
          errorMessage: message,
          choiceState: null,
          detailState: null,
          spellState: null,
          summaryState: null,
        }));
      }
    };

    startReview().catch(console.error);

    return () => {
      isActive = false;
      flowRef.current?.checkpoint();
      flowRef.current = null;
      reviewWordsRef.current = [];
      unsubscribe?.();
    };
  }, [studyPlan, currentBook, wordList, retryKey]);

  useEffect(() => {
    const checkpoint = () => flowRef.current?.checkpoint();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        checkpoint();
      }
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (draftSaveFailed) {
        event.preventDefault();
        event.returnValue = '复习进度保存失败，退出后可能丢失当前进度';
      }
    };
    window.addEventListener('pagehide', checkpoint);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      checkpoint();
      window.removeEventListener('pagehide', checkpoint);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draftSaveFailed]);

  const activeWord = useMemo(() => {
    if (snapshot.choiceState) {
      return snapshot.choiceState.word;
    }

    if (snapshot.detailState) {
      return snapshot.detailState.word;
    }

    if (snapshot.spellState) {
      return snapshot.spellState.word;
    }

    return null;
  }, [snapshot.choiceState, snapshot.detailState, snapshot.spellState]);

  useEffect(() => {
    if (!activeWord || snapshot.stage === 'choice') {
      return;
    }

    const player = new AudioSequencePlayer();
    player.playSequence([activeWord.front.accent.ukAudio], 400);

    return () => {
      player.stop();
    };
  }, [activeWord, snapshot.stage]);

  useEffect(() => {
    const choiceState = snapshot.choiceState;
    const isInitialChoiceReady =
      snapshot.stage === 'choice' &&
      choiceState != null &&
      !choiceState.isOptionsLoading &&
      choiceState.attemptCount === 0;

    if (!isInitialChoiceReady) {
      choiceSentenceReadyRef.current = false;
      return;
    }

    if (choiceSentenceReadyRef.current) {
      return;
    }

    choiceSentenceReadyRef.current = true;
    const player = new AudioSequencePlayer();
    player.playSequence(
      [
        choiceState.word.front.accent.ukAudio,
        choiceState.word.back.sentences[0]?.audio,
      ],
      400
    );

    return () => {
      player.stop();
    };
  }, [snapshot.stage, snapshot.choiceState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (snapshot.stage === 'choice' && snapshot.choiceState) {
        if (['1', '2', '3', '4'].includes(event.key)) {
          const optionIndex = Number(event.key) - 1;
          const option = snapshot.choiceState.options[optionIndex];
          if (!option || option.disabled) {
            return;
          }

          flowRef.current?.chooseOption(option.id).catch(console.error);
        }
        return;
      }

      if (snapshot.stage === 'detail' && snapshot.detailState && event.key === ' ') {
        event.preventDefault();
        flowRef.current?.continueFromDetail().catch(console.error);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [snapshot.stage, snapshot.choiceState, snapshot.detailState]);

  useEffect(() => {
    if (snapshot.stage !== 'summary' || !snapshot.summaryState) {
      return;
    }

    const summaryState = snapshot.summaryState;
    const navKey = buildReviewStatisticsNavKey(summaryState);
    if (navigatedReviewStatisticsKeys.has(navKey)) {
      return;
    }
    navigatedReviewStatisticsKeys.add(navKey);

    // 将复习统计转换为学习结束页现有依赖的数据结构，避免改动学习结束页。
    const reviewStatistics = reviewStatisticsAdapter.toStudyStatistics(
      summaryState,
      reviewWordsRef.current
    );
    setLastReviewStatistics(reviewStatistics);

    navigate(ROUTES.STUDY_STATISTICS, {
      state: {
        source: 'review',
        statisticsOverride: reviewStatistics,
        from: location.pathname,
      },
    });
  }, [snapshot.stage, snapshot.summaryState, navigate, setLastReviewStatistics, location.pathname]);

  if (!studyPlan || !currentBook) {
    return (
      <StudyLoadingState
        title="正在加载复习计划..."
        subtitle={"正在同步今日计划和单词书信息，请稍候。\n可使用 1-4 快捷选择选项，单词详情页可按空格进入下一个。"}
      />
    );
  }

  if (snapshot.stage === 'loading') {
    return (
      <StudyLoadingState
        title="正在准备复习内容..."
        subtitle={"正在整理复习单词和选项资源，完成后会自动进入复习。\n可使用 1-4 快捷选择选项，单词详情页可按空格进入下一个。"}
      />
    );
  }

  if (snapshot.stage === 'empty') {
    return (
      <div className={styles.placeholderPage}>
        <div className={styles.placeholderCard}>
          <p>暂无可复习的单词。</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (snapshot.stage === 'error') {
    return (
      <div className={styles.placeholderPage}>
        <div className={styles.placeholderCard}>
          <p>{snapshot.errorMessage || '复习页面加载失败'}</p>
          <div className={styles.summaryActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setSnapshot(createLoadingSnapshot());
                setRetryKey((current) => current + 1);
              }}
            >
              重新加载
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
  }

  if (snapshot.stage === 'choice' && snapshot.choiceState) {
    return (
      <ReviewChoiceCard
        state={snapshot.choiceState}
        totalWords={snapshot.totalWords}
        completedWords={snapshot.completedChoiceWords}
        onChoose={(optionId) => {
          flowRef.current?.chooseOption(optionId).catch(console.error);
        }}
      />
    );
  }

  if (snapshot.stage === 'detail' && snapshot.detailState) {
    return (
      <ReviewWordDetail
        state={snapshot.detailState}
        onNext={() => {
          flowRef.current?.continueFromDetail().catch(console.error);
        }}
      />
    );
  }

  if (snapshot.stage === 'spelling' && snapshot.spellState) {
    return (
      <ReviewSpellCard
        state={snapshot.spellState}
        inputValue={spellInput}
        onInputChange={(value) => {
          if (snapshot.spellState?.isWrong) {
            flowRef.current?.clearSpellWrongOnInput();
            setSpellInput(value.slice(-1));
          } else {
            setSpellInput(value);
          }
        }}
        onSubmit={() => {
          flowRef.current?.submitSpell(spellInput).catch(console.error);
        }}
      />
    );
  }

  if (snapshot.stage === 'summary' && snapshot.summaryState) {
    return (
      <div className={styles.placeholderPage}>
        <div className={styles.placeholderCard}>正在跳转统计页...</div>
      </div>
    );
  }

  return null;
};

export default ReviewPage;
