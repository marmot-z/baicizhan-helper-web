import React, { useEffect } from 'react';
import { AudioIcon } from '../components';
import type { StudyOption } from '../services/study/types';
import type { SelectBookPlanInfo } from '../types';
import { Study } from '../services/study/Study';
import styles from './StudyView.module.css';

interface StudyFrontCardProps {
  wordCard: any | null;
  studyPlan: SelectBookPlanInfo | null;
  study: Study | null;
  selectedOptionIds: number[];
  optionClick: (id: number, isCorrect: boolean) => Promise<void>;
}

const CDN_HOST = 'https://7n.bczcdn.com';

const StudyFrontCard: React.FC<StudyFrontCardProps> = ({
  wordCard,
  studyPlan,
  study,
  selectedOptionIds,
  optionClick,
}) => {
  useEffect(() => {
    const audios: HTMLAudioElement[] = [];

    const playAudiosSequentially = async () => {
      const audioUrls = [
        wordCard.word.word.dict.word_basic_info.accent_uk_audio_uri,
        wordCard.word.word.dict.sentences?.[0]?.audio_uri,
      ].filter(Boolean);

      for (const audioUrl of audioUrls) {
        try {
          const audio = new Audio(CDN_HOST + audioUrl);
          audios.push(audio);

          await new Promise((resolve, reject) => {
            audio.onended = resolve;
            audio.onerror = reject;            
            audio.play().catch(reject);
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error('音频播放失败:', error);
        }
      }
    };

    playAudiosSequentially();

    return () => {
      audios.forEach((audio) => audio.pause());
    };
  }, [wordCard]);

  return (
    <div className={styles.studyFrontContainer}>
      <header className={styles.header}>
        <span>需学习 {studyPlan?.daily_plan_count || 0}</span>
        <span> / </span>
        <span>当前进度：{study?.getProgress()}%</span>
      </header>

      <main className={styles.studyFrontCard}>
        <div
          className={styles.imageContainer}
          style={{
            backgroundImage: `url(https://7n.bczcdn.com${wordCard?.word.word.dict.sentences?.[0]?.img_uri})`,
          }}
        ></div>
        {wordCard?.showWord && (
          <h1 className={styles.studyFrontWord}>
            {wordCard?.word.word.dict.word_basic_info.word}
          </h1>
        )}
        <div className={styles.pronunciationContainer}>
          {wordCard?.word.word.dict.word_basic_info.accent_uk && (
            <span className={styles.pronunciationSpan}>
              英 {wordCard?.word.word.dict.word_basic_info.accent_uk}
            </span>
          )}
          {wordCard?.word.word.dict.word_basic_info.accent_uk && (
            <AudioIcon
              id="accentUkAudio"
              src={wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri}
            ></AudioIcon>
          )}
          {wordCard?.word.word.dict.word_basic_info.accent_uk && (
            <span className={styles.pronunciationSpan}>
              美 {wordCard?.word.word.dict.word_basic_info.accent_usa}
            </span>
          )}
          {wordCard?.word.word.dict.word_basic_info.accent_uk && (
            <AudioIcon
              id="accentUsaAudio"
              src={
                wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri
              }
            ></AudioIcon>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            margin: '0 0 0.5rem 0',
          }}
        >
          {wordCard?.showSentence && (
            <p
              style={{
                fontSize: '1.2rem',
                margin: 0,
              }}
            >
              {wordCard?.word.word.dict.sentences?.[0]?.sentence}
            </p>
          )}
          {wordCard?.showSentence &&
            wordCard?.word.word.dict.sentences?.[0]?.audio_uri && (
              <AudioIcon
                id="sentenceAudio"
                src={wordCard?.word.word.dict.sentences?.[0]?.audio_uri}
              ></AudioIcon>
            )}
        </div>
        {wordCard?.showTranslation && (
          <p
            style={{
              color: '#6c757d',
              marginBottom: '2rem',
            }}
          >
            {wordCard?.word.word.dict.sentences?.[0]?.sentence_trans}
          </p>
        )}
        {wordCard?.showEnglishTranslation && (
          <p style={{ color: '#6c757d' }}>
            {wordCard?.word.word.dict.en_means?.[0]?.mean}
          </p>
        )}
      </main>

      <footer className={styles.footer}>
        <div className={styles.studyFrontOptions}>
          {(Object.values(wordCard?.options) as StudyOption[]).map(
            (option, index) => (
              <button
                key={index}
                onClick={
                  selectedOptionIds.includes(option.id)
                    ? undefined
                    : () => optionClick(option.id, option.isCorrect)
                }
                className={`${styles.optionButton} ${
                  selectedOptionIds.includes(option.id)
                    ? option.isCorrect
                      ? styles.optionButtonCorrect
                      : styles.optionButtonIncorrect
                    : ''
                }`}
              >
                {wordCard?.options[option.id].showOptionWord && (
                  <span>
                    {option.word}
                    <br></br>
                  </span>
                )}
                {wordCard?.options[option.id].showOptionTranslation && (
                  <span>{option.translation}</span>
                )}
              </button>
            )
          )}
        </div>
      </footer>
    </div>
  );
};

export default StudyFrontCard;
