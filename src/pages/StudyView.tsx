import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import type { SelectBookPlanInfo } from '../types';
import { Study } from '../services/study/Study';
import type { StudyOption } from '../services/study/types';
import { useStudyStore } from '../stores/studyStore';
import { studyService } from '../services/studyService';
import { ROUTES } from '../constants';
import StudyFrontCard from './StudyFrontCard';
import StudyBackCard from './StudyBackCard';
import styles from './StudyView.module.css';
import { useStudyStrategy } from '../hooks/useStudyStrategy';

const StudyView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'learn' | 'review') || 'learn';
  
  const [study, setStudy] = useState<Study | null>(null);
  const [wordCard, setWordCard] = useState<any | null>(null);
  const [studyPlan, setStudyPlan] = useState<SelectBookPlanInfo | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  
  const { studyInstance, loading, error, init } = useStudyStrategy();

  const handleNext = async () => {
    await study?.pass();
    setWordCard(study?.getCurrentWord()?.toObject() || null);
    setSelectedOptionIds([]);
  };

  const handleOptionClick = async (id: number, isCorrect: boolean) => {
    setSelectedOptionIds(prev => [...prev, id]);

    let fresh = false;
    if (isCorrect) {
      await study?.pass();
      fresh = true;
    } else {
      fresh = await study?.fail(id) || false;
    }

    setWordCard(study?.getCurrentWord()?.toObject() || null);

    if (fresh) {
      setSelectedOptionIds([]);
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
      setWordCard(studyInstance.getCurrentWord()?.toObject() || null);
      setSelectedOptionIds([]);
      
      console.log(`学习模式: ${mode} 初始化完成`);
    }
  }, [studyInstance, mode]);

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

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (study && !study.completed) {
      event.preventDefault();
      event.returnValue = '退出该页面后，学习记录将不会上传';
      return '你是否确定要退出学习？';
    }
  };

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [study]);

  // 监听学习完成状态，完成时跳转到统计页面
  // 退出前进行提示
  useEffect(() => {
    if (study && study.completed) {
      toast.success('学习完成，学习记录已上传！');
      navigate(ROUTES.STUDY_STATISTICS);
    }
  }, [study?.completed, navigate]);

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

      const options = Object.values(wordCard.options) as StudyOption[];

      // 检查按键是否为1-4数字键
      if (['1', '2', '3', '4'].includes(key)) {
        const optionIndex = parseInt(key) - 1;

        // 确保选项存在
        if (optionIndex >= 0 && optionIndex < options.length) {
          handleOptionClick(options[optionIndex].id, options[optionIndex].isCorrect);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [wordCard, handleNext]);

  const CDN_HOST = 'https://7n.bczcdn.com';

  useEffect(() => {
    if (!wordCard) return;

    const audios: HTMLAudioElement[] = [];
    let canceled = false;

    const playAudiosSequentially = async () => {
      const audioUrls = [
        wordCard.word.word.dict.word_basic_info.accent_uk_audio_uri,
        wordCard.showSentence && wordCard.word.word.dict.sentences?.[0]?.audio_uri,
      ].filter(Boolean);

      for (const audioUrl of audioUrls) {
        if (canceled) break;

        try {
          const audio = new Audio(CDN_HOST + audioUrl);
          audios.push(audio);

          await audio.play();

          if (canceled) break;

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error('音频播放失败:', error);
        }
      }
    };

    playAudiosSequentially();

    return () => {
      canceled = true;
      audios.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
    };
  }, [wordCard?.word, wordCard?.showAnswer]);

  return (
    <div className={styles.container}>
      {wordCard ? (
        wordCard.showAnswer ? (
          <StudyBackCard wordCard={wordCard} next={handleNext} />
        ) : (
          <StudyFrontCard
            wordCard={wordCard}
            studyPlan={studyPlan}
            study={study}
            selectedOptionIds={selectedOptionIds}
            optionClick={handleOptionClick}
          />
        )
      ) : (
        <div>加载中...</div>
      )}
    </div>
  );
};

export default StudyView;
