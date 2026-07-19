import React, { useState, useEffect, useMemo } from 'react';
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

const StudyView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'learn' | 'review') || 'learn';
  
  const [study, setStudy] = useState<Study | null>(null);
  const { wordCard, isCompleted } = useStudyState(study);
  const [studyPlan, setStudyPlan] = useState<SelectBookPlanInfo | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  
  const { studyInstance, error, restored, draftSaveFailed, init } = useStudyStrategy();

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

  const handleNext = async () => {
    await study?.pass();
  };

  const handleOptionClick = async (id: number, isCorrect: boolean) => {
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
  };

  // 初始化学习流程
  useEffect(() => {
    const startStudy = async () => {
      // 如果已经有实例，跳过初始化
      if (study) return;
      
      try {
        const studyPlans = await studyService.getBookPlanInfo();
        if (studyPlans && studyPlans.length > 0) {
          setStudyPlan(studyPlans[0]);
          await init(mode, studyPlans);
        }
      } catch (err) {
        console.error('获取学习计划失败:', err);
      }
    };
    
    startStudy();
  }, [mode, init, study]);

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
    if (restored) {
      toast.success('已恢复上次学习进度');
    }
  }, [restored]);

  // 处理初始化错误
  useEffect(() => {
    if (error) {
      // 区分不同错误类型进行提示
      if (error.message.includes('未就绪')) {
        toast.loading('等待数据加载...');
      } else if (error.message.includes('已学习完成')) {
        toast.success('所有单词都已学习完成！');
      } else {
        console.error('初始化学习流程失败:', error);
        toast.error('初始化失败: ' + error.message);
      }
    }
  }, [error]);

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
      const key = event.key;

      // 处理选项选择（1-4数字键）
      if (!wordCard || wordCard.showAnswer || !wordCard.options) {
        // 在背面或无选项时，处理空格键点击下一个按钮
        if (key === ' ') {
          event.preventDefault(); // 防止页面滚动
          handleNext();
          return;
        }
        return;
      }

      // 检查按键是否为1-4数字键
      if (['1', '2', '3', '4'].includes(key)) {
        const optionIndex = parseInt(key) - 1;

        // 确保选项存在
        if (optionIndex >= 0 && optionIndex < shuffledOptions.length) {
          handleOptionClick(shuffledOptions[optionIndex].id, shuffledOptions[optionIndex].isCorrect);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [wordCard, handleNext, shuffledOptions]);

  useEffect(() => {
    if (!wordCard) return;

    const player = new AudioSequencePlayer();
    const audioUrls = [
      uiModel?.front.accent.ukAudio,
      wordCard?.showSentence && uiModel?.back.sentences[0]?.audio,
    ];

    player.playSequence(audioUrls, 500);

    return () => {
      player.stop();
    };
  }, [wordCard?.word, wordCard?.showAnswer, wordCard?.showSentence, uiModel]);

  return (
    <div className={styles.container}>
      {wordCard ? (
        wordCard.showAnswer ? (
          <StudyBackCard 
            uiModel={uiModel} 
            next={handleNext} 
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
          />
        )
      ) : (
        <StudyLoadingState
          title="正在准备学习内容..."
          subtitle={"单词资料与选项加载完成后，会自动进入学习页面。\n可使用 1-4 快捷选择选项，单词详情页可按空格进入下一个。"}
        />
      )}
    </div>
  );
};

export default StudyView;
