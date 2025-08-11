import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarDays, faCartShopping, faArrowRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../stores/authStore';
import { useStudyStore } from '../stores/studyStore';
import { bookService } from '../services/bookService';
import type { UserBindInfo, UserBookItem } from '../types';
import iconLogo from '../assets/icon.png';

export default function Dashboard() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const { user } = useAuthStore();
  const { currentBook, studyPlan, fetchStudyData } = useStudyStore();

  // 获取用户昵称，优先选择微信用户，否则取第一个
  const getUserNickname = (): string => {
    if (!user || user.length === 0) return 'guest';
    
    const weixinUser = user.find((u: UserBindInfo) => u.provider === 'weixin');
    if (weixinUser) return weixinUser.nickname;
    
    return user[0].nickname || 'guest';
  };

  useEffect(() => {
    fetchStudyData();
    
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
  }, [fetchStudyData]);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      margin: 0,
      lineHeight: 1.6,
      backgroundColor: '#f8f9fa',
      color: '#333'
    }}>
      <header className="navbar" style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e7e7e7',
        padding: '1rem 0'
      }}>
        <div className="container" style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <img 
            src={iconLogo} 
            alt="Logo" 
            className="logo" 
            style={{
              height: '2rem',
              width: 'auto'
            }} 
          />
          <nav>
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center'
            }}>
              <li style={{ marginLeft: '20px' }}>
                {/* 根据登录状态显示不同内容 */}
                {
                  <div className="user-profile" style={{
                     position: 'relative',
                     cursor: 'pointer'
                   }} onMouseEnter={(e) => {
                     const dropdown = e.currentTarget.querySelector('.dropdown-content') as HTMLElement;
                     if (dropdown) dropdown.style.display = 'block';
                   }} onMouseLeave={(e) => {
                     const dropdown = e.currentTarget.querySelector('.dropdown-content') as HTMLElement;
                     if (dropdown) dropdown.style.display = 'none';
                   }}>
                    <FontAwesomeIcon 
                      icon={faUser} 
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'inline-block',
                        verticalAlign: 'middle',
                        backgroundColor: '#f0f0f0',
                        padding: '10px',
                        color: '#666'
                      }} 
                    />
                    <span style={{
                      verticalAlign: 'middle',
                      marginLeft: '8px'
                    }}>{getUserNickname()}</span>
                    <div className="dropdown-content" style={{
                      display: 'none',
                      position: 'absolute',
                      right: 0,
                      backgroundColor: '#fff',
                      minWidth: '160px',
                      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
                      zIndex: 1,
                      borderRadius: '5px'
                    }}>
                      <Link to="/study-calendar" style={{
                        color: 'black',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        display: 'block'
                      }} onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = '#f1f1f1';
                      }} onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}><FontAwesomeIcon icon={faCalendarDays} style={{ marginRight: '8px' }} />我的日历</Link>
                      <a href="#" style={{
                        color: 'black',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        display: 'block'
                      }} onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = '#f1f1f1';
                      }} onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}><FontAwesomeIcon icon={faCartShopping} style={{ marginRight: '8px' }} />会员中心</a>
                      <a href="#" style={{
                        color: 'black',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        display: 'block'
                      }} onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = '#f1f1f1';
                      }} onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}><FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: '8px' }} />退出</a>
                    </div>
                  </div>
                }
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="container" style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '20px'
      }}>
        <section className="study-review" style={{
           backgroundColor: '#fff',
           padding: '2rem',
           marginTop: '2rem',
           borderRadius: '8px',
           boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
           display: 'flex',
           flexDirection: isMobile ? 'column' : 'row',
           gap: '2rem',
           justifyContent: 'flex-start',
           alignItems: 'center'
         }}>
          <div className="book-info" style={{
            width: '50%',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {currentBook?.img ? (
              <img 
                src={currentBook.img} 
                alt={currentBook.name || '单词书封面'}
                style={{
                  width: '140px',
                  borderRadius: '4px',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '120px',
                height: '150px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px'
              }}></div>
            )}
            <div className="book-details">
              <h2 style={{
                fontSize: '1.2rem',
                margin: '0 0 0.5rem 0'
              }}>{currentBook?.name || '雅思核心'}</h2>
              <p style={{
                margin: 0,
                color: '#6c757d'
              }}>{studyPlan?.learned_words_count} / {currentBook?.total_words_count}</p>
              <span style={{
                fontSize: '0.9rem',
                color: '#6c757d'
              }}>剩余 {currentBook && studyPlan ? Math.ceil((currentBook.total_words_count - studyPlan.learned_words_count) / (studyPlan.daily_plan_count || 1)) : 327} 天</span>
            </div>
          </div>
          <div className="today-plan" style={{
             borderLeft: isMobile ? 'none' : '1px solid #e7e7e7',
             borderTop: isMobile ? '1px solid #e7e7e7' : 'none',
             paddingLeft: isMobile ? '0' : '2rem',
             paddingTop: isMobile ? '2rem' : '0',
             marginTop: isMobile ? '2rem' : '0',
             textAlign: 'center'
           }}>
            <h3 style={{
              marginTop: 0,
              fontSize: '1.2rem'
            }}>今日计划</h3>
            <div className="plan-stats" style={{
              display: 'flex',
              gap: '2rem',
              marginBottom: '1.5rem',
              justifyContent: 'center'
            }}>
              <div className="stat">
                <p style={{
                  margin: 0,
                  color: '#6c757d'
                }}>已新学</p>
                <p className="count" style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#333',
                  margin: 0
                }}>0 <span style={{
                  fontSize: '1rem',
                  fontWeight: 'normal',
                  color: '#6c757d'
                }}>/ {studyPlan?.daily_plan_count}</span></p>
              </div>
              <div className="stat">
                <p style={{
                  margin: 0,
                  color: '#6c757d'
                }}>已复习</p>
                <p className="count" style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#333',
                  margin: 0
                }}>0 <span style={{
                  fontSize: '1rem',
                  fontWeight: 'normal',
                  color: '#6c757d'
                }}>/ {studyPlan?.review_plan_count}</span></p>
              </div>
            </div>
            <div className="plan-actions" style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button className="btn btn-study" disabled style={{
                padding: '10px 20px',
                borderRadius: '5px',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'not-allowed',
                fontSize: '1rem',
                backgroundColor: '#007bff',
                opacity: 0.5
              }}>学习</button>
              <button className="btn btn-review" disabled style={{
                padding: '10px 20px',
                borderRadius: '5px',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'not-allowed',
                fontSize: '1rem',
                backgroundColor: '#28a745',
                opacity: 0.5
              }}>复习</button>
            </div>
          </div>
        </section>

        <section className="word-books" style={{
          marginTop: '2rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1rem'
          }}>单词本</h2>
          <div className="word-book-list" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            {userBooks.map((book) => (
              <Link 
                key={book.user_book_id} 
                to={`/wordbook/${book.user_book_id}`}
                className="word-book-item" 
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
              >
                {book.cover ? (
                  <img 
                    src={book.cover} 
                    alt={book.book_name}
                    style={{
                      width: '60px',
                      height: '80px',
                      borderRadius: '4px',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '60px',
                    height: '80px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px'
                  }}></div>
                )}
                <div className="word-book-details">
                  <h3 style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.1rem'
                  }}>{book.book_name}</h3>
                  <p style={{
                    margin: 0,
                    color: '#6c757d'
                  }}>共 {book.word_num} 词</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}