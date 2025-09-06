import React, { useState } from 'react';
import { useStudyStore } from '../stores/studyStore';
import celebrationImage from '../assets/celebrate.jpeg';
import styles from './studyStatistics.module.css';

interface StudyStatisticsProps {
  // 可以根据需要添加props
}

const StudyStatistics: React.FC<StudyStatisticsProps> = () => {
  const { lastStudyStatistics } = useStudyStore();
  const [visibleMeanings, setVisibleMeanings] = useState<Set<string>>(new Set());

  // 如果没有学习记录，显示提示信息
  if (!lastStudyStatistics) {
    return (
      <div className={styles.body}>
        <div className={styles.container}>
          <div className={styles.noDataMessage}>
            最近没有学习记录
          </div>
        </div>
      </div>
    );
  }

  // 计算学习统计数据
  const totalWords = lastStudyStatistics.words.length;
  const failedWords = Object.values(lastStudyStatistics.failMap).reduce((sum, count) => sum + count, 0);
  const correctWords = totalWords - failedWords;
  const accuracy = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;
  
  // 计算总学习时间（毫秒转换为分:秒格式）
  const totalTime = lastStudyStatistics.totalTime;
  const minutes = Math.floor(totalTime / 60000);
  const seconds = Math.floor((totalTime % 60000) / 1000);
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  return (
    <div className={styles.body}>
      <div className={styles.container}>
        <div className={styles.summaryHeader}>
          <img src={celebrationImage} alt="Celebration" className={styles.celebrationImage} />
        </div>
        <div className={styles.statsContainer}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{timeDisplay}</div>
            <div className={styles.statLabel}>学习用时</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{accuracy}%</div>
            <div className={styles.statLabel}>正确率</div>
          </div>
        </div>
        <div className={styles.wordListContainer}>
          <table className={styles.wordListTable}>
            <tbody>
              {lastStudyStatistics.words.map((word, index) => {
                const failCount = lastStudyStatistics.failMap[word.topic_id] || 0;
                const wordId = String(word.topic_id || `word-${index}`);
                const isVisible = visibleMeanings.has(wordId);
                
                const toggleMeaning = () => {
                  const newVisibleMeanings = new Set(visibleMeanings);
                  if (isVisible) {
                    newVisibleMeanings.delete(wordId);
                  } else {
                    newVisibleMeanings.add(wordId);
                  }
                  setVisibleMeanings(newVisibleMeanings);
                };
                
                return (
                  <tr key={word.topic_id || index}>
                    <td><b>{word.word}</b></td>
                    <td 
                      className={isVisible ? styles.visibleMeaning : styles.hiddenMeaning}
                      onClick={toggleMeaning}
                    >
                      {word.mean_cn}
                    </td>
                    <td>
                      {failCount === 0 ? (
                        <span className={styles.correctText}>✓ 正确</span>
                      ) : (
                        <span>错 <span className={styles.errorText}>{failCount}</span> 次</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudyStatistics;