import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { bookService } from '../services/bookService';
import { wordService } from '../services/wordService';
import { CollectModal, AudioIcon } from '../components';
import type { TopicResourceV2, UserBookItem } from '../types';
import { useWordBookStore } from '../stores/wordBookStore';

const WordDetail: React.FC = () => {
  const { word } = useParams<{ word: string }>();
  const [wordData, setWordData] = useState<TopicResourceV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  // 处理收藏图标点击事件
  const handleStarClick = async () => {
    if (!word) return;
    
    // 总是显示收藏模态框
    await loadUserBooks();
    setShowCollectModal(true);
  };

  // 加载用户单词本列表
  const loadUserBooks = async () => {
    await wordService.loadUserBooks(word!, setUserBooks, setSelectedBookId);
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
    
    try {
      await wordService.saveCollectSettings(word, selectedBookId);
      if (wordData) {
        wordData.collected = !wordData.collected;
        setWordData(wordData);
      }
      setShowCollectModal(false);
    } catch (error) {
      // 错误处理已在wordService中完成
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
        data.collected = await useWordBookStore.getState().isCollected(topicId);
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
      <CollectModal 
        showModal={showCollectModal}
        userBooks={userBooks}
        selectedBookId={selectedBookId}
        onToggleBookSelection={toggleBookSelection}
        onCancel={handleCancelCollect}
        onSave={handleSaveCollect}
      />
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
                  color: wordData.collected ? '#007bff' : '#ccc',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
                onClick={handleStarClick}
                title="收藏/取消收藏"
              />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: '#6c757d', marginBottom: '1rem' }}>
            {word_basic_info.accent_uk && <span>英 {word_basic_info.accent_uk}</span>}                      
            {word_basic_info.accent_uk_audio_uri && <AudioIcon src={ word_basic_info.accent_uk_audio_uri } />}

             {word_basic_info.accent_usa && <span>美 {word_basic_info.accent_usa}</span>}
             {word_basic_info.accent_usa_audio_uri && <AudioIcon src={ word_basic_info.accent_usa_audio_uri } />}             
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
        {wordData.dict?.sentences?.length > 0 && (
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
                    {sentence.audio_uri && <AudioIcon src={ sentence.audio_uri } />}
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
                      {sentence.audio_uri && <AudioIcon src={ sentence.audio_uri } />}
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
        {wordData.dict?.synonyms?.length > 0 && (
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