import { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import type { UserBookItem } from '../types';
import type { StudyUIModel } from '../services/study/types';
import { CollectModal, AudioIcon } from '../components';
import { wordService } from '../services/wordService';
import styles from './StudyView.module.css';

interface StudyBackCardProps {
  uiModel: StudyUIModel | null;
  next: () => void;
}

const StudyBackCard: React.FC<StudyBackCardProps> = ({ uiModel, next }) => {
  const [activeTab, setActiveTab] = useState('');
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [collected, setCollected] = useState(false);

  useEffect(() => {
    setCollected(uiModel?.collected ?? false);
  }, [uiModel]);

  if (!uiModel) return null;

  // Helper variables for cross-model access
  const word = uiModel.word;
  const topicId = uiModel.topicId;
  
  const accentUk = uiModel.front.accent.uk;
  const accentUkAudio = uiModel.front.accent.ukAudio;
  const accentUs = uiModel.front.accent.us;
  const accentUsAudio = uiModel.front.accent.usAudio;

  const mnemonic = uiModel.back.mnemonic;

  // Sentences
  const sentence = uiModel.back.sentences[0] || null; // uiModel sentence object

  // Extensions
  const phrases = uiModel.extensions.phrases;
  const variants = uiModel.extensions.variants;
  const enMeans = uiModel.extensions.enMeans;
  const synonyms = uiModel.extensions.synonyms;
  const similars = uiModel.extensions.similars;


  // 检查单词是否已收藏
  const isWordCollected = () => {
    return collected;
  };

  // 处理星标点击
  const handleStarClick = async () => {
    if (!topicId) return;

    // 总是显示收藏模态框
    await loadUserBooks();
    setShowCollectModal(true);
  };

  // 加载用户单词本列表
  const loadUserBooks = async () => {
    const currentTopicId = topicId?.toString();
    if (!currentTopicId) return;

    await wordService.loadUserBooks(
      currentTopicId,
      setUserBooks,
      setSelectedBookId
    );
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
    const currentTopicId = topicId?.toString();
    if (!currentTopicId) return;

    try {
      const success = await wordService.saveCollectSettings(currentTopicId, selectedBookId);
      if (success) {
        setCollected(selectedBookId !== null);
        setShowCollectModal(false);
      }
    } catch (error) {
      // 错误处理已在wordService中完成
    }
  };

  // 取消收藏
  const handleCancelCollect = () => {
    setShowCollectModal(false);
    setSelectedBookId(null);
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (phrases && phrases.length > 0) tabs.push('词组搭配');
    if (variants && variants.length > 0) tabs.push('单词变形');
    if (enMeans && enMeans.length > 0) tabs.push('英文释义');
    if (synonyms && synonyms.length > 0) tabs.push('近义词');
    if (similars && similars.length > 0) tabs.push('形近词');
    return tabs;
  }, [phrases, variants, enMeans, synonyms, similars]);

  useEffect(() => {
    if (availableTabs.length && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs]);

  return (
    <>
      <div className={styles.backContainer}>
        <section className={`${styles.backCard} ${styles.backWordInfo}`}>
          <div className={styles.backWordHeader}>
            <h1 className={styles.backWordTitle}>
              {word}
            </h1>
            <FontAwesomeIcon
              icon={faStar}
              className={styles.backStarIcon}
              onClick={handleStarClick}
              style={{
                color: isWordCollected() ? '#007bff' : '#d3d3d3',
                cursor: 'pointer',
              }}
              title="收藏/取消收藏"
            />
          </div>
          <div className={styles.backPronunciation}>
            {accentUk && (
              <span>
                英 {accentUk}
              </span>
            )}

            {accentUkAudio && (
              <AudioIcon
                src={accentUkAudio}
              />
            )}

            {accentUs && (
              <span>
                美 {accentUs}
              </span>
            )}

            {accentUsAudio && (
              <AudioIcon
                src={accentUsAudio}
              />
            )}
          </div>
          {(() => {
            // Group Chinese meanings
            // Unified rendering logic based on uiModel
            
            let groupedMeans: Record<string, string[]> = {};
            
            uiModel.back.cnMeans.forEach(m => {
              if (!groupedMeans[m.type]) groupedMeans[m.type] = [];
              groupedMeans[m.type].push(m.text);
            });

            // Display
            return Object.entries(groupedMeans).map(([meanType, means]) => (
              <p key={meanType} className={styles.backTranslation}>
                <strong>{meanType}</strong>{' '}
                {means.join('; ')}
              </p>
            ));
          })()}
        </section>

        {/* 词根助记 */}
        {mnemonic && (
          <section className={styles.backCard}>
            <span className={styles.etymaLabel}>词根助记</span>
            <div>
              <div className={styles.backSentenceHeader}>
                <>
                  {mnemonic.content && (
                    <p className={styles.backSentenceText}>{mnemonic.content}</p>
                  )}
                  {mnemonic.imgContent && (
                    <img 
                      src={mnemonic.imgContent} 
                      alt="助记图片" 
                      className={styles.backMnemonicImage} 
                    />
                  )}
                </>
              </div>
            </div>
          </section>
        )}

        {sentence && (
          <section className={styles.backCard}>
            {(() => {
              const sText = sentence.en;
              const sAudio = sentence.audio;
              const sTrans = sentence.cn;
              const sImg = sentence.img;
              const sHighlight = sentence.highlightPhrase;

              if (!sText) return null;

              const finalImgUrl = sImg ? (sImg.startsWith('http') ? sImg : `https://7n.bczcdn.com${sImg}`) : '';

              return (
                <div>
                  <div className={styles.backSentenceHeader}>
                    <p className={styles.backSentenceText}>
                      {sHighlight
                        ? sText
                            .split(sHighlight)
                            .map((part: string, i: number) =>
                              i === 0 ? (
                                <span key={i}>
                                  {part}
                                  <strong>{sHighlight}</strong>
                                </span>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )
                        : sText}
                    </p>
                    {sAudio && (
                      <AudioIcon src={sAudio} />
                    )}
                  </div>
                  <p className={styles.backSentenceTranslation}>
                    {sTrans}
                  </p>
                  {finalImgUrl && (
                    <img
                      src={finalImgUrl}
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
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`${styles.backTabButton} ${activeTab === tab ? styles.backTabButtonActive : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className={styles.backTabContent}>
            {(() => {
              // Check active tab and data availability
              switch (activeTab) {
                case '词组搭配':
                  return phrases.map((phrase: any, index: number) => (
                    <div key={index} className={styles.backPhraseItem}>
                      <p className={styles.backPhraseText}>
                        {phrase.phrase}
                      </p>
                      <p className={styles.backPhraseTranslation}>
                         {phrase.cn}
                      </p>
                    </div>
                  ));

                case '单词变形':
                  return variants?.map((v, index) => (
                    <div key={index} className={styles.backVariantItem}>
                      <p className={styles.backVariantText}>
                        {v.label}: {v.word}
                      </p>
                    </div>
                  ));

                case '英文释义':
                  return enMeans.map((meaning: any, index: number) => (
                      <div key={index} className={styles.backMeaningItem}>
                        <p className={styles.backMeaningText}>
                          {meaning.type && `[${meaning.type}] ${meaning.text}`}
                        </p>
                      </div>
                    )
                  );

                case '近义词':
                  return synonyms.map((synonym: any, index: number) => (
                      <div key={index} className={styles.backSynonymItem}>
                        <p className={styles.backSynonymText}>
                          {synonym.word}
                        </p>
                      </div>
                    )
                  );

                case '形近词':
                  return similars.map((word: any, index: number) => (
                      <div key={index} className={styles.backSimilarWordItem}>
                        <p className={styles.backSimilarWordText}>
                           {word.word}
                        </p>
                      </div>
                    )
                  );

                default:
                  return null;
              }
            })()}
          </div>
        </section>

        <footer className={styles.backStudyFooter}>
          <button onClick={next} className={styles.backNextButton}>
            下一个
          </button>
        </footer>
      </div>

      <CollectModal
        showModal={showCollectModal}
        userBooks={userBooks}
        selectedBookId={selectedBookId}
        onToggleBookSelection={toggleBookSelection}
        onCancel={handleCancelCollect}
        onSave={handleSaveCollect}
      />
    </>
  );
};

export default StudyBackCard;
