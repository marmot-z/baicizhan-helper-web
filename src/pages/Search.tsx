import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookService } from '../services/bookService';
import type { SearchWordResultV2 } from '../types';
import { ROUTES } from '../constants';

// 添加搜索结果项的聚焦样式
const searchResultStyles = `
  .search-result-item:focus {
    border-bottom: 2px solid #03A9F4 !important;
    outline: none;
  }
`;

const Search: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchWordResultV2[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 搜索函数
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    // 更新URL，同步搜索关键词到URL参数
    navigate(ROUTES.SEARCH + `?q=${encodeURIComponent(searchQuery.trim())}`);
  };
  
  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 从 URL 参数中获取搜索关键词并自动搜索
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
      // 自动执行搜索
      const performSearch = async () => {
        setIsLoading(true);
        try {
          const results = await bookService.searchWord(queryParam);
          setSearchResults(results);
        } catch (error) {
          console.error('搜索失败:', error);
          setSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      };
      performSearch();
    }
  }, [location.search]);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      margin: 0,
      lineHeight: 1.6,
      backgroundColor: '#fff',
      color: '#333'
    }}>
      <style dangerouslySetInnerHTML={{ __html: searchResultStyles }} />
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '15px'
      }}>
        {/* Search Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          padding: '10px 0',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '20px',
            padding: '8px 12px'
          }}>            
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入需要查询的单词"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: '1rem',
                padding: '0 8px',
                outline: 'none'
              }}
            />
            <FontAwesomeIcon 
              icon={faMagnifyingGlass} 
              onClick={handleSearch}
              style={{
                fontSize: '1.2rem',
                color: '#6c757d',
                cursor: 'pointer'
              }} 
            />
          </div>
        </header>

        {/* Search Results */}
        <main style={{
          marginTop: '1rem'
        }}>
          {isLoading ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              搜索中...
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((result, index) => (
              <div 
                key={result.topic_id} 
                tabIndex={0}
                onClick={() => navigate(ROUTES.WORD_DETAIL.replace(':word', result.topic_id.toString()))}
                onKeyDown={(e) => e.key === 'Enter' && navigate(ROUTES.WORD_DETAIL.replace(':word', result.topic_id.toString()))}
                style={{
                  padding: '1rem 0',
                  borderBottom: index === searchResults.length - 1 ? 'none' : '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                className="search-result-item"
              >
                <h2 style={{
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  margin: '0 0 0.25rem 0'
                }}>
                  {result.word}
                  {result.accent && (
                    <span style={{
                      fontSize: '0.9rem',
                      color: '#6c757d',
                      fontWeight: 'normal',
                      marginLeft: '0.5rem'
                    }}>
                      {result.accent}
                    </span>
                  )}
                </h2>
                <p style={{
                  margin: 0,
                  color: '#555',
                  fontSize: '0.95rem'
                }}>
                  {result.mean_cn}
                </p>
              </div>
            ))
          ) : searchQuery && !isLoading ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              未找到相关单词
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default Search;