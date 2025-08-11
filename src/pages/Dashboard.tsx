import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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
          <div className="logo" style={{
            fontSize: '1.5rem',
            fontWeight: 'bold'
          }}>Logo</div>
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
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '50%',
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }}></div>
                    <span style={{
                      verticalAlign: 'middle',
                      marginLeft: '8px'
                    }}>zhxw</span>
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
                      <a href="#" style={{
                        color: 'black',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        display: 'block'
                      }} onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = '#f1f1f1';
                      }} onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}>我的日历</a>
                      <a href="#" style={{
                        color: 'black',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        display: 'block'
                      }} onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = '#f1f1f1';
                      }} onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}>会员中心</a>
                      <a href="#" style={{
                        color: 'black',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        display: 'block'
                      }} onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = '#f1f1f1';
                      }} onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}>退出</a>
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
            <div style={{
              width: '120px',
              height: '150px',
              backgroundColor: '#e9ecef',
              borderRadius: '4px'
            }}></div>
            <div className="book-details">
              <h2 style={{
                fontSize: '1.2rem',
                margin: '0 0 0.5rem 0'
              }}>雅思核心 <a href="#" style={{
                 fontSize: '0.9rem',
                 fontWeight: 'normal',
                 color: '#007bff',
                 textDecoration: 'none'
               }} onMouseEnter={(e) => {
                 (e.target as HTMLElement).style.textDecoration = 'underline';
               }} onMouseLeave={(e) => {
                 (e.target as HTMLElement).style.textDecoration = 'none';
               }}>修改 &gt;</a></h2>
              <p style={{
                margin: 0,
                color: '#6c757d'
              }}>2 / 3272</p>
              <span style={{
                fontSize: '0.9rem',
                color: '#6c757d'
              }}>剩余 327 天</span>
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
                }}>/ 10</span></p>
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
                }}>/ 2</span></p>
              </div>
            </div>
            <div className="plan-actions" style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button className="btn btn-study" style={{
                padding: '10px 20px',
                borderRadius: '5px',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                backgroundColor: '#007bff'
              }}>学习</button>
              <button className="btn btn-review" style={{
                padding: '10px 20px',
                borderRadius: '5px',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                backgroundColor: '#28a745'
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
            <div className="word-book-item" style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '60px',
                height: '80px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px'
              }}></div>
              <div className="word-book-details">
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.1rem'
                }}>雅思核心词汇</h3>
                <p style={{
                  margin: 0,
                  color: '#6c757d'
                }}>共 3272 词</p>
              </div>
            </div>
            <div className="word-book-item" style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '60px',
                height: '80px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px'
              }}></div>
              <div className="word-book-details">
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.1rem'
                }}>我的收藏</h3>
                <p style={{
                  margin: 0,
                  color: '#6c757d'
                }}>共 150 词</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}