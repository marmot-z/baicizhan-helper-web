import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import styles from './SpellView.module.css';
import { SpellStudy } from '../services/study/SpellStudy';
import type { StudyUIModel } from '../services/study/types';
import { useStudyStore } from '../stores/studyStore';
import { AudioSequencePlayer } from '../utils/audio';
import { ROUTES } from '../constants';

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

  const handlePlayAudio = useCallback(() => {
    if (!currentWord?.front.accent.ukAudio) return;
    const player = new AudioSequencePlayer();
    player.playSequence([currentWord.front.accent.ukAudio]);
  }, [currentWord]);

  const handleSubmit = useCallback(() => {
    spellStudy.check(inputValue);
  }, [spellStudy, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 如果当前是错误状态，再次输入时清空原内容
    if (spellStudy.isWrong) {
      spellStudy.isWrong = false; // 重置错误状态
      setInputValue(e.target.value.slice(-1)); // 只保留当前输入的最后一个字符
    } else {
      setInputValue(e.target.value);
    }
  };

  if (!currentWord) {
    return null;
  }

  return (
    <div className={styles.containerPage}>
      <div className={styles.container}>
        <div className={styles.topHint}>
          需拼写 {stats.remainingInRound + stats.retryCount + 1} 词
        </div>

        <div className={styles.imageContainer}>
          {isVideo ? (
            <video
              className={styles.mediaElement}
              src={finalMediaUrl}
              poster={finalPosterUrl}
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            <div
              className={styles.mediaElement}
              style={{
                backgroundImage: `url(${finalMediaUrl})`,
              }}
            ></div>
          )}
        </div>

        <input 
          type="text" 
          className={`${styles.inputField} ${spellStudy.isWrong ? styles.error : ''}`} 
          placeholder="Type the English word..." 
          autoFocus 
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        <div className={`${styles.chineseHint} ${spellStudy.isWrong ? styles.error : ''}`}>
          {spellStudy.isWrong ? currentWord.word : currentWord.front.chnMean}
        </div>

        <div className={styles.actionRow}>
          <button className={styles.audioBtn} onClick={handlePlayAudio}>
            <FontAwesomeIcon icon={faVolumeUp} />
          </button>
          <button className={styles.submitBtn} onClick={handleSubmit}>
            提交
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpellView;
