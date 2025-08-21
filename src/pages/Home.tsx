// import React from 'react'; // React 17+ 不需要显式导入
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { UserBindInfo } from '../types';
import collectWordGif from '../assets/collect-word-min.gif';

export default function Home() {
  const { user, isAuthenticated, logout } = useAuthStore();

  // 获取用户昵称，优先选择微信用户，否则取第一个
  const getUserNickname = (): string => {
    if (!user || user.length === 0) return 'guest';
    
    const weixinUser = user.find((u: UserBindInfo) => u.provider === 'weixin');
    if (weixinUser) return weixinUser.nickname;
    
    return user[0].nickname || 'guest';
  };

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
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <img 
            src="/src/assets/icon.png" 
            alt="Logo" 
            style={{
              width: '30px',
              height: '30px',
              objectFit: 'contain'
            }}
          />
          <nav>
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex'
            }}>
              <li style={{ marginLeft: '20px' }}>
                <a href="https://gitee.com/mamotz/baicizhan-helper/wikis/%E4%BD%BF%E7%94%A8%E6%89%8B%E5%86%8C" style={{
                  textDecoration: 'none',
                  color: '#007bff'
                }} onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}>使用介绍</a>
              </li>
              <li style={{ marginLeft: '20px' }}>
                {isAuthenticated ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>                    
                    <Link 
                      to="/page/dashboard"
                      style={{
                        color: '#007bff',
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                      onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
                    >
                      {getUserNickname()}
                    </Link>
                  </div>
                ) : (
                  <Link to="/page/login" style={{
                    textDecoration: 'none',
                    color: '#007bff'
                  }} onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                      onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}>登录</Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" style={{
          padding: '4rem 0',
          backgroundColor: '#fff'
        }}>
          <div className="container hero-container" style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '2rem'
          }}>
            <div className="hero-text" style={{
              flex: 1,
              textAlign: 'left'
            }}>
              <h1 style={{
                fontSize: '2.5rem',
                marginBottom: '1.5rem'
              }}>浏览器翻译插件：简短介绍</h1>
              <div className="download-buttons" style={{
                marginBottom: '2rem'
              }}>
                <a href="https://chromewebstore.google.com/detail/%E7%99%BE%E8%AF%8D%E6%96%A9%E5%8A%A9%E6%89%8B/ofdejofffdjcmlbclhhfeaefodgffbnm" className="btn btn-chrome" style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  marginRight: '10px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  color: '#fff',
                  fontWeight: 'bold',
                  transition: 'background-color 0.3s ease',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#4285F4',
                  textDecoration: 'none'
                }} onMouseEnter={(e) => {
                   (e.target as HTMLElement).style.opacity = '0.9';
                   (e.target as HTMLElement).style.textDecoration = 'none';
                 }} onMouseLeave={(e) => {
                   (e.target as HTMLElement).style.opacity = '1';
                 }}>Chrome 下载</a>
                <a href="https://microsoftedge.microsoft.com/addons/detail/%E7%99%BE%E8%AF%8D%E6%96%A9%E5%8A%A9%E6%89%8B/ibfhkheckdidljgkaigigmempdpkjjpb" className="btn btn-edge" style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  marginRight: '10px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  color: '#fff',
                  fontWeight: 'bold',
                  transition: 'background-color 0.3s ease',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#0078D7',
                  textDecoration: 'none'
                }} onMouseEnter={(e) => {
                   (e.target as HTMLElement).style.opacity = '0.9';
                   (e.target as HTMLElement).style.textDecoration = 'none';
                 }} onMouseLeave={(e) => {
                   (e.target as HTMLElement).style.opacity = '1';
                 }}>Edge 下载</a>
                <a href="https://gitee.com/mamotz/baicizhan-helper/releases" className="btn btn-offline" style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  marginRight: '10px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  color: '#fff',
                  fontWeight: 'bold',
                  transition: 'background-color 0.3s ease',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: '#6c757d',
                  textDecoration: 'none'
                }} onMouseEnter={(e) => {
                   (e.target as HTMLElement).style.opacity = '0.9';
                   (e.target as HTMLElement).style.textDecoration = 'none';
                 }} onMouseLeave={(e) => {
                   (e.target as HTMLElement).style.opacity = '1';
                 }}>离线下载</a>
              </div>
            </div>
            <div className="hero-image" style={{
              flex: 1
            }}>
              <div className="screenshot-placeholder" style={{
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                width: '100%',
                height: '400px'
              }}>
                <img src={collectWordGif} alt="产品展示图" style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '8px'
                }} />
              </div>
            </div>
          </div>
        </section>

        <section className="features" style={{
          padding: '4rem 0'
        }}>
          <div className="container" style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 20px'
          }}>
            <div className="feature" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3rem',
              marginBottom: '4rem'
            }}>
              <div className="feature-content" style={{
                flex: '1',
                textAlign: 'center'
              }}>
                <h2 style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem'
                }}>选词翻译</h2>
                <p style={{
                  fontSize: '1.1rem',
                  color: '#6c757d',
                  marginBottom: '0'
                }}>选中单词，显示单词详情信息</p>
              </div>
              <div className="feature-image" style={{
                flex: '1'
              }}>
                <img 
                  src={collectWordGif} 
                  alt="搜索单词功能截图" 
                  style={{
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #ced4da'
                  }} 
                />
              </div>
            </div>
            <div className="feature" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3rem',
              marginBottom: '4rem'
            }}>
              <div className="feature-content" style={{
                flex: '1',
                textAlign: 'center'
              }}>
                <h2 style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem'
                }}>搜索单词</h2>
                <p style={{
                  fontSize: '1.1rem',
                  color: '#6c757d',
                  marginBottom: '0'
                }}>搜索单词详情内容</p>
              </div>
              <div className="feature-image" style={{
                flex: '1'
              }}>
                <img 
                  src="/src/assets/search.png" 
                  alt="搜索单词功能截图" 
                  style={{
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #ced4da'
                  }} 
                  />
              </div>
            </div>
            <div className="feature" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3rem',
              marginBottom: '4rem'
            }}>
              <div className="feature-content" style={{
                flex: '1',
                textAlign: 'center'
              }}>
                <h2 style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem'
                }}>收藏同步</h2>
                <p style={{
                  fontSize: '1.1rem',
                  color: '#6c757d',
                  marginBottom: '0'
                }}>收藏/取消收藏单词同步到 app</p>
              </div>
              <div className="feature-image" style={{
                flex: '1'
              }}>
                <img 
                  src="/src/assets/collect.png" 
                  alt="搜索单词功能截图" 
                  style={{
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #ced4da'
                  }} 
                  />
              </div>
            </div>
            <div className="feature" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3rem',
              marginBottom: '4rem'
            }}>
              <div className="feature-content" style={{
                flex: '1',
                textAlign: 'center'
              }}>
                <h2 style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem'
                }}>anki 导出</h2>
                <p style={{
                  fontSize: '1.1rem',
                  color: '#6c757d',
                  marginBottom: '0'
                }}>导出单词到 anki 上</p>
              </div>
              <div className="feature-image" style={{
                flex: '1'
              }}>
                <div className="screenshot-placeholder" style={{
                  backgroundColor: '#e9ecef',
                  border: '1px solid #ced4da',
                  borderRadius: '8px',
                  width: '100%',
                  height: '300px'
                }}></div>
              </div>
            </div>
            <div className="feature" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3rem',
              marginBottom: '4rem'
            }}>
              <div className="feature-content" style={{
                flex: '1',
                textAlign: 'center'
              }}>
                <h2 style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem'
                }}>学习/复习</h2>
                <p style={{
                  fontSize: '1.1rem',
                  color: '#6c757d',
                  marginBottom: '0'
                }}>在浏览器上背单词</p>
              </div>
              <div className="feature-image" style={{
                flex: '1'
              }}>
                <img 
                  src="/src/assets/study.png" 
                  alt="搜索单词功能截图" 
                  style={{
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #ced4da'
                  }} 
                  />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer" style={{
        textAlign: 'center',
        padding: '2rem 0',
        backgroundColor: '#343a40',
        color: '#fff'
      }}>
        <div className="container" style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 20px'
        }}>
          <p>友情链接 | 备案信息</p>
        </div>
      </footer>
    </div>
  );
}