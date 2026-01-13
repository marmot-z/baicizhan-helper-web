import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import './MyCalendar.css';
import { studyService } from '../services/studyService';
import type { CalendarDailyInfo, CalendarDailyWord } from '../types';
import styles from './StudyCalendar.module.css';

const StudyCalendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // 2024年9月20日
  const [dailyInfo, setDailyInfo] = useState<CalendarDailyInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // 格式化日期为 yyyyMMdd 格式
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // 获取日期学习内容
  const fetchDailyInfo = async (date: Date) => {
    setLoading(true);
    try {
      const dateString = formatDateToString(date);
      const info = await studyService.getCalendarDailyInfo(dateString);
      setDailyInfo(info);
    } catch (error) {
      console.error('获取学习内容失败:', error);
      setDailyInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // 处理日期选择
  const handleDateChange = (value: any) => {
    let newDate: Date | null = null;
    if (value instanceof Date) {
      newDate = value;
    } else if (Array.isArray(value) && value[0] instanceof Date) {
      newDate = value[0];
    }
    
    if (newDate) {
      setSelectedDate(newDate);
      fetchDailyInfo(newDate);
    }
  };

  // 格式化日期显示
  const formatSelectedDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  // 初始化时获取当前日期的学习内容
  useEffect(() => {
    fetchDailyInfo(selectedDate);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* 日历卡片 */}
        <div className={styles.calendarWrapper}>
          <Calendar
              onChange={handleDateChange}
              value={selectedDate}
              locale="en-US"
              showNavigation={true}  // 显示导航
              showNeighboringMonth={true} 
            />
        </div>

        {/* 每日学习记录 */}
        <section className={styles.dailySection}>
          <h2 className={styles.dateHeader}>
            {formatSelectedDate(selectedDate)}
          </h2>
          <div>
            {loading ? (
              <div className={styles.message}>
                加载中...
              </div>
            ) : dailyInfo && dailyInfo.words && dailyInfo.words.length > 0 ? (
              dailyInfo.words.map((wordData: CalendarDailyWord, index: number) => (
                <div 
                  key={wordData.topic_id || index} 
                  className={`${styles.wordItem} ${index !== dailyInfo.words.length - 1 ? styles.wordItemWithBorder : ''}`}
                >
                  <span className={styles.wordText}>
                    {wordData.word}
                  </span>
                  <span className={styles.meanText}>
                    {wordData.mean}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.message}>
                {dailyInfo?.hint || '暂无学习内容'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudyCalendar;
