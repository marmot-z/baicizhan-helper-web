import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookService } from '../services/bookService';
import type { SearchWordResultV2 } from '../types';
import { ROUTES } from '../constants';
import styles from './Search.module.css';

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
    <div className={styles.pageContainer}>
      <div className={styles.wrapper}>
        {/* Search Header */}
        <header className={styles.header}>
          <div className={styles.searchBar}>            
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入需要查询的单词"
              className={styles.searchInput}
            />
            <FontAwesomeIcon 
              icon={faMagnifyingGlass} 
              onClick={handleSearch}
              className={styles.searchIcon}
            />
          </div>
        </header>

        {/* Search Results */}
        <main className={styles.main}>
          {isLoading ? (
            <div className={styles.loadingMessage}>
              搜索中...
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((result, index) => (
              <div 
                key={result.topic_id} 
                tabIndex={0}
                onClick={() => navigate(ROUTES.WORD_DETAIL.replace(':word', result.topic_id.toString()))}
                onKeyDown={(e) => e.key === 'Enter' && navigate(ROUTES.WORD_DETAIL.replace(':word', result.topic_id.toString()))}
                className={`${styles.resultItem} ${index === searchResults.length - 1 ? styles.resultItemLast : ''} search-result-item`}
              >
                <h2 className={styles.title}>
                  {result.word}
                  {result.accent && (
                    <span className={styles.accent}>
                      {result.accent}
                    </span>
                  )}
                </h2>
                <p className={styles.meaning}>
                  {result.mean_cn}
                </p>
              </div>
            ))
          ) : searchQuery && !isLoading ? (
            <div className={styles.loadingMessage}>
              未找到相关单词
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default Search;
