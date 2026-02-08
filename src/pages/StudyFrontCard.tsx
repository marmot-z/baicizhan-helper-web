import React from 'react';
import { AudioIcon } from '../components';
import type { StudyOption, StudyUIModel } from '../services/study/types';
import type { SelectBookPlanInfo } from '../types';
import { Study } from '../services/study/Study';
import styles from './StudyView.module.css';

interface StudyFrontCardProps {
  uiModel: StudyUIModel | null;
  wordCard: any | null; // Keep for legacy compatibility during migration if needed, or remove if fully switched
  studyPlan: SelectBookPlanInfo | null;
  study: Study | null;
  selectedOptionIds: number[];
  optionClick: (id: number, isCorrect: boolean) => Promise<void>;
  options: StudyOption[];
}

const StudyFrontCard: React.FC<StudyFrontCardProps> = ({
  uiModel,
  wordCard,
  studyPlan,
  study,
  selectedOptionIds,
  optionClick,
  options,
}) => {
  // Prefer uiModel if available, fallback to legacy wordCard (or handle hybrid)
  // For this refactor step, we assume uiModel will be passed.
  
  if (!uiModel) return null;

  // Data access directly from StudyUIModel
  const word = uiModel.word;
  
  // Media URL handling
  const mediaUrl = uiModel.front.media?.url || uiModel.back.sentences[0]?.img;
  const finalMediaUrl = mediaUrl 
    ? (mediaUrl.startsWith('http') ? mediaUrl : `https://7n.bczcdn.com${mediaUrl}`) 
    : '';

  // Poster handling
  const posterRaw = uiModel.front.media?.poster || uiModel.back.sentences[0]?.img || '';
  const finalPosterUrl = posterRaw 
    ? (posterRaw.startsWith('http') ? posterRaw : `https://7n.bczcdn.com${posterRaw}`) 
    : '';
  
  const isVideo = uiModel.front.media?.type === 'video';

  // Accents
  const accentUk = uiModel.front.accent.uk;
  const accentUkAudio = uiModel.front.accent.ukAudio;
  const accentUs = uiModel.front.accent.us;
  const accentUsAudio = uiModel.front.accent.usAudio;
  
  // Sentence
  const sentence = uiModel.back.sentences[0]?.en;
  const sentenceAudio = uiModel.back.sentences[0]?.audio;
  const sentenceTrans = uiModel.back.sentences[0]?.cn;
  
  // Extension
  const enMean = uiModel.extensions.enMeans[0]?.text;
  
  // Display Flags (from wordCard state)
  // TODO: Migrate these UI states to a separate UI state object or include in StudyUIModel context
  const showWord = wordCard?.showWord;
  const showSentence = wordCard?.showSentence;
  const showTranslation = wordCard?.showTranslation;
  const showEnglishTranslation = wordCard?.showEnglishTranslation;

  return (
    <div className={styles.studyFrontContainer}>
      <header className={styles.header}>
        <span>需学习 {studyPlan?.daily_plan_count || 0}</span>
        <span> / </span>
        <span>当前进度：{study?.getProgress()}%</span>
      </header>

      <main className={styles.studyFrontCard}>
        {isVideo ? (
          <video
            className={styles.imageContainer}
            src={finalMediaUrl}
            poster={finalPosterUrl}
            muted
            playsInline
            loop
            autoPlay
          />
        ) : (
          <div
            className={styles.imageContainer}
            style={{
              backgroundImage: `url(${finalMediaUrl})`,
            }}
          ></div>
        )}
        {showWord && (
          <h1 className={styles.studyFrontWord}>
            {word}
          </h1>
        )}
        <div className={styles.pronunciationContainer}>
          {accentUk && (
            <span className={styles.pronunciationSpan}>
              英 {accentUk}
            </span>
          )}
          {accentUk && (
            <AudioIcon
              id="accentUkAudio"
              src={accentUkAudio}
            ></AudioIcon>
          )}
          {accentUs && (
            <span className={styles.pronunciationSpan}>
              美 {accentUs}
            </span>
          )}
          {accentUs && (
            <AudioIcon
              id="accentUsaAudio"
              src={accentUsAudio}
            ></AudioIcon>
          )}
        </div>
        <div className={styles.sentenceContainer}>
        {showSentence && (
          <p className={styles.sentence}>
            {sentence}
          </p>
        )}
        {showSentence &&
          sentenceAudio && (
            <AudioIcon
              id="sentenceAudio"
              src={sentenceAudio}
            ></AudioIcon>
          )}
      </div>
      {showTranslation && (
        <p className={styles.translation}>
          {sentenceTrans}
        </p>
      )}
      {showEnglishTranslation && (
        <p className={styles.translation}>
          {enMean}
        </p>
      )}
      </main>

      <footer className={styles.footer}>
        <div className={styles.studyFrontOptions}>
          {(options && options.length ? options : null) ? options.map(
            (option) => (
              <button
                key={option.id}
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
                {option.showOptionWord && (
                  <span>
                    {option.word}
                    <br></br>
                  </span>
                )}
                {option.showOptionTranslation && (
                  <span>{option.translation}</span>
                )}
              </button>
            )
          ) : (
            <div>选项加载中...</div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default StudyFrontCard;
