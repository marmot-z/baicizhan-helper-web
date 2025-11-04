import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import type {
  MeanInfo,
  SentenceInfo,
  ShortPhraseInfo,
  SynAntInfo,
  SimilarWord,
  UserBookItem,
} from '../types';
import { CollectModal, AudioIcon } from '../components';
import { wordService } from '../services/wordService';
import styles from './StudyView.module.css';

interface StudyBackCardProps {
  wordCard: any;
  next: () => void;
}

const StudyBackCard: React.FC<StudyBackCardProps> = ({ wordCard, next }) => {
  const [activeTab, setActiveTab] = useState('词组搭配');
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [userBooks, setUserBooks] = useState<UserBookItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

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
    const currentTopicId =
      wordCard?.word?.word?.dict.word_basic_info.topic_id.toString();
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
    const currentTopicId =
      wordCard?.word?.word?.dict.word_basic_info.topic_id.toString();
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

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <>
      <div className={styles.backContainer}>
        <section className={`${styles.backCard} ${styles.backWordInfo}`}>
          <div className={styles.backWordHeader}>
            <h1 className={styles.backWordTitle}>
              {wordCard?.word.word.dict.word_basic_info.word}
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
            {wordCard?.word.word.dict.word_basic_info.accent_uk && (
              <span>
                英 {wordCard?.word.word.dict.word_basic_info.accent_uk}
              </span>
            )}

            {wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri && (
              <AudioIcon
                src={
                  wordCard?.word.word.dict.word_basic_info.accent_uk_audio_uri
                }
              />
            )}

            {wordCard?.word.word.dict.word_basic_info.accent_usa && (
              <span>
                美 {wordCard?.word.word.dict.word_basic_info.accent_usa}
              </span>
            )}

            {wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri && (
              <AudioIcon
                src={
                  wordCard?.word.word.dict.word_basic_info.accent_usa_audio_uri
                }
              />
            )}
          </div>
          {(() => {
            // 按照 mean_type 对中文释义进行分组
            const chn_means: MeanInfo[] =
              wordCard?.word.word.dict.chn_means || [];
            const groupedMeans = chn_means.reduce(
              (groups, mean) => {
                const type = mean.mean_type || '其他';
                if (!groups[type]) {
                  groups[type] = [];
                }
                groups[type].push(mean);
                return groups;
              },
              {} as Record<string, typeof chn_means>
            );

            // 按分组展示释义
            return Object.entries(groupedMeans).map(([meanType, means]) => (
              <p key={meanType} className={styles.backTranslation}>
                <strong>{meanType}</strong>{' '}
                {means.map((mean) => mean.mean).join('; ')}
              </p>
            ));
          })()}
        </section>

        {/* 词根助记 */}
        {wordCard?.word.word.dict?.word_basic_info.etyma && (
          <section className={styles.backCard}>
            <span className={styles.etymaLabel}>词根助记</span>
            <div>
              <div className={styles.backSentenceHeader}>
                <p className={styles.backSentenceText}>
                  {wordCard.word.word.dict.word_basic_info.etyma}
                </p>
              </div>
            </div>
          </section>
        )}

        {wordCard?.word.word.dict?.sentences?.length && (
          <section className={styles.backCard}>
            {(() => {
              const sentence: SentenceInfo =
                wordCard?.word.word.dict.sentences?.[0];
              if (!sentence) return null;
              return (
                <div>
                  <div className={styles.backSentenceHeader}>
                    <p className={styles.backSentenceText}>
                      {sentence.highlight_phrase
                        ? sentence.sentence
                            .split(sentence.highlight_phrase)
                            .map((part, i) =>
                              i === 0 ? (
                                <span key={i}>
                                  {part}
                                  <strong>{sentence.highlight_phrase}</strong>
                                </span>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )
                        : sentence.sentence}
                    </p>
                    {sentence.audio_uri && (
                      <AudioIcon src={sentence.audio_uri} />
                    )}
                  </div>
                  <p className={styles.backSentenceTranslation}>
                    {sentence.sentence_trans}
                  </p>
                  {sentence.img_uri && (
                    <img
                      src={'https://7n.bczcdn.com' + sentence.img_uri}
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

              if (
                wordData?.dict?.short_phrases &&
                wordData.dict.short_phrases.length > 0
              ) {
                availableTabs.push('词组搭配');
              }
              if (wordData?.dict?.variant_info) {
                availableTabs.push('单词变形');
              }
              if (
                wordData?.dict?.en_means &&
                wordData.dict.en_means.length > 0
              ) {
                availableTabs.push('英文释义');
              }
              if (
                wordData?.dict?.synonyms &&
                wordData.dict.synonyms.length > 0
              ) {
                availableTabs.push('近义词');
              }
              if (
                wordData?.similar_words &&
                wordData.similar_words.length > 0
              ) {
                availableTabs.push('形近词');
              }

              return availableTabs.map((tab) => (
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
                  return (
                    wordData.dict?.short_phrases as ShortPhraseInfo[]
                  )?.map((phrase, index) => (
                    <div key={index} className={styles.backPhraseItem}>
                      <p className={styles.backPhraseText}>
                        {phrase.short_phrase}
                      </p>
                      <p className={styles.backPhraseTranslation}>
                        {phrase.short_phrase_trans}
                      </p>
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
                      { key: 'conn', label: '连词' },
                    ];

                    const availableVariants = variantFields.filter(
                      (field) =>
                        variantInfo[field.key as keyof typeof variantInfo] &&
                        variantInfo[field.key as keyof typeof variantInfo] !==
                          ''
                    );

                    return availableVariants.map((variant, index) => {
                      const word = variantInfo[
                        variant.key as keyof typeof variantInfo
                      ] as string;
                      return (
                        <div key={index} className={styles.backVariantItem}>
                          <p className={styles.backVariantText}>
                            {variant.label}: {word}
                          </p>
                        </div>
                      );
                    });
                  })();

                case '英文释义':
                  return (wordData.dict?.en_means as MeanInfo[])?.map(
                    (meaning, index) => (
                      <div key={index} className={styles.backMeaningItem}>
                        <p className={styles.backMeaningText}>
                          {meaning.mean_type && `[${meaning.mean_type}] `}
                          {meaning.mean}
                        </p>
                      </div>
                    )
                  );

                case '近义词':
                  return (wordData.dict?.synonyms as SynAntInfo[])?.map(
                    (synonym, index) => (
                      <div key={index} className={styles.backSynonymItem}>
                        <p className={styles.backSynonymText}>
                          {synonym.syn_ant}
                        </p>
                      </div>
                    )
                  );

                case '形近词':
                  return (wordData.similar_words as SimilarWord[])?.map(
                    (word, index) => (
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
