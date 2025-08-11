import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { studyService } from '../services/studyService';
import type { CalendarDailyInfo, CalendarDailyWord } from '../types';

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
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <div className="mx-auto p-5" style={{ maxWidth: '800px' }}>
        {/* 日历卡片 */}
        <div className="flex justify-center mb-6">
          <Calendar
              onChange={handleDateChange}
              value={selectedDate}
              locale="en-US"
              showNavigation={true}  // 显示导航
              showNeighboringMonth={true} 
            />
        </div>

        {/* 每日学习记录 */}
        <section className="bg-white rounded-lg" style={{ padding: '1.5rem' }}>
          <h2 className="font-bold" style={{ fontSize: '1.2rem', marginTop: '0', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e7e7e7' }}>
            {formatSelectedDate(selectedDate)}
          </h2>
          <div>
            {loading ? (
              <div className="text-center py-4" style={{ color: '#6c757d' }}>
                加载中...
              </div>
            ) : dailyInfo && dailyInfo.words && dailyInfo.words.length > 0 ? (
              dailyInfo.words.map((wordData: CalendarDailyWord, index: number) => (
                <div key={wordData.topic_id || index} className="flex items-center" style={{ padding: '0.75rem 0', borderBottom: index === dailyInfo.words.length - 1 ? 'none' : '1px solid #e7e7e7' }}>
                  <span className="font-bold" style={{ marginRight: '1rem', flexShrink: 0 }}>
                    {wordData.word}
                  </span>
                  <span style={{ color: '#6c757d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {wordData.mean}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4" style={{ color: '#6c757d' }}>
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