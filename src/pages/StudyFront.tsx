import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeUp, faStar } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import type { MeanInfo, SentenceInfo, ShortPhraseInfo, SynAntInfo, SimilarWord, UserBookItem, SelectBookPlanInfo } from '../types';
import { Study } from '../services/study/Study';
import type {StudyOption} from '../services/study/types';
import { useStudyStore } from '../stores/studyStore';
import { studyService } from '../services/studyService';
import { wordService } from '../services/wordService';
import { CollectModal, AudioIcon } from '../components';
import styles from './StudyFront.module.css';

interface StudyFrontProps {
  // 可以根据需要添加props
}

const StudyFront: React.FC<StudyFrontProps> = () => {
  const [activeTab, setActiveTab] = useState('词组搭配');
  const [study, setStudy] = useState<Study | null>(null);
  const [wordCard, setWordCard] = useState<any | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const { wordList } = useStudyStore();


  // 初始化学习流程
  useEffect(() => {
    const initStudy = async (studyPlans: SelectBookPlanInfo[]) => {
      try {        
        let studyPlan = studyPlans[0];

        if (!studyPlan || !wordList.length) {
          toast.loading('等待学习计划和单词列表加载...');
          return;
        }

        // 获取已学习的单词列表
        const learnedWords = await studyService.getLearnedWords(studyPlan.book_id);
        const learnedTopicIds = new Set(learnedWords.map(word => word.topic_id));
        
        // 从全部单词中筛选出未学习的单词
        const unlearnedWords = wordList.filter(word => !learnedTopicIds.has(word.topic_id)).slice(0, studyPlan.learned_words_count);
        
        if (unlearnedWords.length === 0) {
          toast.success('所有单词都已学习完成！');
          return;
        }
        
        console.log(`共有 ${wordList.length} 个单词，已学习 ${learnedWords.length} 个，待学习 ${unlearnedWords.length} 个`);
        
        const studyInstance = new Study(unlearnedWords);
        await studyInstance.start();
        setStudy(studyInstance);
        setWordCard(studyInstance.getCurrentWord()?.toObject() || null);
      } catch (error) {
        console.error('初始化学习流程失败:', error);
      }
    };
    
    studyService.getBookPlanInfo().then(initStudy);
  }, []);

  const handleOptionClick = async (id: number, isCorrect: boolean) => {  
    if (isCorrect) {
      await study?.pass();      
    } else {
      await study?.fail(id);
    }

    setWordCard(study?.getCurrentWord()?.toObject() || null);
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  const handleNext = async () => {
    await study?.pass();
    setWordCard(study?.getCurrentWord()?.toObject() || null);
  };

  // 检查单词是否已收藏
  const isWordCollected = () => {
    let topicId = wordCard?.word?.word?.dict.word_basic_info.topic_id;    
    return topicId && wordService.getAllWordIds().has(topicId);
  };

  // 处理星标点击
  const handleStarClick = async () => {
    if (!wordCard?.word?.word?.dict.word_basic_info.topic_id) return;
    
    // 总是显示收藏模态框
    await loadUserBooks();
    setShowCollectModal(true);
  };

  // 加载用户单词本列表
  const loadUserBooks = async () => {
    const currentTopicId = wordCard?.word?.word?.dict.word_basic_info.topic_id.toString();
    if (!currentTopicId) return;
    
    await wordService.loadUserBooks(currentTopicId, setUserBooks, setSelectedBookId);
  };

  // 切换单词本选择
  const toggleBookSelection = (bookId: number) => {
    if (selectedBookId === bookId) {
      setSelectedBookId(null); // 取消选择
    } else {
      setSelectedBookId(bookId); // 选择新的单词本
    }
  };

  // 保存收藏设置
  const handleSaveCollect = async () => {
    const currentTopicId = wordCard?.word?.word?.dict.word_basic_info.topic_id.toString();
    if (!currentTopicId) return;
    
    try {
      await wordService.saveCollectSettings(currentTopicId, selectedBookId);
      setShowCollectModal(false);
    } catch (error) {
      // 错误处理已在wordService中完成
    }
  };

  // 取消收藏
  const handleCancelCollect = () => {
    setShowCollectModal(false);
    setSelectedBookId(null);
  };

  // 渲染正面内容
  const renderFrontContent = () => (
    <div className={styles.studyFrontContainer}>
      <header className={styles.header}>
        <span>已学习 0</span>
        <span> / </span>
        <span>需学习 10</span>
      </header>

      <main className={styles.studyFrontCard}>
        <div 
          className={styles.imageContainer}
          style={{
            backgroundImage: `url(https://7n.bczcdn.com${wordCard?.word.word.dict.sentences?.[0]?.img_uri})`
          }}
        ></div>
        {wordCard?.showWord && 
          <h1 className={styles.studyFrontWord}>{wordCard?.word.word.dict.word_basic_info.word}</h1>
        }        
        <div className={styles.pronunciationContainer}>              
          {wordCard?.word.word.dict.word_basic_info.accent_uk &&
             <span className={styles.pronunciationSpan}>英 {wordCard?.word.word.dict.word_basic_info.accent_uk}</span>}          
          {wordCard?.word.word.dict.word_basic_info.accent_uk && 
          <FontAwesomeIcon 
            icon={faVolumeUp} 
            className={styles.volumeIcon}
            onClick={() => {
              const wordBasicInfo = wordCard?.word.word.dict.word_basic_info;
              if (wordBasicInfo?.accent_usa_audio_uri) {
                const audio = new Audio("https://7n.bczcdn.com" + wordBasicInfo.accent_usa_audio_uri);
                audio.play().catch(error => {
                  console.error('音频播放失败:', error);
                });
              }
            }}
            title="播放英式发音"
          />
          }
          {wordCard?.word.word.dict.word_basic_info.accent_uk &&
            <span className={styles.pronunciationSpan}>美 {wordCard?.word.word.dict.word_basic_info.accent_usa}</span>
          }
          {wordCard?.word.word.dict.word_basic_info.accent_uk &&
          <FontAwesomeIcon icon={faVolumeUp} 
            className={styles.volumeIcon}
            onClick={() => {
              const wordBasicInfo = wordCard?.word.word.dict.word_basic_info;
              if (wordBasicInfo?.accent_usa_audio_uri) {
                const audio = new Audio("https://7n.bczcdn.com" + wordBasicInfo.accent_usa_audio_uri);
                audio.play().catch(error => {
                  console.error('音频播放失败:', error);
                });
              }
            }}
            title="播放美式发音"
          />  
          }  
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          margin: '0 0 0.5rem 0'
        }}>
          {wordCard?.showSentence &&
          <p style={{
            fontSize: '1.2rem',
            margin: 0
          }}>{wordCard?.word.word.dict.sentences?.[0]?.sentence}</p>
        }
          {wordCard?.showSentence && wordCard?.word.word.dict.sentences?.[0]?.audio_uri && (
            <FontAwesomeIcon 
              icon={faVolumeUp} 
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                color: 'rgb(65, 84, 98)'
              }}
              onClick={() => {
                const audio = new Audio("https://7n.bczcdn.com" + wordCard?.word.word.dict.sentences?.[0]?.audio_uri);
                audio.play().catch(error => {
                  console.error('音频播放失败:', error);
                });
              }}
              title="播放例句发音"
            />
          )}
        </div>
        {wordCard?.showTranslation && 
        <p style={{
          color: '#6c757d',
          marginBottom: '2rem'
        }}>{wordCard?.word.word.dict.sentences?.[0]?.sentence_trans}</p>
        }
        {wordCard?.showEnglishTranslation && 
        <p style={{ color: '#6c757d' }}>{wordCard?.word.word.dict.en_means?.[0]?.mean}</p>
        }
      </main>

      <footer className={styles.footer}>
        <div className={styles.studyFrontOptions}>
          {(Object.values(wordCard?.options) as StudyOption[]).map((option, index) => (
            <button
              key={index}
              onClick={(e) => {
                (e.currentTarget as HTMLElement).style.border = option.isCorrect ? '2px solid #388e3c' : '2px solid #c62828';
                handleOptionClick(option.id, option.isCorrect);            
              }}
              className={styles.optionButton}
            >
              {wordCard?.options[option.id].showOptionWord && <span>{option.word}<br></br></span>}
              {wordCard?.options[option.id].showOptionTranslation && <span>{option.translation}</span>}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );

  // 渲染背面内容
  const renderBackContent = () => (
    <div className={styles.backContainer}>    
      <section className={`${styles.backCard} ${styles.backWordInfo}`}>
        <div className={styles.backWordHeader}>
          <h1 className={styles.backWordTitle}>{wordCard?.word.word.dict.word_basic_info.word}</h1>
          <FontAwesomeIcon 
            icon={faStar} 
            className={styles.backStarIcon}
            onClick={handleStarClick}
            style={{
              color: isWordCollected() ? '#007bff' : '#d3d3d3',
              cursor: 'pointer'
            }}
            title="收藏/取消收藏"
          />
        </div>
        <div className={styles.backPronunciation}>
          {wordCard?.word.word.dict.word_basic_info.accent_uk && 
          <span>英 { wordCard?.word.word.dict.word_basic_info.accent_uk }</span> }

          {wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri && 
          <AudioIcon src={ wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri } />}

          {wordCard?.word.word.dict.word_basic_info.accent_usa && 
          <span>美 { wordCard?.word.word.dict.word_basic_info.accent_usa }</span> }
          
          {wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri && 
          <AudioIcon src={ wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri } />}
        </div>
        {(() => {
          // 按照 mean_type 对中文释义进行分组
          const chn_means : MeanInfo[] = wordCard?.word.word.dict.chn_means || [];
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
            <p key={meanType} className={styles.backTranslation}>
              <strong>{meanType}</strong> {means.map(mean => mean.mean).join('; ')}
            </p>
          ));
        })()}
      </section>

      {wordCard?.word.word.dict?.sentences?.length && (
         <section className={styles.backCard}>
           <h2 className={styles.backSectionTitle}>图文例句</h2>
           {(() => {
             const sentence: SentenceInfo = wordCard?.word.word.dict.sentences?.[0];
             if (!sentence) return null;
            return (
              <div>
                <div className={styles.backSentenceHeader}>
                  <p className={styles.backSentenceText}>
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
                <p className={styles.backSentenceTranslation}>{sentence.sentence_trans}</p>
                {sentence.img_uri && (
                    <img 
                      src={"https://7n.bczcdn.com" + sentence.img_uri} 
                      alt="例句配图" 
                      className={styles.backSentenceImage}
                    />                    
                )}
              </div>
            );
          })()} 
        </section>
      )}
    
      <section className={styles.backCard}>
        <div className={styles.backTabContainer}>
          {(() => {
             const availableTabs = [];
             const wordData = wordCard?.word.word;
             
             if (wordData?.dict?.short_phrases && wordData.dict.short_phrases.length > 0) {
               availableTabs.push('词组搭配');
             }
             if (wordData?.dict?.variant_info) {
               availableTabs.push('单词变形');
             }
             if (wordData?.dict?.en_means && wordData.dict.en_means.length > 0) {
               availableTabs.push('英文释义');
             }
             if (wordData?.dict?.synonyms && wordData.dict.synonyms.length > 0) {
               availableTabs.push('近义词');
             }
             if (wordData?.similar_words && wordData.similar_words.length > 0) {
               availableTabs.push('形近词');
             }
            
            return availableTabs.map(tab => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`${styles.backTabButton} ${activeTab === tab ? styles.backTabButtonActive : ''}`}
              >
                {tab}
              </button>
            ));
          })()} 
        </div>
        <div className={styles.backTabContent}>
          {(() => {
            const wordData = wordCard?.word.word;
            if (!wordData) return null;
            
            switch (activeTab) {
               case '词组搭配':
                 return (wordData.dict?.short_phrases as ShortPhraseInfo[])?.map((phrase, index) => (
                   <div key={index} className={styles.backPhraseItem}>
                     <p className={styles.backPhraseText}>{phrase.short_phrase}</p>
                     <p className={styles.backPhraseTranslation}>{phrase.short_phrase_trans}</p>
                   </div>
                 ));
               
               case '单词变形':
                 return (() => {
                   const variantInfo = wordData.dict?.variant_info;
                   if (!variantInfo) return null;
                   
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
                   
                   const availableVariants = variantFields.filter(field => 
                     variantInfo[field.key as keyof typeof variantInfo] && 
                     variantInfo[field.key as keyof typeof variantInfo] !== ''
                   );
                   
                   return availableVariants.map((variant, index) => {
                     const word = variantInfo[variant.key as keyof typeof variantInfo] as string;
                     return (
                       <div key={index} className={styles.backVariantItem}>
                         <p className={styles.backVariantText}>{variant.label}: {word}</p>
                       </div>
                     );
                   });
                 })();
               
               case '英文释义':
                 return (wordData.dict?.en_means as MeanInfo[])?.map((meaning, index) => (
                   <div key={index} className={styles.backMeaningItem}>
                     <p className={styles.backMeaningText}>{meaning.mean_type && `[${meaning.mean_type}] `}{meaning.mean}</p>
                   </div>
                 ));
               
               case '近义词':
                 return (wordData.dict?.synonyms as SynAntInfo[])?.map((synonym, index) => (
                   <div key={index} className={styles.backSynonymItem}>
                     <p className={styles.backSynonymText}>{synonym.syn_ant}</p>
                   </div>
                 ));
               
               case '形近词':
                 return (wordData.similar_words as SimilarWord[])?.map((word, index) => (
                   <div key={index} className={styles.backSimilarWordItem}>
                     <p className={styles.backSimilarWordText}>{word.word}</p>
                   </div>
                 ));
              
              default:
                return null;
            }
          })()} 
        </div>
      </section>

      <footer className={styles.backStudyFooter}>
        <button 
          onClick={handleNext}
          className={styles.backNextButton}>下一个</button>
      </footer>
    </div>
  );

  return (
    <div className={styles.container}>
      {wordCard ? (wordCard.showAnswer ? renderBackContent() : renderFrontContent()) : <div>加载中...</div>}
      
      <CollectModal 
        showModal={showCollectModal}
        userBooks={userBooks}
        selectedBookId={selectedBookId}
        onToggleBookSelection={toggleBookSelection}
        onCancel={handleCancelCollect}
        onSave={handleSaveCollect}
      />

      {/* 响应式样式 */}
      <style>{`
        @media (max-width: 600px) {
          .study-front-container {
            padding: 15px !important;
          }
          .study-front-card {
            padding: 1.5rem !important;
          }
          .study-front-word {
            font-size: 2.5rem !important;
          }
          .study-front-options {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default StudyFront;