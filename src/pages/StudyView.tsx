import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const StudyView: React.FC = () => {
  const navigate = useNavigate();
  const [study, setStudy] = useState<Study | null>(null);
  const [wordCard, setWordCard] = useState<any | null>(null);
  const [studyPlan, setStudyPlan] = useState<SelectBookPlanInfo | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const { wordList } = useStudyStore();

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
    const initStudy = async (studyPlans: SelectBookPlanInfo[]) => {
      try {
        let currentStudyPlan = studyPlans[0];

        if (!currentStudyPlan || !wordList.length) {
          toast.loading('等待学习计划和单词列表加载...');
          return;
        }

        // 设置学习计划状态
        setStudyPlan(currentStudyPlan);

        // 获取已学习的单词列表
        const learnedWords = await studyService.getLearnedWords(
          currentStudyPlan.book_id
        );
        const learnedTopicIds = new Set(
          learnedWords.map((word) => word.topic_id)
        );

        // 从全部单词中筛选出未学习的单词
        const unlearnedWords = wordList
          .filter((word) => !learnedTopicIds.has(word.topic_id))
          .slice(0, currentStudyPlan.daily_plan_count);

        if (unlearnedWords.length === 0) {
          toast.success('所有单词都已学习完成！');
          return;
        }

        console.log(
          `共有 ${wordList.length} 个单词，已学习 ${learnedWords.length} 个，待学习 ${unlearnedWords.length} 个`
        );

        const studyInstance = new Study(unlearnedWords);
        await studyInstance.start();
        setStudy(studyInstance);
        setWordCard(studyInstance.getCurrentWord()?.toObject() || null);
        setSelectedOptionIds([]);
      } catch (error) {
        console.error('初始化学习流程失败:', error);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (study && !study.completed) {
        event.preventDefault();
        event.returnValue = '退出该页面后，学习记录将不会上传';
        return '你是否确定要退出学习？';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    studyService.getBookPlanInfo().then(initStudy);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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
