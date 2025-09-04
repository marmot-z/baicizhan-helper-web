import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeUp, faStar } from '@fortawesome/free-solid-svg-icons';
import type { UserRoadMapElementV2, MeanInfo, SentenceInfo, ShortPhraseInfo, SynAntInfo, SimilarWord } from '../types';
import { Study } from '../services/study/Study';
import type {StudyOption} from '../services/study/types'

interface StudyFrontProps {
  // 可以根据需要添加props
}

const StudyFront: React.FC<StudyFrontProps> = () => {
  const [activeTab, setActiveTab] = useState('词组搭配');
  const [study, setStudy] = useState<Study | null>(null);
  const [wordCard, setWordCard] = useState<any | null>(null);
  const words: UserRoadMapElementV2[] = [{"topic_id":6011,"word_level_id":11,"tag_id":0,"options":[347,15253,5969]},{"topic_id":4843,"word_level_id":11,"tag_id":0,"options":[4333,4347,6839]},{"topic_id":5969,"word_level_id":11,"tag_id":0,"options":[1695,9020,5729]}];

  // 初始化学习流程
  useEffect(() => {
    const initStudy = async () => {
      const studyInstance = new Study(words);
      await studyInstance.start();
      setStudy(studyInstance);
      setWordCard(studyInstance.getCurrentWord()?.toObject() || null);
    };
    
    initStudy();
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

  // 渲染正面内容
  const renderFrontContent = () => (
    <div className="study-front-container" style={{
      width: '100%',
      maxWidth: '800px',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <header style={{
        textAlign: 'center',
        marginBottom: '1.5rem',
        color: '#6c757d',
        fontSize: '1.1rem'
      }}>
        <span>已学习 0</span>
        <span> / </span>
        <span>需学习 10</span>
      </header>

      <main className="study-front-card" style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{
          height: '300px',
          backgroundColor: '#e9ecef',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `url(https://7n.bczcdn.com${wordCard?.word.word.dict.sentences?.[0]?.img_uri})`
        }}></div>
        {wordCard?.showWord && 
          <h1 className="study-front-word" style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            margin: '0 0 0.5rem 0'
          }}>{wordCard?.word.word.dict.word_basic_info.word}</h1>
        }        
        <div style={{
          color: '#6c757d',
          marginBottom: '1rem',
          fontSize: '1.1rem'
        }}>              
          {wordCard?.word.word.dict.word_basic_info.accent_uk &&
             <span style={{ margin: '0 0.5rem' }}>英 {wordCard?.word.word.dict.word_basic_info.accent_uk}</span>}          
          {wordCard?.word.word.dict.word_basic_info.accent_uk && 
          <FontAwesomeIcon 
            icon={faVolumeUp} 
            style={{
              width: '20px',
              height: '20px',
              marginLeft: '0.5rem',
              cursor: 'pointer',
              color: 'rgb(65, 84, 98)'
            }}
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
            <span style={{ margin: '0 0.5rem' }}>美 {wordCard?.word.word.dict.word_basic_info.accent_usa}</span>
          }
          {wordCard?.word.word.dict.word_basic_info.accent_uk &&
          <FontAwesomeIcon icon={faVolumeUp} 
            style={{
              width: '20px',
              height: '20px',
              marginLeft: '0.5rem',
              cursor: 'pointer',
              color: 'rgb(65, 84, 98)'
            }}
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
        <p style={{
          color: '#6c757d',
          marginBottom: '2rem'
        }}>{wordCard?.word.word.dict.en_means?.[0]?.mean}</p>
        }
      </main>

      <footer style={{
        padding: '0 1rem'
      }}>
        <div className="study-front-options" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem'
        }}>
          {(Object.values(wordCard?.options) as StudyOption[]).map((option, index) => (
            <button
              key={index}
              onClick={(e) => {
                (e.currentTarget as HTMLElement).style.border = option.isCorrect ? '2px solid #388e3c' : '2px solid #c62828';
                handleOptionClick(option.id, option.isCorrect);            
              }}
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e7e7e7',
                borderRadius: '8px',
                padding: '1.2rem',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'background-color 0.3s, border-color 0.3s',
                minHeight: '107px',              
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              {wordCard?.options[option.id].showOptionWord && <p>{option.word}</p>}
              {wordCard?.options[option.id].showOptionTranslation && <p>{option.translation}</p>}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );

  // 渲染背面内容
  const renderBackContent = () => (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* 单词信息 */}
      <section style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0 }}>{wordCard?.word.word.dict.word_basic_info.word}</h1>
          <FontAwesomeIcon 
            icon={faStar} 
            style={{
              width: '24px',
              height: '24px',
              color: '#ccc',
              flexShrink: 0,
              cursor: 'pointer'
            }}
            title="收藏/取消收藏"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: '#6c757d', marginBottom: '1rem' }}>
          {wordCard?.word.word.dict.word_basic_info.accent_uk && <span>英 {wordCard?.word.word.dict.word_basic_info.accent_uk}</span>}
          {wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri && (
            <FontAwesomeIcon 
              icon={faVolumeUp} 
              style={{
                width: '20px',
                height: '20px',
                flexShrink: 0,
                cursor: 'pointer'
              }}
              onClick={() => {
                const audio = new Audio("https://7n.bczcdn.com" + wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri);
                audio.play().catch(error => {
                  console.error('音频播放失败:', error);
                });
              }}
              title="播放英式发音"
            />
          )}
          {wordCard?.word.word.dict.word_basic_info.accent_usa && <span>美 {wordCard?.word.word.dict.word_basic_info.accent_usa}</span>}
          {wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri && (
            <FontAwesomeIcon 
              icon={faVolumeUp} 
              style={{
                width: '20px',
                height: '20px',
                flexShrink: 0,
                cursor: 'pointer'
              }}
              onClick={() => {
                const audio = new Audio("https://7n.bczcdn.com" + wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri);
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
            <p key={meanType} style={{ margin: '0.25rem 0' }}>
              <strong>{meanType}</strong> {means.map(mean => mean.mean).join('; ')}
            </p>
          ));
        })()}
      </section>

      {/* 图文例句 */}
      {wordCard?.word.word.dict?.sentences?.length && wordCard.word.word.dict.sentences.length > 0 && (
         <section style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
           <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid #e7e7e7', paddingBottom: '0.5rem' }}>图文例句</h2>
           {(() => {
             const sentence: SentenceInfo = wordCard?.word.word.dict.sentences?.[0];
             if (!sentence) return null;
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

      {/* 其他信息 */}
      <section style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
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
                style={{
                  backgroundColor: activeTab === tab ? '#007bff' : '#e9ecef',
                  color: activeTab === tab ? 'white' : 'inherit',
                  border: `1px solid ${activeTab === tab ? '#007bff' : '#ced4da'}`,
                  borderRadius: '20px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {tab}
              </button>
            ));
          })()} 
        </div>
        <div>
          {(() => {
            const wordData = wordCard?.word.word;
            if (!wordData) return null;
            
            switch (activeTab) {
               case '词组搭配':
                 return (wordData.dict?.short_phrases as ShortPhraseInfo[])?.map((phrase, index) => (
                   <div key={index} style={{ marginBottom: '0.5rem' }}>
                     <p style={{ margin: 0 }}>{phrase.short_phrase}</p>
                     <p style={{ color: '#6c757d', fontSize: '0.9rem', margin: 0 }}>{phrase.short_phrase_trans}</p>
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
                       <div key={index} style={{ marginBottom: '0.5rem' }}>
                         <p style={{ margin: 0 }}>{variant.label}: {word}</p>
                       </div>
                     );
                   });
                 })();
               
               case '英文释义':
                 return (wordData.dict?.en_means as MeanInfo[])?.map((meaning, index) => (
                   <div key={index} style={{ marginBottom: '0.5rem' }}>
                     <p style={{ margin: 0 }}>{meaning.mean_type && `[${meaning.mean_type}] `}{meaning.mean}</p>
                   </div>
                 ));
               
               case '近义词':
                 return (wordData.dict?.synonyms as SynAntInfo[])?.map((synonym, index) => (
                   <div key={index} style={{ marginBottom: '0.5rem' }}>
                     <p style={{ margin: 0 }}>{synonym.syn_ant}</p>
                   </div>
                 ));
               
               case '形近词':
                 return (wordData.similar_words as SimilarWord[])?.map((word, index) => (
                   <div key={index} style={{ marginBottom: '0.5rem' }}>
                     <p style={{ margin: 0 }}>{word.word}</p>
                   </div>
                 ));
              
              default:
                return null;
            }
          })()} 
        </div>
      </section>

      <footer style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          onClick={handleNext}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '1rem 0',
            width: '100%',
            maxWidth: '400px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}>下一个</button>
      </footer>
    </div>
  );

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      margin: 0,
      backgroundColor: '#f8f9fa',
      color: '#333',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh'
    }}>
      {wordCard ? (wordCard.showAnswer ? renderBackContent() : renderFrontContent()) : <div>加载中...</div>}

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