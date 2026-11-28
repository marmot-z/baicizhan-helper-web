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
import studyStyles from '../StudyView.module.css';
import KillWordConfirmModal from '../../components/study/KillWordConfirmModal';
import {
  getLocalPlanDate,
  studySessionStore,
} from '../../services/study/sessionStore';
import { studyRecordStore } from '../../services/study/recordStore';
import type { ReviewSessionState } from '../../services/study/sessionTypes';
import {
  formatShortcutCode,
  resolvePreferredAudio,
  shortcutMatches,
  shouldIgnoreShortcutEvent,
  useSettingsStore,
} from '../../stores/settingsStore';

/** 防止 React Strict Mode 下同一轮复习完成触发两次 navigate */
const navigatedReviewStatisticsKeys = new Set<string>();

const buildReviewStatisticsNavKey = (state: NonNullable<ReviewSnapshot['summaryState']>) =>
  `${state.totalWords}-${state.completedWords}-${state.totalErrors}-${[...state.killedTopicIds]
    .sort((a, b) => a - b)
    .join(',')}-${state.records
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
    wordListBookId,
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
  const [metadataReady, setMetadataReady] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [killSubmitting, setKillSubmitting] = useState(false);
  const [killAnimating, setKillAnimating] = useState(false);
  const showMedia = useSettingsStore((state) => state.showMedia);
  const studyReviewAutoPronounce = useSettingsStore((state) => state.studyReviewAutoPronounce);
  const pronunciationPreference = useSettingsStore((state) => state.pronunciationPreference);
  const shortcuts = useSettingsStore((state) => state.shortcuts);

  useEffect(() => {
    let isActive = true;
    setMetadataReady(false);
    setMetadataError(null);
    const hasPreparedResources = () => {
      const state = useStudyStore.getState();
      const bookId = state.studyPlan?.book_id;
      return bookId !== undefined && state.currentBook?.id === bookId
        && state.wordListBookId === bookId && state.preparedBookId === bookId;
    };

    const prepare = async () => {
      try {
        await fetchStudyData();
        if (!isActive) return;
        const state = useStudyStore.getState();
        if (state.studyPlan && !hasPreparedResources()) {
          throw new Error(state.studyStateError || '复习计划或单词书加载失败，请重试');
        }
        setMetadataReady(true);
      } catch (error) {
        if (!isActive) return;
        // 已准备好的词书仍可复习，后台请求失败不撤销本地可用状态。
        if (hasPreparedResources()) setMetadataReady(true);
        else setMetadataError(error instanceof Error ? error.message : '复习计划加载失败，请重试');
      }
    };
    void prepare();
    return () => { isActive = false; };
  }, [fetchStudyData, retryKey]);

  useEffect(() => {
    if (!metadataReady || !studyPlan || !currentBook || wordListBookId !== studyPlan.book_id) {
      return;
    }

    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    const startReview = async () => {
      try {
        await studyRecordStore.initialize();
        const planDate = getLocalPlanDate();
        await studySessionStore.removeExpired(planDate);
        const savedDraft = studySessionStore.load('review', studyPlan.book_id);
        const resumeTopicIds = savedDraft?.state.wordTopicIds.length ? savedDraft.state.wordTopicIds : undefined;
        let initData = await reviewService.initializeReviewWords(studyPlan.book_id, studyPlan.review_plan_count, resumeTopicIds);
        if (!isActive) {
          return;
        }

        let flow: ReviewFlow | undefined;
        let restored = false;
        const newDraft = {
          version: 1 as const,
          mode: 'review' as const,
          bookId: studyPlan.book_id,
          planDate,
          createdAt: Date.now(),
        };
        const persistCheckpoint = async (state: ReviewSessionState) => {
          if (!isActive) return;
          const saved = await studySessionStore.save({
            ...(restored && savedDraft ? savedDraft : newDraft),
            sessionId: state.sessionId,
            updatedAt: Date.now(),
            state,
          }, () => isActive);
          if (isActive) setDraftSaveFailed(!saved);
        };

        if (savedDraft && resumeTopicIds) {
          try {
            flow = ReviewFlow.restore(initData, savedDraft.state, persistCheckpoint);
            restored = true;
          } catch (restoreError) {
            console.error('恢复复习草稿失败，将重新开始:', restoreError);
            initData = await reviewService.initializeReviewWords(studyPlan.book_id, studyPlan.review_plan_count);
          }
        }

        if (!isActive) {
          return;
        }

        flow ??= new ReviewFlow(initData, persistCheckpoint);
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

        flow.setPaused(document.visibilityState === 'hidden');
        if (restored) {
          await flow.resume();
        } else {
          await flow.start();
        }

        if (isActive && initData.missingTopicIds.length > 0) {
          toast(`有 ${initData.missingTopicIds.length} 个单词暂时无法加载，已跳过本轮`);
        } else if (isActive && restored) {
          toast.success('已恢复上次复习进度');
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
  }, [metadataReady, studyPlan, currentBook, wordList, wordListBookId, retryKey]);

  useEffect(() => {
    const checkpoint = () => { flowRef.current?.setPaused(true); flowRef.current?.checkpoint(); };
    const handleVisibilityChange = () => {
      flowRef.current?.setPaused(document.visibilityState === 'hidden');
    };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      checkpoint();
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (draftSaveFailed) {
        event.preventDefault();
        event.returnValue = '复习进度保存失败，退出后可能丢失当前进度';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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

  const handleKillConfirm = async () => {
    const flow = flowRef.current;
    if (!flow || !activeWord || killSubmitting) {
      return;
    }

    setKillSubmitting(true);
    try {
      await flow.killCurrent();
      setKillConfirmOpen(false);
      setKillAnimating(true);
      window.setTimeout(() => setKillAnimating(false), 500);
      toast.success('已斩词，记录正在同步');
    } catch (error) {
      console.error('斩词失败:', error);
      toast.error('斩词保存失败，请重试');
    } finally {
      setKillSubmitting(false);
    }
  };

  const renderKillButton = (className: string) => (
    <button
      type="button"
      className={`${studyStyles.killButton} ${className} ${
        killAnimating ? studyStyles.killButtonAnimating : ''
      }`}
      onClick={() => setKillConfirmOpen(true)}
      disabled={killSubmitting}
      aria-label={`斩掉单词 ${activeWord?.word ?? ''}`}
    >
      斩词 <kbd className={studyStyles.killShortcutHint}>{formatShortcutCode(shortcuts.kill)}</kbd>
    </button>
  );

  const renderActiveStage = (content: React.ReactNode) => (
    <>
      {content}
      <div className={studyStyles.studyActionBar}>
        <div className={studyStyles.studyActionBarInner}>
          {renderKillButton(studyStyles.mobileKillButton)}
        </div>
      </div>
      <KillWordConfirmModal
        open={killConfirmOpen}
        submitting={killSubmitting}
        onCancel={() => setKillConfirmOpen(false)}
        onConfirm={handleKillConfirm}
      />
    </>
  );

  useEffect(() => {
    if (!activeWord || snapshot.stage === 'choice') {
      return;
    }

    if (!studyReviewAutoPronounce) {
      return;
    }

    const player = new AudioSequencePlayer();
    player.playSequence([
      resolvePreferredAudio(
        activeWord.front.accent.ukAudio,
        activeWord.front.accent.usAudio,
        pronunciationPreference,
      ),
    ], 400);

    return () => {
      player.stop();
    };
  }, [activeWord, snapshot.stage, studyReviewAutoPronounce, pronunciationPreference]);

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

    if (!studyReviewAutoPronounce) {
      return;
    }

    choiceSentenceReadyRef.current = true;
    const player = new AudioSequencePlayer();
    player.playSequence(
      [
        resolvePreferredAudio(
          choiceState.word.front.accent.ukAudio,
          choiceState.word.front.accent.usAudio,
          pronunciationPreference,
        ),
        choiceState.word.back.sentences[0]?.audio,
      ],
      400
    );

    return () => {
      player.stop();
    };
  }, [snapshot.stage, snapshot.choiceState, studyReviewAutoPronounce, pronunciationPreference]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (killConfirmOpen || killSubmitting || shouldIgnoreShortcutEvent(event)) {
        return;
      }

      if (activeWord && shortcutMatches(event, shortcuts.kill)) {
        event.preventDefault();
        setKillConfirmOpen(true);
        return;
      }

      if (snapshot.stage === 'choice' && snapshot.choiceState) {
        const optionShortcuts = [
          shortcuts.option1,
          shortcuts.option2,
          shortcuts.option3,
          shortcuts.option4,
        ];
        const optionIndex = optionShortcuts.findIndex((code) => shortcutMatches(event, code));
        if (optionIndex >= 0) {
          event.preventDefault();
          const option = snapshot.choiceState.options[optionIndex];
          if (!option || option.disabled) {
            return;
          }

          flowRef.current?.chooseOption(option.id, flowRef.current.getCurrentQuestionId()).catch(() => toast.error('保存作答失败，请重试'));
        }
        return;
      }

      if (
        snapshot.stage === 'detail' &&
        snapshot.detailState &&
        shortcutMatches(event, shortcuts.next)
      ) {
        event.preventDefault();
        flowRef.current?.continueFromDetail().catch(() => toast.error('保存进度失败，请重试'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    snapshot.stage,
    snapshot.choiceState,
    snapshot.detailState,
    activeWord,
    shortcuts,
    killConfirmOpen,
    killSubmitting,
  ]);

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

  const pageError = metadataError || (snapshot.stage === 'error'
    ? snapshot.errorMessage || '复习页面加载失败' : null);
  if (pageError) {
    return (
      <div className={styles.placeholderPage}>
        <div className={styles.placeholderCard}>
          <p>{pageError}</p>
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
              onClick={() => navigate(ROUTES.ALL_BOOKS)}
            >
              浏览词书
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metadataReady) {
    return (
      <StudyLoadingState
        title="正在加载复习计划..."
        subtitle={`正在获取今日计划和单词书信息，请稍候。\n可使用 ${formatShortcutCode(shortcuts.option1)}–${formatShortcutCode(shortcuts.option4)} 选择选项，答题后按 ${formatShortcutCode(shortcuts.next)} 进入下一步。`}
      />
    );
  }

  if (!studyPlan || !currentBook) {
    return (
      <div className={styles.placeholderPage}>
        <div className={styles.placeholderCard}>
          <p>还没有学习计划，请先选择词书。</p>
          <button type="button" className={styles.primaryButton} onClick={() => navigate(ROUTES.ALL_BOOKS)}>
            选择词书
          </button>
        </div>
      </div>
    );
  }

  if (snapshot.stage === 'loading') {
    return (
      <StudyLoadingState
        title="正在准备复习内容..."
        subtitle={`正在整理复习单词和选项资源，完成后会自动进入复习。\n可使用 ${formatShortcutCode(shortcuts.option1)}–${formatShortcutCode(shortcuts.option4)} 选择选项，答题后按 ${formatShortcutCode(shortcuts.next)} 进入下一步。`}
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

  if (snapshot.stage === 'choice' && snapshot.choiceState) {
    return renderActiveStage(
      <ReviewChoiceCard
        state={snapshot.choiceState}
        totalWords={snapshot.totalWords}
        completedWords={snapshot.completedChoiceWords}
        showMedia={showMedia}
        optionShortcuts={[
          formatShortcutCode(shortcuts.option1),
          formatShortcutCode(shortcuts.option2),
          formatShortcutCode(shortcuts.option3),
          formatShortcutCode(shortcuts.option4),
        ]}
        onChoose={(optionId) => {
          if (killConfirmOpen || killSubmitting) return;
          flowRef.current?.chooseOption(optionId, flowRef.current.getCurrentQuestionId()).catch(() => toast.error('保存作答失败，请重试'));
        }}
        wordAction={renderKillButton(studyStyles.cardKillButton)}
      />
    );
  }

  if (snapshot.stage === 'detail' && snapshot.detailState) {
    return renderActiveStage(
      <ReviewWordDetail
        state={snapshot.detailState}
        nextShortcut={formatShortcutCode(shortcuts.next)}
        onNext={() => {
          if (killConfirmOpen || killSubmitting) return;
          flowRef.current?.continueFromDetail().catch(() => toast.error('保存进度失败，请重试'));
        }}
        wordAction={renderKillButton(studyStyles.cardKillButton)}
      />
    );
  }

  if (snapshot.stage === 'spelling' && snapshot.spellState) {
    return renderActiveStage(
      <ReviewSpellCard
        state={snapshot.spellState}
        inputValue={spellInput}
        showMedia={showMedia}
        pronunciationPreference={pronunciationPreference}
        onInputChange={(value) => {
          if (killConfirmOpen || killSubmitting) return;
          if (snapshot.spellState?.isWrong) {
            flowRef.current?.clearSpellWrongOnInput();
            setSpellInput(value.slice(-1));
          } else {
            setSpellInput(value);
          }
        }}
        onSubmit={() => {
          if (killConfirmOpen || killSubmitting) return;
          flowRef.current?.submitSpell(spellInput, flowRef.current.getCurrentQuestionId()).catch(() => toast.error('保存作答失败，请重试'));
        }}
        wordAction={renderKillButton(studyStyles.cardKillButton)}
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
