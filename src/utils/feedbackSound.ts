import correctSoundUrl from '../assets/sounds/answer_right.mp3';
import incorrectSoundUrl from '../assets/sounds/answer_error.mp3';

type FeedbackSoundType = 'correct' | 'incorrect';

const FEEDBACK_SOUND_URLS: Record<FeedbackSoundType, string> = {
  correct: correctSoundUrl,
  incorrect: incorrectSoundUrl,
};

const playSound = (type: FeedbackSoundType): void => {
  const audio = new Audio(FEEDBACK_SOUND_URLS[type]);
  audio.preload = 'auto';
  audio.volume = 0.75;

  audio.play().catch((error) => {
    console.warn(`Feedback sound play failed: ${type}`, error);
  });
};

export const feedbackSoundPlayer = {
  playCorrect(): void {
    playSound('correct');
  },
  playIncorrect(): void {
    playSound('incorrect');
  },
};
