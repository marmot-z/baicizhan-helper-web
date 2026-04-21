import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { AudioSequencePlayer } from '../../utils/audio';
import styles from './SpellPracticePanel.module.css';

interface SpellPracticePanelProps {
  topHint: string;
  mediaUrl: string;
  posterUrl?: string;
  isVideo: boolean;
  pageAlign?: 'center' | 'top';
  inputValue: string;
  isWrong: boolean;
  hintText: string;
  audioSrc?: string;
  inputPlaceholder: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

const SpellPracticePanel: React.FC<SpellPracticePanelProps> = ({
  topHint,
  mediaUrl,
  posterUrl,
  isVideo,
  pageAlign = 'center',
  inputValue,
  isWrong,
  hintText,
  audioSrc,
  inputPlaceholder,
  onInputChange,
  onSubmit,
}) => {
  const handlePlayAudio = () => {
    if (!audioSrc) {
      return;
    }

    const player = new AudioSequencePlayer();
    player.playSequence([audioSrc]);
  };

  return (
    <div
      className={[
        styles.containerPage,
        pageAlign === 'top' ? styles.containerPageTop : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.container}>
        <div className={styles.topHint}>{topHint}</div>

        <div className={styles.imageContainer}>
          {isVideo ? (
            <video
              className={styles.mediaElement}
              src={mediaUrl}
              poster={posterUrl}
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            <div
              className={styles.mediaElement}
              style={{ backgroundImage: mediaUrl ? `url(${mediaUrl})` : undefined }}
            />
          )}
        </div>

        <input
          type="text"
          className={[styles.inputField, isWrong ? styles.inputFieldError : '']
            .filter(Boolean)
            .join(' ')}
          placeholder={inputPlaceholder}
          autoFocus
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit();
            }
          }}
        />

        <div
          className={[styles.hintCard, isWrong ? styles.hintCardError : '']
            .filter(Boolean)
            .join(' ')}
        >
          {hintText}
        </div>

        <div className={styles.actionRow}>
          <button className={styles.audioBtn} onClick={handlePlayAudio} type="button">
            <FontAwesomeIcon icon={faVolumeUp} />
          </button>
          <button className={styles.submitBtn} onClick={onSubmit} type="button">
            提交
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpellPracticePanel;
