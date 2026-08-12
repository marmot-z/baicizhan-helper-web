import React, { useState } from 'react';
import { useStudyStore } from '../stores/studyStore';
import celebrationImage from '../assets/celebrate.jpeg';
import styles from './studyStatistics.module.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import type { StudyStatistcs } from '../services/study/types';

interface StudyStatisticsLocationState {
  source?: 'review';
  statisticsOverride?: StudyStatistcs;
  from?: string;
}

const StudyStatistics: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { lastStudyStatistics } = useStudyStore();
  const [visibleMeanings, setVisibleMeanings] = useState<Set<string>>(new Set());
  const routeState = location.state as StudyStatisticsLocationState | null;
  const statistics = routeState?.statisticsOverride ?? lastStudyStatistics;

  // 如果没有学习记录，显示提示信息
  if (!statistics) {
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
  const killedTopicIds = new Set(statistics.killedTopicIds ?? []);
  const scoredWords = statistics.words.filter((word) => !killedTopicIds.has(word.topic_id));
  const failedWords = scoredWords.filter((word) => (statistics.failMap[word.topic_id] ?? 0) > 0).length;
  const correctWords = scoredWords.length - failedWords;
  const accuracy = scoredWords.length > 0
    ? Math.round((correctWords / scoredWords.length) * 100)
    : 100;
  
  // 计算总学习时间（毫秒转换为分:秒格式）
  const totalTime = statistics.totalTime;
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
              {statistics.words.map((word, index) => {
                const failCount = statistics.failMap[word.topic_id] || 0;
                const wordId = String(word.topic_id || `word-${index}`);
                const isVisible = visibleMeanings.has(wordId);
                const isKilled = killedTopicIds.has(word.topic_id);
                
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
                      {isKilled ? (
                        <span className={styles.killedText}>斩 已掌握</span>
                      ) : failCount === 0 ? (
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

      <div className={styles.backButtonContainer}>
        <button className={styles.backButton} onClick={() => navigate(ROUTES.DASHBOARD)}>返回首页</button>
      </div>
    </div>
  );
};

export default StudyStatistics;
