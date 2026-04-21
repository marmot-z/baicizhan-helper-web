import React from 'react';
import type { ReviewSpellState } from '../../services/review/types';
import SpellPracticePanel from '../../components/spell/SpellPracticePanel';

interface ReviewSpellCardProps {
  state: ReviewSpellState;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

const buildMediaUrl = (url?: string) => {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://7n.bczcdn.com${url}`;
};

const ReviewSpellCard: React.FC<ReviewSpellCardProps> = ({
  state,
  inputValue,
  onInputChange,
  onSubmit,
}) => {
  const mediaUrl = buildMediaUrl(
    state.word.front.media?.url || state.word.back.sentences[0]?.img
  );
  const posterUrl = buildMediaUrl(
    state.word.front.media?.poster || state.word.back.sentences[0]?.img
  );
  const isVideo = state.word.front.media?.type === 'video';

  return (
    <SpellPracticePanel
      topHint={`本轮剩余 ${state.remainingInRound + 1} 词${
        state.retryCount > 0 ? ` · 待重拼 ${state.retryCount}` : ''
      }`}
      mediaUrl={mediaUrl}
      posterUrl={posterUrl}
      isVideo={Boolean(isVideo)}
      pageAlign="top"
      inputValue={inputValue}
      isWrong={state.isWrong}
      hintText={state.isWrong ? state.word.word : state.word.front.chnMean}
      audioSrc={state.word.front.accent.ukAudio}
      inputPlaceholder="请输入英文单词"
      onInputChange={onInputChange}
      onSubmit={onSubmit}
    />
  );
};

export default ReviewSpellCard;
