import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarDays, faCartShopping, faArrowRightFromBracket, faCommentDots, faDownload, faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../stores/authStore';
import { useStudyStore } from '../stores/studyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { bookService } from '../services/bookService';
import ExtensionsDownloadModel from '../components/ExtensionsDownloadModel';
import type { UserBindInfo, UserBookItem } from '../types';
import { ROUTES } from '../constants';
import iconLogo from '../assets/icon.png';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadModelShow, setDownloadModelShow] = useState(false);
  const { user, logout, checkAndGetUserInfo } = useAuthStore();
  const { currentBook, studyPlan, fetchStudyData, lastStudyStatistics } = useStudyStore();
  const [studiedWordNum, setStudiedWordNum] = useState(0);
  const { theme, setTheme } = useSettingsStore();

  // 获取用户昵称，优先选择微信用户，否则取第一个
  const getUserNickname = (): string => {
    if (!user || user.length === 0) return 'guest';
    
    const weixinUser = user.find((u: UserBindInfo) => u.provider === 'weixin');
    if (weixinUser) return weixinUser.nickname;
    
    return user[0].nickname || 'guest';
  };

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

  const closeDownloadModel = () => {
    setDownloadModelShow(false);
  }

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
      <header className="navbar">
        <div className="container">
          <img 
            src={iconLogo} 
            alt="Logo" 
            className="logo" 
            onClick={() => navigate(ROUTES.HOME)}
          />
          <nav>
            <ul>
              <li>
                {/* 根据登录状态显示不同内容 */}
                {
                  <div className="theme-bar">
                    <button
                      title={theme === 'dark' ? '切换为明亮' : '切换为暗黑'}
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      role="switch"
                      aria-checked={theme === 'dark'}
                      className="theme-switch"
                    >
                      <span className="theme-switch-inner">
                        <span className="track">
                          <span className="thumb" />
                        </span>
                        <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
                      </span>
                    </button>
                    <div className="user-profile" onMouseEnter={(e) => {
                       const dropdown = e.currentTarget.querySelector('.dropdown-content') as HTMLElement;
                       if (dropdown) dropdown.style.display = 'block';
                     }} onMouseLeave={(e) => {
                       const dropdown = e.currentTarget.querySelector('.dropdown-content') as HTMLElement;
                       if (dropdown) dropdown.style.display = 'none';
                     }}>
                      <FontAwesomeIcon icon={faUser} />
                      <span>{getUserNickname()}</span>
                    <div className="dropdown-content">
                      <Link to="/page/study-calendar"><FontAwesomeIcon icon={faCalendarDays} style={{ marginRight: '8px' }} />我的日历</Link>
                      <a href="/page/vip-center"><FontAwesomeIcon icon={faCartShopping} style={{ marginRight: '8px' }} />会员中心</a>
                      <a href="#" onClick={(e) => {
                        e.preventDefault();
                        setDownloadModelShow(true);
                      }}><FontAwesomeIcon icon={faDownload} style={{ marginRight: '8px' }} />插件下载</a>
                      <a href="http://www.baicizhan-helper.cn/comments" target="_blank"><FontAwesomeIcon icon={faCommentDots} style={{ marginRight: '8px' }} />反馈</a>
                      <a href="#" onClick={(e) => {
                        e.preventDefault();
                        logout();
                      }}><FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: '8px' }} />退出</a>
                    </div>
                    </div>
                  </div>
                }
              </li>
            </ul>
          </nav>
        </div>
      </header>

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
      <ExtensionsDownloadModel showModal={downloadModelShow} onClose={closeDownloadModel} />    
    </div>
  );
}
