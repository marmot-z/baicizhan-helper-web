import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { bookService } from '../services/bookService';
import { useWordBookStore } from '../stores/wordBookStore';
import toast from 'react-hot-toast';
import type { UserBookItem, UserBookWordDetail } from '../types';

const WordBook: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeSort, setActiveSort] = useState('时间顺序');
  const [bookTitle, setBookTitle] = useState('收藏的单词');
  const [wordCount, setWordCount] = useState(49);
  const [currentBook, setCurrentBook] = useState<UserBookItem | null>(null);
  const [words, setWords] = useState<UserBookWordDetail[]>([]);
  const [selectedWords, setSelectedWords] = useState<Record<number, string>>({});
  const selectWordsRef = useRef(selectedWords);
  
  const { getWordBook, setWordBook, clearExpiredData } = useWordBookStore();

  const sortOptions = ['时间顺序', '时间逆序', '字母顺序', '字母逆序'];

  useEffect(() => {
    selectWordsRef.current = selectedWords;
  }, [selectedWords]);

  useEffect(() => {
    // 根据单词本ID获取单词本信息
    const fetchBookInfo = async () => {
      if (id) {
        try {
          console.log('当前单词本ID:', id);
          
          // 清理过期数据
          clearExpiredData();
          
          // 首先获取单词本信息，得到最新的单词数量
          const books = await bookService.getBooks();
          const book = books.find(book => book.user_book_id.toString() === id);
          
          if (book) {
            setCurrentBook(book);
            setBookTitle(book.book_name);
            setWordCount(book.word_num);
            
            // 尝试从缓存获取单词数据
            const cachedWords = getWordBook(id);
            
            // 检查缓存的单词数量是否与最新单词数量匹配
            if (cachedWords && cachedWords.length === book.word_num) {
              // 缓存数据有效，使用缓存数据
              console.log('使用缓存的单词数据');
              setWords(cachedWords);
            } else {
              // 缓存数据无效或数量不匹配，从API重新获取单词列表
              console.log('缓存数据过期或数量不匹配，从API获取最新单词数据');
              const wordsData = await bookService.getBookWords(book.user_book_id);
              setWords(wordsData);
              
              // 更新缓存数据
              setWordBook(id, wordsData);
            }
          } else {
            console.error('未找到对应的单词本');
          }
        } catch (error) {
          console.error('获取单词本信息失败:', error);
        }
      }
    };    

    const exportToAnki = () => {
      const injectionElement = document.getElementById('baicizhan-helper-extension-injection');

      if (!injectionElement) {
        toast.error('请先安装并启用「百词斩助手」插件');
        return;
      }

      if (Object.values(selectWordsRef.current).length === 0) {
        toast.error('请先选择要导出的单词');
        return;
      }

      window.postMessage({
        type: 'EXPORT_TO_ANKI_WORDS',
        payload: selectWordsRef.current
      }, '*');
    };

    const btn = document.getElementById('exportBtn');
    btn?.addEventListener('click', exportToAnki);
    fetchBookInfo();

    return () => {
      btn?.removeEventListener('click', exportToAnki);
    };
  }, [id]);

  // 排序逻辑
  const sortedWords = React.useMemo(() => {
    const wordsCopy = [...words];
    
    switch (activeSort) {
      case '时间顺序':
        return wordsCopy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case '时间逆序':
        return wordsCopy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case '字母顺序':
        return wordsCopy.sort((a, b) => a.word.localeCompare(b.word));
      case '字母逆序':
        return wordsCopy.sort((a, b) => b.word.localeCompare(a.word));
      default:
        return wordsCopy;
    }
  }, [words, activeSort]);

  function selectAllWords(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;

    if (!checked) {
      setSelectedWords({});
      return;
    }

    const allSelected = sortedWords.reduce((acc, word) => {
      acc[word.topic_id] = word.word;
      return acc;
    }, {} as Record<number, string>);
    setSelectedWords(allSelected);
  }

  function selectWord(e: React.ChangeEvent<HTMLInputElement>) {
    const { value, checked } = e.target;
    const topicId = Number(value);

    if (checked) {
      setSelectedWords(prev => ({
        ...prev,
        [topicId]: sortedWords.find(word => word.topic_id === topicId)?.word || ''
      }));
    } else {
      setSelectedWords(prev => {
        const { [topicId]: _, ...rest } = prev;
        return rest;
      });
    }
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      margin: 0,
      lineHeight: 1.6,
      backgroundColor: '#f8f9fa',
      color: '#333',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px'
      }}>
        {/* Wordbook Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          backgroundColor: '#fff',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          {currentBook?.cover ? (
            <img 
              src={currentBook.cover} 
              alt={currentBook.book_name}
              style={{
                width: '100px',
                borderRadius: '8px',
                flexShrink: 0,
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{
              width: '100px',
              height: '125px',
              backgroundColor: '#e9ecef',
              borderRadius: '8px',
              flexShrink: 0
            }}></div>
          )}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '125px'
          }}>
            <h1 style={{
              fontSize: '1.5rem',
              margin: 0
            }}>{bookTitle}</h1>
            <p style={{
              margin: 0,
              color: '#6c757d'
            }}>单词数：{wordCount}</p>
            <div style={{
              display: 'flex',
              gap: '5px',
              alignSelf: 'flex-start'
            }}>
              <button disabled style={{
                backgroundColor: '#007bff',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'not-allowed',
                fontWeight: 'bold',
                borderRadius: '5px',
                opacity: 0.5
              }}>学习</button>
            </div>
          </div>
        </header>

        {/* Sort Options */}
        <nav style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          {sortOptions.map((option) => (
            <button
              key={option}
              onClick={() => setActiveSort(option)}
              style={{
                backgroundColor: activeSort === option ? '#007bff' : '#e9ecef',
                color: activeSort === option ? '#fff' : '#333',
                border: `1px solid ${activeSort === option ? '#007bff' : '#ced4da'}`,
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {option}
            </button>
          ))}
        </nav>

        {/* Word List */}
        <main style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e7e7e7',
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              type="checkbox"
              // checked={sortedWords.length > 0 && Object.keys(selectedWords).length === sortedWords.length}
              onChange={selectAllWords}
              style={{
                marginRight: '1rem',
                width: '18px',
                height: '18px'
              }}
            />
            <span style={{ fontWeight: 'bold' }}>全选/全不选</span>

            <button id="exportBtn" style={{
                backgroundColor: '#007bff',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '5px',
                marginLeft: '10px'
              }}>导出</button>
          </div>
          {sortedWords.map((wordItem, index) => (
            <div
              key={wordItem.topic_id}
              style={{
                padding: '1.5rem',
                borderBottom: index === sortedWords.length - 1 ? 'none' : '1px solid #e7e7e7',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <input
                type="checkbox"
                checked={!!selectedWords[wordItem.topic_id]}
                value={wordItem.topic_id}
                onChange={selectWord}
                style={{
                  marginRight: '1rem',
                  width: '18px',
                  height: '18px'
                }}
              />
              <div style={{
                flex: 1
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <h2 style={{
                    fontSize: '1.5rem',
                    margin: 0
                  }}>{wordItem.word}</h2>
                  <FontAwesomeIcon 
                    icon={faVolumeUp} 
                    style={{
                      width: '20px',
                      height: '20px',
                      color: '#6c757d',
                      flexShrink: 0,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      if (wordItem.audio_uk) {
                        const audio = new Audio(wordItem.audio_uk);
                        audio.play().catch(error => {
                          console.error('音频播放失败:', error);
                        });
                      }
                    }}
                  />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <p style={{
                    margin: 0,
                    color: '#6c757d',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flexGrow: 1,
                    marginRight: '1rem'
                  }}>{wordItem.mean.substring(0, 40)}</p>
                  <a
                    href="#"
                    style={{
                      color: '#007bff',
                      textDecoration: 'none',
                      flexShrink: 0,
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/page/word-detail/${wordItem.topic_id}`);
                    }}
                  >
                    详情 &gt;
                  </a>
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default WordBook;