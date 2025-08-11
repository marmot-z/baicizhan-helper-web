import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bookService } from '../services/bookService';
import type { UserBookItem } from '../types';

const WordBook: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeSort, setActiveSort] = useState('时间顺序');
  const [bookTitle, setBookTitle] = useState('收藏的单词');
  const [wordCount, setWordCount] = useState(49);
  const [currentBook, setCurrentBook] = useState<UserBookItem | null>(null);

  const sortOptions = ['时间顺序', '时间逆序', '字母顺序', '字母逆序'];

  useEffect(() => {
    // 根据单词本ID获取单词本信息
    const fetchBookInfo = async () => {
      if (id) {
        try {
          console.log('当前单词本ID:', id);
          const books = await bookService.getBooks();
          const book = books.find(book => book.user_book_id.toString() === id);
          
          if (book) {
            setCurrentBook(book);
            setBookTitle(book.book_name);
            setWordCount(book.word_num);
          } else {
            console.error('未找到对应的单词本');
          }
        } catch (error) {
          console.error('获取单词本信息失败:', error);
        }
      }
    };
    
    fetchBookInfo();
  }, [id]);

  const words = [
    {
      id: 1,
      word: 'drove',
      translation: '（drive 的过去式），开车，驱赶，迫使，畜群，人群'
    },
    {
      id: 2,
      word: 'pave',
      translation: '铺设'
    },
    {
      id: 3,
      word: 'circuit',
      translation: '电路；环路'
    }
  ];

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
            }}>{currentBook?.book_name}</h1>
            <p style={{
              margin: 0,
              color: '#6c757d'
            }}>单词数：{currentBook?.word_num}</p>
            <div style={{
              display: 'flex',
              gap: '5px',
              alignSelf: 'flex-start'
            }}>
              <button style={{
                backgroundColor: '#007bff',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '5px'
              }}>学习</button>
              <button style={{
                backgroundColor: '#007bff',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '5px'
              }}>导出PDF</button>
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
          {words.map((wordItem, index) => (
            <div
              key={wordItem.id}
              style={{
                padding: '1.5rem',
                borderBottom: index === words.length - 1 ? 'none' : '1px solid #e7e7e7'
              }}
            >
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
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#e9ecef',
                  flexShrink: 0
                }}></div>
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
                }}>{wordItem.translation}</p>
                <a
                  href="#"
                  style={{
                    color: '#007bff',
                    textDecoration: 'none',
                    flexShrink: 0
                  }}
                  onClick={(e) => e.preventDefault()}
                >
                  详情 &gt;
                </a>
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default WordBook;