import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeUp, faStar, faBookBookmark } from '@fortawesome/free-solid-svg-icons';
import { bookService } from '../services/bookService';
import { useWordBookStore } from '../stores/wordBookStore';
import type { TopicResourceV2, UserBookItem } from '../types';

const WordDetail: React.FC = () => {
  const { word } = useParams<{ word: string }>();
  const [wordData, setWordData] = useState<TopicResourceV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const { wordBooks, setWordBook } = useWordBookStore();
  
  // 获取所有单词本中的单词ID
  const getAllWordIds = () => {
    const allWordIds = new Set<number>();
    Object.values(wordBooks).forEach(bookData => {
      bookData.words.forEach(wordItem => {
        allWordIds.add(wordItem.topic_id);
      });
    });
    return allWordIds;
  };
  
  // 检查当前单词是否已收藏
  const isWordCollected = () => {
    if (!word) return false;
    const currentTopicId = parseInt(word);
    const allWordIds = getAllWordIds();
    return allWordIds.has(currentTopicId);
  };
  
  // 处理收藏图标点击事件
  const handleStarClick = async () => {
    if (!word) return;
    
    // 总是显示收藏模态框
    await loadUserBooks();
    setShowCollectModal(true);
  };

  // 加载用户单词本列表
  const loadUserBooks = async () => {
    try {
      const books = await bookService.getBooks();
      setUserBooks(books);
      
      // 检查当前单词已经在哪些单词本中
      const currentTopicId = parseInt(word!);
      let currentBookId: number | null = null;
      
      for (const book of books) {
        const cachedWords = wordBooks[book.user_book_id.toString()]?.words;
        if (cachedWords && cachedWords.some(w => w.topic_id === currentTopicId)) {
          currentBookId = book.user_book_id;
          break; // 只能在一个单词本中
        }
      }
      
      setSelectedBookId(currentBookId);
    } catch (error) {
      console.error('加载单词本列表失败:', error);
      toast.error('加载单词本列表失败');
    }
  };

  // 切换单词本选择状态
  const toggleBookSelection = (bookId: number) => {
    if (selectedBookId === bookId) {
      setSelectedBookId(null); // 取消选择
    } else {
      setSelectedBookId(bookId); // 选择新的单词本
    }
  };

  // 保存收藏设置
  const handleSaveCollect = async () => {
    if (!word) return;
    
    const currentTopicId = parseInt(word);
    
    try {
      if (selectedBookId === null) {
        // 没有选中任何单词本，取消收藏
        const success = await bookService.cancelCollectWord(0, currentTopicId);
        if (success) {
          // 更新本地缓存，移除该单词
          for (const [bookIdStr, bookData] of Object.entries(wordBooks)) {
            if (bookData.words.some(wordItem => wordItem.topic_id === currentTopicId)) {
              const updatedWords = bookData.words.filter(wordItem => wordItem.topic_id !== currentTopicId);
              setWordBook(bookIdStr, updatedWords);
            }
          }
          toast.success('取消收藏成功');
        } else {
          toast.error('取消收藏失败');
        }
      } else {
        // 有选中的单词本，进行收藏
        const success = await bookService.collectWord(selectedBookId, currentTopicId);
        if (success) {
          // 更新本地缓存：先从所有单词本中移除当前单词
          for (const [bookIdStr, bookData] of Object.entries(wordBooks)) {
            if (bookData.words.some(wordItem => wordItem.topic_id === currentTopicId)) {
              const updatedWords = bookData.words.filter(wordItem => wordItem.topic_id !== currentTopicId);
              setWordBook(bookIdStr, updatedWords);
            }
          }
          
          // 然后添加到选中的单词本中
          const selectedBookIdStr = selectedBookId.toString();
          const selectedBookWords = wordBooks[selectedBookIdStr]?.words || [];
          if (!selectedBookWords.some(w => w.topic_id === currentTopicId)) {
            // 需要重新获取单词列表以确保数据一致性
            const updatedWords = await bookService.getBookWords(selectedBookId);
            setWordBook(selectedBookIdStr, updatedWords);
          }
          
          toast.success('收藏成功');
        } else {
          toast.error('收藏失败');
        }
      }
      
      setShowCollectModal(false);
    } catch (error) {
      console.error('保存收藏设置失败:', error);
      toast.error('保存失败');
    }
  };

  // 取消收藏设置
  const handleCancelCollect = () => {
    setShowCollectModal(false);
  };

  useEffect(() => {
    const fetchWordDetail = async () => {
      if (!word) return;
      
      try {
        setLoading(true);
        const topicId = parseInt(word);
        const data = await bookService.getWordDetail(topicId, true, false, true);
        setWordData(data);
      } catch (err) {
        setError('获取单词详情失败');
        console.error('Error fetching word detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWordDetail();
  }, [word]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !wordData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || '单词数据不存在'}</p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const { dict } = wordData;
  const { word_basic_info, chn_means } = dict;
  
  // 收藏模态框组件
  const CollectModal = () => {
    if (!showCollectModal) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          padding: '20px',
          margin: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              textAlign: 'center',
              marginTop: 0,
              color: '#6c757d'
            }}>将单词添加到</h2>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {userBooks.map((book, index) => (
                <li key={book.user_book_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 0',
                  borderBottom: index === userBooks.length - 1 ? 'none' : '1px solid #e7e7e7',
                  cursor: 'pointer'
                }} onClick={() => toggleBookSelection(book.user_book_id)}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <FontAwesomeIcon 
                          icon={faBookBookmark} 
                          style={{
                            fontSize: '20px',
                            color: '#000'
                          }}
                        />
                    <span style={{
                      fontSize: '1.1rem',
                      fontWeight: '500'
                    }}>{book.book_name}</span>
                  </div>
                  <FontAwesomeIcon 
                    icon={faStar} 
                    style={{
                      fontSize: '1.2rem',
                      color: selectedBookId === book.user_book_id ? '#007bff' : '#d3d3d3'
                    }}
                  />
                </li>
              ))}
            </ul>

            <div style={{
            display: 'flex',
            gap: '1rem'
          }}>
            <button onClick={handleCancelCollect} style={{
              flex: 1,
              padding: '0.8rem 1rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: '#e9ecef',
              color: '#333'
            }}>取消</button>
            <button onClick={handleSaveCollect} style={{
              flex: 1,
              padding: '0.8rem 1rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: '#007bff',
              color: '#fff'
            }}>保存</button>
          </div>
          </div>
          
        </div>
      </div>
    );
  };

  // 响应式样式
  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: window.innerWidth <= 600 ? '10px' : '20px'
  };
  
  const cardStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: window.innerWidth <= 600 ? '1rem' : '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '1px solid #e0e0e0'
  };
  
  const h1Style = {
    fontSize: window.innerWidth <= 600 ? '2rem' : '2.5rem',
    margin: '0',
    fontWeight: 'normal'
  };
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <CollectModal />
      <div className="mx-auto" style={containerStyle}>
        {/* 单词信息 */}
        <section className="bg-white" style={cardStyle}>
          <div className="flex justify-between items-center mb-2">
            <h1 style={h1Style}>{word_basic_info.word}</h1>
            <FontAwesomeIcon 
                icon={faStar} 
                style={{
                  width: '20px',
                  height: '20px',
                  color: isWordCollected() ? '#007bff' : '#ccc',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
                onClick={handleStarClick}
                title="收藏/取消收藏"
              />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: '#6c757d', marginBottom: '1rem' }}>
            {word_basic_info.accent_uk && <span>英 {word_basic_info.accent_uk}</span>}                      
            {word_basic_info.accent_uk_audio_uri && (
               <FontAwesomeIcon 
                 icon={faVolumeUp} 
                 style={{
                   width: '20px',
                   height: '20px',
                   flexShrink: 0,
                   cursor: 'pointer'
                 }}
                 onClick={() => {
                   const audio = new Audio("https://7n.bczcdn.com" + word_basic_info.accent_uk_audio_uri);
                   audio.play().catch(error => {
                     console.error('音频播放失败:', error);
                   });
                 }}
                 title="播放英式发音"
               />
             )}
             {word_basic_info.accent_usa && <span>美 {word_basic_info.accent_usa}</span>}
             {word_basic_info.accent_usa_audio_uri && (
               <FontAwesomeIcon 
                 icon={faVolumeUp} 
                 style={{
                   width: '20px',
                   height: '20px',
                   flexShrink: 0,
                   cursor: 'pointer'
                 }}
                 onClick={() => {
                   const audio = new Audio("https://7n.bczcdn.com" + word_basic_info.accent_usa_audio_uri);
                   audio.play().catch(error => {
                     console.error('音频播放失败:', error);
                   });
                 }}
                 title="播放美式发音"
               />
             )}
          </div>
          {(() => {
            // 按照 mean_type 对中文释义进行分组
            const groupedMeans = chn_means.reduce((groups, mean) => {
              const type = mean.mean_type || '其他';
              if (!groups[type]) {
                groups[type] = [];
              }
              groups[type].push(mean);
              return groups;
            }, {} as Record<string, typeof chn_means>);

            // 按分组展示释义
            return Object.entries(groupedMeans).map(([meanType, means]) => (
              <p key={meanType} style={{ margin: '0.25rem 0' }}>
                <strong>{meanType}</strong> {means.map(mean => mean.mean).join('; ')}
              </p>
            ));
          })()}
        </section>

        {/* 单词变形 */}
        {(() => {
          const variantInfo = wordData.dict.variant_info;
          
          // 检查 variantInfo 是否存在
          if (!variantInfo) {
            return null;
          }
          
          const variantFields = [
            { key: 'noun', label: '名词' },
            { key: 'verb', label: '动词' },
            { key: 'adj', label: '形容词' },
            { key: 'pl', label: '复数' },
            { key: 'adv', label: '副词' },
            { key: 'ing', label: '现在分词' },
            { key: 'done', label: '过去分词' },
            { key: 'past', label: '过去式' },
            { key: 'third', label: '第三人称单数' },
            { key: 'er', label: '比较级' },
            { key: 'est', label: '最高级' },
            { key: 'prep', label: '介词' },
            { key: 'conn', label: '连词' }
          ];
          
          // 过滤出有值的变形
          const availableVariants = variantFields.filter(field => 
            variantInfo[field.key as keyof typeof variantInfo] && 
            variantInfo[field.key as keyof typeof variantInfo] !== ''
          );
          
          if (availableVariants.length === 0) {
            return null;
          }
          
          return (
            <section className="bg-white" style={cardStyle}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>单词变形</h2>
              <div style={{
                position: 'relative',
                paddingLeft: '20px'
              }}>
                {/* 垂直线 */}
                <div style={{
                  content: '',
                  position: 'absolute',
                  left: '5px',
                  top: '10px',
                  bottom: '10px',
                  width: '1px',
                  backgroundColor: '#e0e0e0'
                }}></div>
                
                {/* 基础词形 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px',
                  position: 'relative',
                  marginLeft: '0px'
                }}>
                  <span style={{
                    fontWeight: 'bold',
                    position: 'relative'
                  }}>
                    {/* 蓝色圆点 */}
                    <span style={{
                      content: '',
                      position: 'absolute',
                      left: '-18px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#4a90e2',
                      borderRadius: '50%',
                      display: 'block'
                    }}></span>
                    {wordData.dict.word_basic_info.word}
                  </span>
                </div>
                
                {/* 动态渲染变形 */}
                {availableVariants.map((variant) => {
                  const word = variantInfo[variant.key as keyof typeof variantInfo] as string;
                  const topicId = variantInfo[`${variant.key}_topic_id` as keyof typeof variantInfo] as number;
                  
                  return (
                    <div key={variant.key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '10px',
                      position: 'relative'
                    }}>
                      {/* 水平线 */}
                      <span style={{
                        content: '',
                        position: 'absolute',
                        left: '-15px',
                        top: '50%',
                        width: '10px',
                        height: '1px',
                        backgroundColor: '#e0e0e0',
                        display: 'block'
                      }}></span>
                      <span style={{ color: '#888', marginRight: '10px' }}>{variant.label}</span>
                      {topicId ? (
                        <a href={`/page/word-detail/${topicId}`} style={{ 
                          fontSize: '1.1em', 
                          textDecoration: 'none', 
                          color: '#007bff' 
                        }}>
                          {word}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 'bold' }}>{word}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* 图文例句 */}
        {wordData.dict.sentences.length > 0 && (
          <section className="bg-white" style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>图文例句</h2>
            {(() => {
              const sentence = wordData.dict.sentences[0];
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem' }}>
                    <p style={{ margin: '0' }}>
                      {sentence.highlight_phrase ? (
                        sentence.sentence.split(sentence.highlight_phrase).map((part, i) => (
                          i === 0 ? (
                            <span key={i}>{part}<strong>{sentence.highlight_phrase}</strong></span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        ))
                      ) : (
                        sentence.sentence
                      )}
                    </p>
                    {sentence.audio_uri && (
                      <FontAwesomeIcon 
                        icon={faVolumeUp} 
                        style={{
                          width: '20px',
                          height: '20px',
                          flexShrink: 0,
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          const audio = new Audio("https://7n.bczcdn.com" + sentence.audio_uri);
                          audio.play().catch(error => {
                            console.error('音频播放失败:', error);
                          });
                        }}
                        title="播放例句发音"
                      />
                    )}
                  </div>
                  <p style={{ margin: '0.25rem 0' }}>{sentence.sentence_trans}</p>
                  {sentence.img_uri && (
                      <img 
                        src={"https://7n.bczcdn.com" + sentence.img_uri} 
                        alt="例句配图" 
                        style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }}
                      />                    
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* 详细释义 */}
        <section className="bg-white" style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>详细释义</h2>
          {wordData.dict.chn_means.map((meaning, index) => {
            // 获取除第一个元素外的例句，并筛选出匹配当前释义的例句
            const matchingSentences = wordData.dict.sentences.slice(1).filter(sentence => sentence.chn_mean_id === meaning.id);
            const isLastItem = index === wordData.dict.chn_means.length - 1;
            
            return (
              <div key={meaning.id} style={{ 
                marginBottom: isLastItem ? '0' : '1rem', 
                paddingBottom: isLastItem ? '0' : '1rem', 
                borderBottom: isLastItem ? 'none' : '1px solid #e7e7e7' 
              }}>
                <p style={{ fontSize: '1rem', color: '#333', margin: '0 0 0.5rem 0' }}>
                  {meaning.mean_type && <strong>{meaning.mean_type}</strong>} {meaning.mean}
                </p>
                {matchingSentences.map((sentence, sentenceIndex) => (
                  <div key={sentence.id} style={{ marginBottom: sentenceIndex < matchingSentences.length - 1 ? '1rem' : '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem' }}>
                      <p style={{ margin: '0' }}>
                        {sentence.highlight_phrase ? (
                          sentence.sentence.split(sentence.highlight_phrase).map((part, i) => (
                            i === 0 ? (
                              <span key={i}>{part}<strong>{sentence.highlight_phrase}</strong></span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          ))
                        ) : (
                          sentence.sentence
                        )}
                      </p>
                      {sentence.audio_uri && (
                        <FontAwesomeIcon 
                          icon={faVolumeUp} 
                          style={{
                            width: '20px',
                            height: '20px',
                            flexShrink: 0,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            const audio = new Audio("https://7n.bczcdn.com" + sentence.audio_uri);
                            audio.play().catch(error => {
                              console.error('音频播放失败:', error);
                            });
                          }}
                          title="播放例句发音"
                        />
                      )}
                    </div>
                    <p style={{ margin: '0.25rem 0' }}>{sentence.sentence_trans}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        {/* 短语 */}
        {wordData.dict.short_phrases && wordData.dict.short_phrases.length > 0 && (
          <section className="bg-white" style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>短语</h2>
            <div>
              {wordData.dict.short_phrases.map((phrase, index) => (
                <div key={phrase.id || index} style={{ fontSize: '1.1rem', marginBottom: index < wordData.dict.short_phrases.length - 1 ? '1rem' : '0' }}>
                  <p style={{ margin: '0' }}>{phrase.short_phrase}</p>
                  <p style={{ margin: '0.25rem 0', color: '#666' }}>{phrase.short_phrase_trans}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 近义词 */}
        {wordData.dict.synonyms.length > 0 && (
          <section className="bg-white" style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>近义词</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {wordData.dict.synonyms.map((synonym, index) => (
                <a key={synonym.syn_ant_id || index} href={`/page/word-detail/${synonym.syn_ant_topic_id}`} style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>
                  {synonym.syn_ant}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 形近词 */}
        {wordData.similar_words && wordData.similar_words.length > 0 && (
          <section className="bg-white" style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>形近词</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {wordData.similar_words.map((similarWord, index) => (
                <a key={similarWord.topic_id || index} href={`/page/word-detail/${similarWord.topic_id}`} style={{ textDecoration: 'none', color: '#007bff', fontSize: '1.1rem' }}>
                  {similarWord.word}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 词根词缀 */}
        {wordData.dict.word_basic_info.etyma && wordData.dict.word_basic_info.etyma.trim() !== '' && (
          <section className="bg-white" style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>词根词缀</h2>
            <p style={{ margin: '0' }}>{wordData.dict.word_basic_info.etyma}</p>
          </section>
        )}

        {/* 英文释义 */}
        {wordData.dict.en_means && wordData.dict.en_means.length > 0 && (
          <section className="bg-white" style={cardStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0', marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>英文释义</h2>
            <div>
              {(() => {
                // 按照 mean_type 对英文释义进行分组
                const groupedMeans = wordData.dict.en_means.reduce((groups, mean) => {
                  const type = mean.mean_type || 'other';
                  if (!groups[type]) {
                    groups[type] = [];
                  }
                  groups[type].push(mean);
                  return groups;
                }, {} as Record<string, typeof wordData.dict.en_means>);

                // 按分组展示释义
                return Object.entries(groupedMeans).map(([meanType, means]) => (
                  <div key={meanType} style={{ marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>{meanType}</p>
                    <ol style={{ paddingLeft: '1.5rem', margin: '0' }}>
                      {means.map((mean, index) => (
                        <li key={mean.id || index} style={{ marginBottom: '0.5rem' }}>
                          {mean.mean}
                        </li>
                      ))}
                    </ol>
                  </div>
                ));
              })()}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default WordDetail;