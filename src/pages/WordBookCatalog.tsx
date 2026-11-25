import { useMemo, useState } from 'react';
import type { AllBooksResponse } from '../services/studyService';
import type { UserBookBasicInfo, UserBookCategory, UserSubCategory } from '../types';
import styles from './SelectWordBook.module.css';

interface CategorySection {
  key: string;
  title: string;
  books: UserBookBasicInfo[];
}

const FALLBACK_CATEGORY_KEY = 'all';
const COVER_THEMES = [
  styles.coverOrange,
  styles.coverGold,
  styles.coverGreen,
  styles.coverBlue,
  styles.coverPurple,
  styles.coverRose,
];

function getBookTag(name: string): string {
  return name.trim().slice(0, 6) || '词书';
}

function getCoverTheme(bookId: number): string {
  return COVER_THEMES[Math.abs(bookId) % COVER_THEMES.length];
}

function getCoverGlyph(name: string): string {
  const upperName = name.toUpperCase();
  if (upperName.includes('CET-4')) return '4';
  if (upperName.includes('CET-6')) return '6';
  if (name.includes('高考')) return 'A';
  if (name.includes('中考')) return 'B';
  if (name.includes('专升本')) return '升';
  return name.trim().charAt(0) || '词';
}

const buildSections = (
  books: UserBookBasicInfo[],
  categories: UserBookCategory[],
): { tabs: Array<{ key: string; label: string }>; sectionsByTab: Record<string, CategorySection[]> } => {
  const bookMap = new Map(books.map((book) => [book.id, book]));
  const tabs = categories.map((category) => ({
    key: category.cate_id || category.category_name,
    label: category.category_name,
  }));

  const sectionsByTab = categories.reduce<Record<string, CategorySection[]>>((acc, category) => {
    const categoryKey = category.cate_id || category.category_name;
    const subCategories = category.sub_categories ?? [];
    const sections = subCategories
      .map((subCategory: UserSubCategory, index) => {
        const sectionBooks = (subCategory.book_ids ?? [])
          .map((bookId) => bookMap.get(bookId))
          .filter((book): book is UserBookBasicInfo => Boolean(book));

        if (sectionBooks.length === 0) {
          return null;
        }

        return {
          key: `${categoryKey}-${subCategory.sub_name || index}`,
          title: subCategory.sub_name || category.category_name,
          books: sectionBooks,
        };
      })
      .filter((section): section is CategorySection => Boolean(section));

    acc[categoryKey] = sections;
    return acc;
  }, {});

  if (tabs.length === 0) {
    return {
      tabs: [{ key: FALLBACK_CATEGORY_KEY, label: '全部' }],
      sectionsByTab: {
        [FALLBACK_CATEGORY_KEY]: books.length ? [
          {
            key: FALLBACK_CATEGORY_KEY,
            title: '全部词书',
            books,
          },
        ] : [],
      },
    };
  }

  return { tabs, sectionsByTab };
};

interface WordBookCatalogProps {
  data: AllBooksResponse;
  loading?: boolean;
  currentBookId?: number;
  currentBookLabel?: string;
  selectedBookId?: number | null;
  onBookClick: (book: UserBookBasicInfo) => void;
}

export default function WordBookCatalog({
  data,
  loading = false,
  currentBookId,
  currentBookLabel = '当前计划',
  selectedBookId,
  onBookClick,
}: WordBookCatalogProps) {
  const [activeCategory, setActiveTab] = useState('');
  const [showAllTabs, setShowAllTabs] = useState(false);
  const { tabs, sectionsByTab } = useMemo(
    () => buildSections(data.books, data.categories),
    [data],
  );

  const activeTab = tabs.some((tab) => tab.key === activeCategory) ? activeCategory : tabs[0]?.key;
  const visibleSections = activeTab ? sectionsByTab[activeTab] ?? [] : [];

  return (
    <>
      {showAllTabs ? (
        <div className={styles.tabsBlock}>
          <div className={`${styles.tabs} ${styles.tabsExpanded}`} role="tablist" aria-label="词书分类">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {tabs.length > 0 ? (
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={styles.expandToggle}
                onClick={() => setShowAllTabs(false)}
              >
                收起
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.tabsBlock}>
          <div className={`${styles.tabs} ${styles.tabsCollapsed}`} role="tablist" aria-label="词书分类">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {tabs.length > 0 ? (
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={styles.expandToggle}
                onClick={() => setShowAllTabs(true)}
              >
                展开全部
              </button>
            </div>
          ) : null}
        </div>
      )}

      {loading ? (
        <section className={styles.placeholderCard}>词书加载中...</section>
      ) : visibleSections.length === 0 ? (
        <section className={styles.placeholderCard}>当前分类暂无词书。</section>
      ) : (
        <div className={styles.sectionList}>
          {visibleSections.map((section) => (
            <section key={section.key} className={styles.section}>
              <p className={styles.sectionLabel}>{section.title}</p>
              <div className={styles.bookGrid}>
                {section.books.map((book) => {
                  const isCurrent = currentBookId === book.id;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      aria-current={isCurrent ? 'true' : undefined}
                      aria-pressed={selectedBookId === undefined ? undefined : selectedBookId === book.id}
                      className={`${styles.bookTile} ${isCurrent ? styles.bookTileCurrent : ''}`}
                      onClick={() => onBookClick(book)}
                    >
                      <div className={styles.cardTop}>
                        {book.img ? (
                          <img className={styles.tileCoverImage} src={book.img} alt={book.name} />
                        ) : (
                          <div className={`${styles.tileCover} ${getCoverTheme(book.id)}`}>
                            <span className={styles.tileTag}>{getBookTag(book.name)}</span>
                            <span className={styles.coverGlyph}>{getCoverGlyph(book.name)}</span>
                            <span className={styles.coverDeco} />
                          </div>
                        )}
                        <div className={styles.tileBody}>
                          <div className={styles.tileHeading}>
                            <h3 className={styles.tileName}>{book.name}</h3>
                          </div>
                          <p className={styles.tileDesc}>{book.desc || '暂无词书描述'}</p>
                        </div>
                      </div>
                      <div className={styles.tileFoot}>
                        <span className={styles.tileCount}>共 {book.total_words_count} 词</span>
                        {isCurrent ? <span className={styles.currentBadge}>{currentBookLabel}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
