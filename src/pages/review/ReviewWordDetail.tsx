import React from 'react';
import type { ReviewDetailState } from '../../services/review/types';
import StudyBackCard from '../StudyBackCard';
import studyStyles from '../StudyView.module.css';

interface ReviewWordDetailProps {
  state: ReviewDetailState;
  onNext: () => void;
}

const ReviewWordDetail: React.FC<ReviewWordDetailProps> = ({ state, onNext }) => {
  return (
    <div className={studyStyles.container}>
      <StudyBackCard
        uiModel={state.word}
        next={onNext}
        nextLabel={state.nextLabel}
        showCollect={false}
      />
    </div>
  );
};

export default ReviewWordDetail;
