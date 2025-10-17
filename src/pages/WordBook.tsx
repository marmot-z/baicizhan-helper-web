import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookService } from '../services/bookService';
import { useWordBookStore } from '../stores/wordBookStore';
import { AudioIcon } from '../components';
import toast from 'react-hot-toast';
import type { UserBookItem, UserBookWordDetail } from '../types';
import ExtensionsDownloadModel from '../components/ExtensionsDownloadModel';
import styles from './WordBook.module.css';

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
  const [downloadModelShow, setDownloadModelShow] = useState(false);
  
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
        setDownloadModelShow(true);
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

  function toggleDownloadModelShow() {
    setDownloadModelShow(false);
  }

  return (
    <div>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          {/* Wordbook Header */}
          <header className={styles.header}>
            {currentBook?.cover ? (
              <img 
                src={currentBook.cover} 
                alt={currentBook.book_name}
                className={styles.bookCover}
              />
            ) : (
              <div className={styles.coverPlaceholder}></div>
            )}
            <div className={styles.bookInfo}>
              <h1 className={styles.bookTitle}>{bookTitle}</h1>
              <p className={styles.bookCount}>单词数：{wordCount}</p>
              <div className={styles.buttonGroup}>
                <button disabled className={styles.disabledButton}>学习</button>
              </div>
            </div>
          </header>

          {/* Sort Options */}
          <nav className={styles.sortNav}>
            {sortOptions.map((option) => (
              <button
                key={option}
                onClick={() => setActiveSort(option)}
                className={`${styles.sortButton} ${activeSort === option ? styles.sortButtonActive : styles.sortButtonInactive}`}
              >
                {option}
              </button>
            ))}
          </nav>

          {/* Word List */}
          <main className={styles.wordList}>
            <div className={styles.listHeader}>
              <input
                type="checkbox"
                onChange={selectAllWords}
                className={styles.checkbox}
              />
              <span className={styles.boldText}>全选/全不选</span>

              <button id="exportBtn" className={styles.exportButton}>导出</button>
            </div>
            {sortedWords.map((wordItem, index) => (
              <div
                key={wordItem.topic_id}
                className={`${styles.wordItem} ${index !== sortedWords.length - 1 ? styles.wordItemWithBorder : ''}`}
              >
                <input
                  type="checkbox"
                  checked={!!selectedWords[wordItem.topic_id]}
                  value={wordItem.topic_id}
                  onChange={selectWord}
                  className={styles.checkbox}
                />
                <div className={styles.wordContent}>
                  <div className={styles.wordHeader}>
                    <h2 className={styles.word}>{wordItem.word}</h2>
                    <AudioIcon src={wordItem.audio_uk} />                  
                  </div>
                  <div className={styles.wordFooter}>
                    <p className={styles.wordMeaning}>{wordItem.mean.substring(0, 40)}</p>
                    <a
                      href="#"
                      className={styles.detailLink}
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
      <ExtensionsDownloadModel showModal={downloadModelShow} onClose={toggleDownloadModelShow} />    
    </div>
  );
};

export default WordBook;