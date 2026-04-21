import React from 'react';
import styles from './StudyLoadingState.module.css';

interface StudyLoadingStateProps {
  title: string;
  subtitle?: string;
}

const StudyLoadingState: React.FC<StudyLoadingStateProps> = ({ title, subtitle }) => {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden="true" />
        <h2 className={styles.title}>{title}</h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </div>
  );
};

export default StudyLoadingState;
