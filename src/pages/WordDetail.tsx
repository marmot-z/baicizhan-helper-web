import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { bookService } from '../services/bookService';
import { wordService } from '../services/wordService';
import { CollectModal, AudioIcon } from '../components';
import type { TopicResourceV2, UserBookItem } from '../types';
import { useWordBookStore } from '../stores/wordBookStore';
import styles from './WordDetail.module.css';

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
      const success = await wordService.saveCollectSettings(word, selectedBookId);
      if (success && wordData) {
        wordData.collected = await useWordBookStore.getState().isCollected(wordData.dict.word_basic_info.topic_id);

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
      <div className={`min-h-screen flex items-center justify-center ${styles.loadingWrapper}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !wordData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${styles.errorWrapper}`}>
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
  
  return (
    <div className={`min-h-screen ${styles.containerWrapper}`}>
      <CollectModal 
        showModal={showCollectModal}
        userBooks={userBooks}
        selectedBookId={selectedBookId}
        onToggleBookSelection={toggleBookSelection}
        onCancel={handleCancelCollect}
        onSave={handleSaveCollect}
      />
      <div className={styles.container}>
        {/* 单词信息 */}
        <section className={styles.card}>
          <div className={styles.headerRow}>
            <h1 className={styles.wordTitle}>{word_basic_info.word}</h1>
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
          <div className={styles.accentRow}>
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
              <p key={meanType} className={styles.paragraphCompact}>
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
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>单词变形</h2>
              <div className={styles.variantContainer}>
                {/* 垂直线 */}
                <div className={styles.variantVerticalLine}></div>
                
                {/* 基础词形 */}
                <div className={styles.baseWordRow}>
                  <span className={styles.baseWordText}>
                    {/* 蓝色圆点 */}
                    <span className={styles.blueDot}></span>
                    {wordData.dict.word_basic_info.word}
                  </span>
                </div>
                
                {/* 动态渲染变形 */}
                {availableVariants.map((variant) => {
                  const word = variantInfo[variant.key as keyof typeof variantInfo] as string;
                  const topicId = variantInfo[`${variant.key}_topic_id` as keyof typeof variantInfo] as number;
                  
                  return (
                    <div key={variant.key} className={styles.variantRow}>
                      {/* 水平线 */}
                      <span className={styles.variantHorizontalLine}></span>
                      <span className={styles.variantLabel}>{variant.label}</span>
                      {topicId ? (
                        <a href={`/page/word-detail/${topicId}`} className={styles.variantLink}>
                          {word}
                        </a>
                      ) : (
                        <span className={styles.variantText}>{word}</span>
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
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>图文例句</h2>
            {(() => {
              const sentence = wordData.dict.sentences[0];
              return (
                <div>
                  <div className={styles.sentenceRow}>
                    <p className={styles.sentenceText}>
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
                  <p className={styles.sentenceTrans}>{sentence.sentence_trans}</p>
                  {sentence.img_uri && (
                      <img 
                        src={"https://7n.bczcdn.com" + sentence.img_uri} 
                        alt="例句配图" 
                        className={styles.sentenceImg}
                      />                    
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* 详细释义 */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>详细释义</h2>
          {wordData.dict.chn_means.map((meaning, index) => {
            // 获取除第一个元素外的例句，并筛选出匹配当前释义的例句
            const matchingSentences = wordData.dict.sentences.slice(1).filter(sentence => sentence.chn_mean_id === meaning.id);
            const isLastItem = index === wordData.dict.chn_means.length - 1;
            
            return (
              <div key={meaning.id} className={isLastItem ? styles.meaningItemLast : styles.meaningItem}>
                <p className={styles.meaningText}>
                  {meaning.mean_type && <strong>{meaning.mean_type}</strong>} {meaning.mean}
                </p>
                {matchingSentences.map((sentence, sentenceIndex) => (
                  <div key={sentence.id} style={{ marginBottom: sentenceIndex < matchingSentences.length - 1 ? '1rem' : '0' }}>
                    <div className={styles.sentenceRow}>
                      <p className={styles.sentenceText}>
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
                    <p className={styles.sentenceTrans}>{sentence.sentence_trans}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        {/* 短语 */}
        {wordData.dict.short_phrases && wordData.dict.short_phrases.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>短语</h2>
            <div>
              {wordData.dict.short_phrases.map((phrase, index) => (
                <div key={phrase.id || index} className={index < wordData.dict.short_phrases.length - 1 ? styles.phraseItem : styles.phraseItemLast}>
                  <p className={styles.noMargin}>{phrase.short_phrase}</p>
                  <p className={styles.phraseTrans}>{phrase.short_phrase_trans}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 近义词 */}
        {wordData.dict?.synonyms?.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>近义词</h2>
            <div className={styles.synonymsContainer}>
              {wordData.dict.synonyms.map((synonym, index) => (
                <a key={synonym.syn_ant_id || index} href={`/page/word-detail/${synonym.syn_ant_topic_id}`} className={styles.synonymLink}>
                  {synonym.syn_ant}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 形近词 */}
        {wordData.similar_words && wordData.similar_words.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>形近词</h2>
            <div className={styles.synonymsContainer}>
              {wordData.similar_words.map((similarWord, index) => (
                <a key={similarWord.topic_id || index} href={`/page/word-detail/${similarWord.topic_id}`} className={styles.synonymLink}>
                  {similarWord.word}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 词根词缀 */}
        {wordData.dict.word_basic_info.etyma && wordData.dict.word_basic_info.etyma.trim() !== '' && (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>词根词缀</h2>
            <p className={styles.noMargin}>{wordData.dict.word_basic_info.etyma}</p>
          </section>
        )}

        {/* 英文释义 */}
        {wordData.dict.en_means && wordData.dict.en_means.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>英文释义</h2>
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
                  <div key={meanType} className={styles.enMeanGroup}>
                    <p className={styles.enMeanType}>{meanType}</p>
                    <ol className={styles.enMeanList}>
                      {means.map((mean, index) => (
                        <li key={mean.id || index} className={styles.enMeanItem}>
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
