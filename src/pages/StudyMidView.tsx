import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../constants';
import styles from './StudyMidView.module.css';
import type { StudyUIModel } from '../services/study/types';

const StudyMidView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const words = (location.state as { words?: StudyUIModel[] })?.words || [];

  const handleContinue = () => {
    navigate(ROUTES.SPELL_VIEW, { state: { words } });
  };

  const handleSkip = () => {
    navigate(ROUTES.STUDY_STATISTICS);
  };

  return (
    <div className={styles.container}>
      <div className={styles.glowOverlay}></div>
      <div className={styles.celebrationCard}>
        <div className={styles.illustration}>
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="40" width="100" height="110" rx="10" fill="#f8f9fa" />
            <path d="M60 60h80v70H60z" fill="#e9ecef" />
            <circle cx="100" cy="90" r="50" fill="#FFD700" />
            <path
              d="M100 50 L115 85 L150 85 L122 105 L132 140 L100 120 L68 140 L78 105 L50 85 L85 85 Z"
              fill="#FFA500"
            />
            <rect x="70" y="140" width="60" height="10" fill="#FFD700" />
          </svg>
        </div>

        <h1 className={styles.titleEn}>Well Done!</h1>

        <div className={styles.titleCn}>今日学习计划完成</div>
        <div className={styles.subtitle}>爱「拼」才会赢，单词记更清</div>

        <div className={styles.buttonGroup}>
          <button className={styles.btnMain} onClick={handleContinue}>继续拼写</button>
          <button className={styles.btnLink} onClick={handleSkip}>跳过</button>
        </div>
      </div>
    </div>
  );
};

export default StudyMidView;
