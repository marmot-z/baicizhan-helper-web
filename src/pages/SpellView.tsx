import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SpellStudy } from '../services/study/SpellStudy';
import type { StudyUIModel } from '../services/study/types';
import { useStudyStore } from '../stores/studyStore';
import { ROUTES } from '../constants';
import SpellPracticePanel from '../components/spell/SpellPracticePanel';

const SpellView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBook } = useStudyStore();
  
  // 从路由状态中获取单词数据
  const words = useMemo(() => (location.state as { words?: StudyUIModel[] })?.words || [], [location.state]);

  // 初始化 SpellStudy 实例
  const spellStudy = useMemo(() => new SpellStudy(
    words, 
    'XModelNewStudy', // 暂时硬编码，后续可根据业务逻辑调整
    currentBook?.id || 0
  ), [words, currentBook]);
  
  // 如果没有数据，且不是正在加载，则返回首页
  useEffect(() => {
    if (words.length === 0) {
      navigate(ROUTES.DASHBOARD);
    }
  }, [words, navigate]);

  // 状态同步
  const [inputValue, setInputValue] = useState('');
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(tick => tick + 1);

  useEffect(() => {
    // 订阅状态变化以触发重绘
    const unsubscribe = spellStudy.subscribe(() => {
      forceUpdate();
      // 如果进入了正确状态（切换了单词），清空输入框
      if (!spellStudy.isWrong) {
        setInputValue('');
      }
    });
    return unsubscribe;
  }, [spellStudy]);

  const currentWord = spellStudy.getCurrentWord();
  const stats = spellStudy.getStats();

  // 媒体 URL 处理
  const mediaUrl = currentWord?.front.media?.url || currentWord?.back.sentences[0]?.img;
  const finalMediaUrl = mediaUrl 
    ? (mediaUrl.startsWith('http') ? mediaUrl : `https://7n.bczcdn.com${mediaUrl}`) 
    : '';

  // Poster 处理
  const posterRaw = currentWord?.front.media?.poster || currentWord?.back.sentences[0]?.img || '';
  const finalPosterUrl = posterRaw 
    ? (posterRaw.startsWith('http') ? posterRaw : `https://7n.bczcdn.com${posterRaw}`) 
    : '';
  
  const isVideo = currentWord?.front.media?.type === 'video';

  useEffect(() => {
    if (stats.isCompleted) {
      navigate(ROUTES.STUDY_STATISTICS);
    }
  }, [stats.isCompleted, navigate]);

  const handleSubmit = useCallback(() => {
    spellStudy.check(inputValue);
  }, [spellStudy, inputValue]);

  const handleInputChange = (value: string) => {
    // 如果当前是错误状态，再次输入时清空原内容
    if (spellStudy.isWrong) {
      spellStudy.isWrong = false; // 重置错误状态
      setInputValue(value.slice(-1)); // 只保留当前输入的最后一个字符
    } else {
      setInputValue(value);
    }
  };

  if (!currentWord) {
    return null;
  }

  return (
    <SpellPracticePanel
      topHint={`需拼写 ${stats.remainingInRound + stats.retryCount + 1} 词`}
      mediaUrl={finalMediaUrl}
      posterUrl={finalPosterUrl}
      isVideo={Boolean(isVideo)}
      pageAlign="top"
      inputValue={inputValue}
      isWrong={spellStudy.isWrong}
      hintText={spellStudy.isWrong ? currentWord.word : currentWord.front.chnMean}
      audioSrc={currentWord.front.accent.ukAudio}
      inputPlaceholder="Type the English word..."
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
    />
  );
};

export default SpellView;
