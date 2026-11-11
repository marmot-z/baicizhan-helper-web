import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import type { SelectBookPlanInfo } from '../types';
import { Study } from '../services/study/Study';
import type { StudyOption, StudyUIModel } from '../services/study/types';
import { studyService } from '../services/studyService';
import { StudyUtils } from '../services/study/StudyUtils';
import { ROUTES } from '../constants';
import StudyFrontCard from './StudyFrontCard';
import StudyBackCard from './StudyBackCard';
import styles from './StudyView.module.css';
import statusStyles from './review/review.module.css';
import StudyLoadingState from '../components/study/StudyLoadingState';
import { useStudyStrategy } from '../hooks/useStudyStrategy';
import { useStudyState } from '../hooks/useStudyState';
import { AudioSequencePlayer } from '../utils/audio';
import { feedbackSoundPlayer } from '../utils/feedbackSound';
import { studyRecordStore } from '../services/study';
import {
  getStudyOptionSetKey,
  orderStudyOptions,
  shuffleStudyOptionIds,
} from './studyOptionOrder';
import KillWordConfirmModal from '../components/study/KillWordConfirmModal';
import {
  formatShortcutCode,
  resolvePreferredAudio,
  shortcutMatches,
  shouldIgnoreShortcutEvent,
  useSettingsStore,
} from '../stores/settingsStore';

const StudyView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'learn' | 'review') || 'learn';
  
  const [study, setStudy] = useState<Study | null>(null);
  const { wordCard, isCompleted } = useStudyState(study);
  const [studyPlan, setStudyPlan] = useState<SelectBookPlanInfo | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [retryKey, setRetryKey] = useState(0);
  const [planError, setPlanError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [killSubmitting, setKillSubmitting] = useState(false);
  const [killAnimating, setKillAnimating] = useState(false);
  const showMedia = useSettingsStore((state) => state.showMedia);
  const studyReviewAutoPronounce = useSettingsStore((state) => state.studyReviewAutoPronounce);
  const pronunciationPreference = useSettingsStore((state) => state.pronunciationPreference);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  
  const { studyInstance, loading, error, restored, draftSaveFailed, skippedWordCount, init } = useStudyStrategy();

  // Create UI Model from current word card
  const uiModel: StudyUIModel | null = useMemo(() => {
    return wordCard?.uiModel || null;
  }, [wordCard]);

  // 监听卡片核心状态变化，自动重置选项选中状态
  // 替代手动在交互逻辑中重置
  useEffect(() => {
    setSelectedOptionIds(wordCard?.clickedOptionIds ?? []);
  }, [
    uiModel?.topicId,
    wordCard?.showAnswer,
    wordCard?.attemptCount,
    wordCard?.clickedOptionIds,
  ]);

  const liveOptions: StudyOption[] = wordCard?.options?.length
    ? wordCard.options
    : uiModel
      ? (StudyUtils.getCachedOptions(uiModel.topicId) || uiModel.front.options)
      : [];
  const optionSetKey = getStudyOptionSetKey(liveOptions);
  const shuffledOptionIds = useMemo(
    () => {
      if (uiModel?.topicId === undefined || !optionSetKey) {
        return [];
      }
      return shuffleStudyOptionIds(optionSetKey.split(',').map(Number));
    },
    [uiModel?.topicId, optionSetKey],
  );
  const shuffledOptions = orderStudyOptions(liveOptions, shuffledOptionIds);

  const handleNext = useCallback(async () => {
    await study?.pass();
  }, [study]);

  const handleOptionClick = useCallback(async (id: number, isCorrect: boolean) => {
    setSelectedOptionIds(prev => [...prev, id]);

    if (isCorrect) {
      feedbackSoundPlayer.playCorrect();
      // 延迟 300ms 以展示绿色正确反馈
      await new Promise(resolve => setTimeout(resolve, 300));
      await study?.pass(id);
    } else {
      feedbackSoundPlayer.playIncorrect();
      await study?.fail(id);
    }
  }, [study]);

  const handleKillConfirm = async () => {
    if (!study || killSubmitting) return;

    setKillSubmitting(true);
    try {
      await study.killCurrent();
      setKillConfirmOpen(false);
      setKillAnimating(true);
      window.setTimeout(() => setKillAnimating(false), 500);
      toast.success('已斩词，记录正在同步');
    } catch (killError) {
      console.error('斩词失败:', killError);
      toast.error('斩词保存失败，请重试');
    } finally {
      setKillSubmitting(false);
    }
  };

  const renderKillButton = (className: string) => (
    <button
      type="button"
      className={`${styles.killButton} ${className} ${killAnimating ? styles.killButtonAnimating : ''}`}
      onClick={() => setKillConfirmOpen(true)}
      disabled={killSubmitting}
      aria-label={`斩掉单词 ${uiModel?.word ?? ''}`}
    >
      斩词 <kbd className={styles.killShortcutHint}>{formatShortcutCode(shortcuts.kill)}</kbd>
    </button>
  );

  // 初始化学习流程
  useEffect(() => {
    if (study) return;

    let isActive = true;
    const startStudy = async () => {
      setLoadingPlan(true);
      setPlanError(null);

      try {
        const studyPlans = await studyService.getBookPlanInfo();
        if (!isActive) return;

        if (!studyPlans?.length) {
          throw new Error('学习计划未就绪');
        }

        setStudyPlan(studyPlans[0]);
        await init(mode, studyPlans);
      } catch (err) {
        if (isActive) {
          setPlanError(err instanceof Error ? err.message : '获取学习计划失败');
        }
      } finally {
        if (isActive) setLoadingPlan(false);
      }
    };

    void startStudy();
    return () => {
      isActive = false;
    };
  }, [mode, init, study, retryKey]);

  // 监听策略Hook返回的实例
  useEffect(() => {
    if (studyInstance) {
      // 启动学习
      // 注意：Hook 内部已经调用了 start()，这里只需同步状态
      setStudy(studyInstance);
      setSelectedOptionIds([]);
      
      console.log(`学习模式: ${mode} 初始化完成`);
    }
  }, [studyInstance, mode]);

  useEffect(() => {
    if (skippedWordCount > 0) {
      toast(`有 ${skippedWordCount} 个单词暂时无法加载，已跳过本轮`);
    } else if (restored) {
      toast.success('已恢复上次学习进度');
    }
  }, [restored, skippedWordCount]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isCompleted && draftSaveFailed) {
        event.preventDefault();
        event.returnValue = '学习进度保存失败，退出后可能丢失当前进度';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isCompleted, draftSaveFailed]);

  useEffect(() => {
    const checkpoint = () => study?.checkpoint();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        checkpoint();
      }
    };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      checkpoint();
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [study]);

  // 监听学习完成状态，完成时跳转到中间页面
  // 退出前进行提示
  useEffect(() => {
    if (isCompleted) {
      const bookId = studyPlan?.book_id;
      const syncMeta = bookId ? studyRecordStore.getSyncMeta(bookId) : null;
      const hasPending = bookId ? studyRecordStore.getPendingDoneRecords(bookId).length > 0 : false;
      if (hasPending || syncMeta?.lastUploadError) {
        toast.success('学习完成，记录已保存到本地，等待同步');
      } else {
        toast.success('学习完成，学习记录已同步！');
      }
      const words = study?.getAllWords() || [];
      navigate(ROUTES.STUDY_MID, { state: { words } });
    }
  }, [isCompleted, navigate, study, studyPlan?.book_id]);

  // 添加键盘事件监听
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (killConfirmOpen || shouldIgnoreShortcutEvent(event)) {
        return;
      }

      if (wordCard && !isCompleted && shortcutMatches(event, shortcuts.kill)) {
        event.preventDefault();
        setKillConfirmOpen(true);
        return;
      }

      if (!wordCard) {
        return;
      }

      if (wordCard.showAnswer) {
        if (shortcutMatches(event, shortcuts.next)) {
          event.preventDefault(); // 防止页面滚动
          handleNext();
        }
        return;
      }

      const optionShortcuts = [
        shortcuts.option1,
        shortcuts.option2,
        shortcuts.option3,
        shortcuts.option4,
      ];
      const optionIndex = optionShortcuts.findIndex((code) => shortcutMatches(event, code));
      if (optionIndex >= 0 && optionIndex < shuffledOptions.length) {
        event.preventDefault();
        handleOptionClick(shuffledOptions[optionIndex].id, shuffledOptions[optionIndex].isCorrect);
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [wordCard, isCompleted, handleNext, handleOptionClick, shuffledOptions, shortcuts, killConfirmOpen]);

  useEffect(() => {
    if (!wordCard || !studyReviewAutoPronounce) return;

    const player = new AudioSequencePlayer();
    const audioUrls = [
      resolvePreferredAudio(
        uiModel?.front.accent.ukAudio,
        uiModel?.front.accent.usAudio,
        pronunciationPreference,
      ),
      wordCard?.showSentence && uiModel?.back.sentences[0]?.audio,
    ];

    player.playSequence(audioUrls, 500);

    return () => {
      player.stop();
    };
  }, [wordCard, uiModel, studyReviewAutoPronounce, pronunciationPreference]);

  const initializationError = planError ?? error?.message;
  if (!loadingPlan && !loading && initializationError) {
    return (
      <div className={statusStyles.placeholderPage}>
        <div className={statusStyles.placeholderCard}>
          <p>{initializationError}</p>
          <div className={statusStyles.summaryActions}>
            {!initializationError.includes('已学习完成') && (
              <button
                type="button"
                className={statusStyles.primaryButton}
                onClick={() => {
                  setLoadingPlan(true);
                  setRetryKey((current) => current + 1);
                }}
              >
                重新加载
              </button>
            )}
            <button type="button" className={statusStyles.secondaryButton} onClick={() => navigate(ROUTES.DASHBOARD)}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {wordCard ? (
        wordCard.showAnswer ? (
          <StudyBackCard 
            uiModel={uiModel} 
            next={handleNext}
            shortcutHint={formatShortcutCode(shortcuts.next)}
            wordAction={renderKillButton(styles.cardKillButton)}
          />
        ) : (
          <StudyFrontCard
            uiModel={uiModel}
            wordCard={wordCard}
            studyPlan={studyPlan}
            study={study}
            selectedOptionIds={selectedOptionIds}
            optionClick={handleOptionClick}
            options={shuffledOptions}
            showMedia={showMedia}
            optionShortcuts={[
              formatShortcutCode(shortcuts.option1),
              formatShortcutCode(shortcuts.option2),
              formatShortcutCode(shortcuts.option3),
              formatShortcutCode(shortcuts.option4),
            ]}
            wordAction={renderKillButton(styles.cardKillButton)}
          />
        )
      ) : (
        <StudyLoadingState
          title="正在准备学习内容..."
          subtitle={`单词资料与选项加载完成后，会自动进入学习页面。\n可使用 ${formatShortcutCode(shortcuts.option1)}–${formatShortcutCode(shortcuts.option4)} 选择选项，答题后按 ${formatShortcutCode(shortcuts.next)} 进入下一步。`}
        />
      )}
      {wordCard && !isCompleted && (
        <div className={styles.studyActionBar}>
          <div className={styles.studyActionBarInner}>
            {renderKillButton(styles.mobileKillButton)}
          </div>
        </div>
      )}
      <KillWordConfirmModal
        open={killConfirmOpen}
        submitting={killSubmitting}
        onCancel={() => setKillConfirmOpen(false)}
        onConfirm={handleKillConfirm}
      />
    </div>
  );
};

export default StudyView;
