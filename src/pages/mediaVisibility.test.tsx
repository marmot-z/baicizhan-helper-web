import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SpellPracticePanel from '../components/spell/SpellPracticePanel';
import type { ReviewChoiceState } from '../services/review/types';
import type { StudyUIModel } from '../services/study/types';
import StudyFrontCard from './StudyFrontCard';
import ReviewChoiceCard from './review/ReviewChoiceCard';

const word: StudyUIModel = {
  topicId: 1,
  word: 'taxi',
  collected: false,
  front: {
    media: {
      type: 'video',
      url: 'https://example.com/word.mp4',
      poster: 'https://example.com/poster.jpg',
    },
    accent: { uk: '', us: '', ukAudio: '', usAudio: '' },
    options: [],
    chnMean: '出租车',
  },
  back: {
    cnMeans: [],
    sentences: [{ en: 'Take a taxi.', cn: '乘出租车。' }],
  },
  extensions: {
    enMeans: [],
    phrases: [],
    variants: [],
    synonyms: [],
    antonyms: [],
    similars: [],
  },
};

const choiceState: ReviewChoiceState = {
  word,
  options: [],
  selectedOptionIds: [],
  attemptCount: 0,
  isOptionsLoading: false,
  remainingInRound: 0,
  retryCount: 0,
  showWord: true,
  showSentence: true,
  showTranslation: false,
  showEnglishTranslation: false,
};

describe('main study media visibility', () => {
  it('does not render study-front video when media is disabled', () => {
    const markup = renderToStaticMarkup(
      <StudyFrontCard
        uiModel={word}
        wordCard={{ showWord: true, showSentence: true }}
        studyPlan={null}
        study={null}
        selectedOptionIds={[]}
        optionClick={vi.fn()}
        options={[]}
        showMedia={false}
      />
    );

    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('word.mp4');
  });

  it('does not render review-choice or spelling media containers when disabled', () => {
    const reviewMarkup = renderToStaticMarkup(
      <ReviewChoiceCard
        state={choiceState}
        totalWords={1}
        completedWords={0}
        showMedia={false}
        onChoose={vi.fn()}
      />
    );
    const spellMarkup = renderToStaticMarkup(
      <SpellPracticePanel
        topHint="剩余 1 词"
        mediaUrl="https://example.com/word.mp4"
        isVideo
        showMedia={false}
        inputValue=""
        isWrong={false}
        hintText="出租车"
        inputPlaceholder="请输入"
        onInputChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(reviewMarkup).not.toContain('<video');
    expect(reviewMarkup).not.toContain('word.mp4');
    expect(spellMarkup).not.toContain('<video');
    expect(spellMarkup).not.toContain('word.mp4');
  });

  it('keeps the original video rendering when media is enabled', () => {
    const markup = renderToStaticMarkup(
      <ReviewChoiceCard
        state={choiceState}
        totalWords={1}
        completedWords={0}
        showMedia
        onChoose={vi.fn()}
      />
    );

    expect(markup).toContain('<video');
    expect(markup).toContain('word.mp4');
  });
});
