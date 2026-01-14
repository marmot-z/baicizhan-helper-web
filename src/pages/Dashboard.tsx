import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useStudyStore } from '../stores/studyStore';
import { bookService } from '../services/bookService';
import type { UserBookItem } from '../types';
import { ROUTES } from '../constants';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { checkAndGetUserInfo } = useAuthStore();
  const { currentBook, studyPlan, fetchStudyData, lastStudyStatistics } = useStudyStore();
  const [studiedWordNum, setStudiedWordNum] = useState(0);

  // 处理搜索功能
  const handleSearch = () => {
    const searchPath = searchQuery.trim() 
      ? `${ROUTES.SEARCH}?q=${encodeURIComponent(searchQuery.trim())}`
      : ROUTES.SEARCH;
    navigate(searchPath);
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    // 检查并获取用户信息
    checkAndGetUserInfo();
    
    fetchStudyData();

    const beginOfToday = new Date().setHours(0, 0, 0, 0);
    if (lastStudyStatistics?.updateTime &&
        lastStudyStatistics.updateTime > beginOfToday) {
      setStudiedWordNum(lastStudyStatistics.words.length);
    }
    
    // 获取用户单词本信息
    const fetchUserBooks = async () => {
      try {
        const books = await bookService.getBooks();
        setUserBooks(books);
      } catch (error) {
        console.error('Failed to fetch user books:', error);
      }
    };
    
    fetchUserBooks();
  }, [fetchStudyData, checkAndGetUserInfo]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="dashboard-root">
      <div className="search-wrap">
          <input 
            type="search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="输入需要查询的单词" 
          />            
      </div>

      <main className="container">
        <section className="study-review" style={{
           flexDirection: isMobile ? 'column' : 'row'
         }}>
          <div className="book-info" style={{
            
          }}>
            {currentBook?.img ? (
              <img 
                src={currentBook.img} 
                alt={currentBook.name || '单词书封面'}
              />
            ) : (
              <div className="book-cover-placeholder"></div>
            )}
            <div className="book-details">
              <h2>{currentBook?.name || '雅思核心'}</h2>
              <p>{studyPlan?.learned_words_count} / {currentBook?.total_words_count}</p>
              <span>剩余 {currentBook && studyPlan ? Math.ceil((currentBook.total_words_count - studyPlan.learned_words_count) / (studyPlan.daily_plan_count || 1)) : 327} 天</span>
            </div>
          </div>
          <div className="today-plan" style={{
             borderLeft: isMobile ? 'none' : '1px solid #e7e7e7',
             borderTop: isMobile ? '1px solid #e7e7e7' : 'none',
             paddingLeft: isMobile ? '0' : '2rem',
             paddingTop: isMobile ? '2rem' : '0',
             marginTop: isMobile ? '2rem' : '0'
           }}>
            <h3>今日计划</h3>
            <div className="plan-stats">
              <div className="stat">
                <p>已新学</p>
                <p className="count">{studiedWordNum} <span>/ {studyPlan?.daily_plan_count}</span></p>
              </div>
              <div className="stat">
                <p>已复习</p>
                <p className="count">0 <span>/ {studyPlan?.review_plan_count}</span></p>
              </div>
            </div>
            <div className="plan-actions">
              <button 
                className="btn btn-study" 
                onClick={() => navigate(ROUTES.STUDY_VIEW)}
              >学习</button>
              <button className="btn btn-review" disabled>复习</button>
            </div>
          </div>
        </section>

        <section className="word-books">
          <h2>单词本</h2>
          <div className="word-book-list">
            {userBooks.map((book) => (
              <Link 
                key={book.user_book_id} 
                to={`/page/wordbook/${book.user_book_id}`}
                className="word-book-item" 
              >
                {book.cover ? (
                  <img 
                    src={book.cover} 
                    alt={book.book_name}
                  />
                ) : (
                  <div className="wb-cover-placeholder"></div>
                )}
                <div className="word-book-details">
                  <h3>{book.book_name}</h3>
                  <p>共 {book.word_num} 词</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
