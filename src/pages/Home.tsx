// import React from 'react'; // React 17+ 不需要显式导入
import { Link } from 'react-router-dom';
import collectWordGif from '../assets/collect-word-min.gif';

export default function Home() {
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
          <div className="logo" style={{
            fontSize: '1.5rem',
            fontWeight: 'bold'
          }}>Logo</div>
          <nav>
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex'
            }}>
              <li style={{ marginLeft: '20px' }}>
                <a href="#" style={{
                  textDecoration: 'none',
                  color: '#007bff'
                }} onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}>使用介绍</a>
              </li>
              <li style={{ marginLeft: '20px' }}>
                <Link to="/login" style={{
                  textDecoration: 'none',
                  color: '#007bff'
                }} onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                    onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}>登录</Link>
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
                <a href="#" className="btn btn-chrome" style={{
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
                <a href="#" className="btn btn-edge" style={{
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
                <a href="#" className="btn btn-offline" style={{
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
              textAlign: 'center',
              marginBottom: '4rem'
            }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>选词翻译</h2>
              <p style={{
                fontSize: '1.1rem',
                color: '#6c757d',
                marginBottom: '1.5rem'
              }}>选中单词，显示单词详情信息</p>
              <div className="screenshot-placeholder" style={{
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                width: '100%',
                height: '300px'
              }}></div>
            </div>
            <div className="feature" style={{
              textAlign: 'center',
              marginBottom: '4rem'
            }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>搜索单词</h2>
              <p style={{
                fontSize: '1.1rem',
                color: '#6c757d',
                marginBottom: '1.5rem'
              }}>搜索单词详情内容</p>
              <div className="screenshot-placeholder" style={{
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                width: '100%',
                height: '300px'
              }}></div>
            </div>
            <div className="feature" style={{
              textAlign: 'center',
              marginBottom: '4rem'
            }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>收藏同步</h2>
              <p style={{
                fontSize: '1.1rem',
                color: '#6c757d',
                marginBottom: '1.5rem'
              }}>收藏/取消收藏单词同步到 app</p>
              <div className="screenshot-placeholder" style={{
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                width: '100%',
                height: '300px'
              }}></div>
            </div>
            <div className="feature" style={{
              textAlign: 'center',
              marginBottom: '4rem'
            }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>anki 导出</h2>
              <p style={{
                fontSize: '1.1rem',
                color: '#6c757d',
                marginBottom: '1.5rem'
              }}>导出单词到 anki 上</p>
              <div className="screenshot-placeholder" style={{
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                width: '100%',
                height: '300px'
              }}></div>
            </div>
            <div className="feature" style={{
              textAlign: 'center',
              marginBottom: '4rem'
            }}>
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '0.5rem'
              }}>学习/复习</h2>
              <p style={{
                fontSize: '1.1rem',
                color: '#6c757d',
                marginBottom: '1.5rem'
              }}>在浏览器上背单词</p>
              <div className="screenshot-placeholder" style={{
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                width: '100%',
                height: '300px'
              }}></div>
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