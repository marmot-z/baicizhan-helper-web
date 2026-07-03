import React from 'react';
import { AudioIcon } from '../../components';
import type { ReviewChoiceState } from '../../services/review/types';
import styles from './review.module.css';

interface ReviewChoiceCardProps {
  state: ReviewChoiceState;
  totalWords: number;
  completedWords: number;
  onChoose: (optionId: number) => void;
}

const buildMediaUrl = (url?: string) => {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://7n.bczcdn.com${url}`;
};

const ReviewChoiceCard: React.FC<ReviewChoiceCardProps> = ({
  state,
  totalWords,
  completedWords,
  onChoose,
}) => {
  const mediaUrl = buildMediaUrl(
    state.word.front.media?.url || state.word.back.sentences[0]?.img
  );
  const posterUrl = buildMediaUrl(
    state.word.front.media?.poster || state.word.back.sentences[0]?.img
  );
  const isVideo = state.word.front.media?.type === 'video';
  const sentence = state.word.back.sentences[0];
  const englishMeaning = state.word.extensions.enMeans[0]?.text;
  const hasErrorFeedback = state.showTranslation || state.showEnglishTranslation;
  const showSentence = state.showSentence && !hasErrorFeedback;
  const showTranslation = state.showTranslation;
  const showEnglishMeaning = state.showEnglishTranslation;
  const progressPercent =
    totalWords > 0 ? Math.round((completedWords / totalWords) * 100) : 0;

  return (
    <div className={styles.choicePage}>
      <div className={styles.choiceContainer}>
        <header className={styles.choiceHeader}>
          <span>需复习 {totalWords}</span>
          <span> / </span>
          <span>当前进度：{progressPercent}%</span>
        </header>

        <main className={styles.choiceCard}>
          <div className={styles.choiceImageContainer}>
          {isVideo ? (
            <video
              className={styles.choiceMedia}
              src={mediaUrl}
              poster={posterUrl}
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            <div
              className={styles.choiceMedia}
              style={mediaUrl ? { backgroundImage: `url(${mediaUrl})` } : undefined}
            />
          )}
          </div>

          <div className={styles.choiceWordBlock}>
            {state.showWord && <h1 className={styles.wordTitle}>{state.word.word}</h1>}
            <div className={styles.choicePronunciationRow}>
              {state.word.front.accent.uk && <span>英 {state.word.front.accent.uk}</span>}
              {state.word.front.accent.ukAudio && (
                <AudioIcon src={state.word.front.accent.ukAudio} />
              )}
              {state.word.front.accent.us && <span>美 {state.word.front.accent.us}</span>}
              {state.word.front.accent.usAudio && (
                <AudioIcon src={state.word.front.accent.usAudio} />
              )}
            </div>
            {showSentence && sentence?.en ? (
              <div className={styles.choiceSentenceContainer}>
                <p className={styles.choiceSentence}>{sentence.en}</p>
                {sentence.audio && <AudioIcon src={sentence.audio} />}
              </div>
            ) : null}
            {showTranslation && sentence?.cn && (
              <p className={styles.choiceTranslation}>{sentence.cn}</p>
            )}
            {showEnglishMeaning && englishMeaning && (
              <p className={styles.choiceTranslation}>{englishMeaning}</p>
            )}
          </div>
        </main>

        <footer className={styles.choiceFooter}>
          <div className={styles.choiceOptions}>
            {state.isOptionsLoading ? (
              <div className={styles.loadingBox}>加载选项中...</div>
            ) : (
              state.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    styles.optionButton,
                    option.status === 'correct' ? styles.optionButtonCorrect : '',
                    option.status === 'incorrect' ? styles.optionButtonIncorrect : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onChoose(option.id)}
                  disabled={option.disabled}
                >
                  {option.showOptionWord && <span className={styles.optionWord}>{option.word}</span>}
                  {option.showOptionTranslation && (
                    <span className={styles.optionTranslation}>{option.translation}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ReviewChoiceCard;
