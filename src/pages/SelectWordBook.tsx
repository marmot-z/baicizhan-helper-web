import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import { studyService } from '../services/studyService';
import { useStudyStore } from '../stores/studyStore';
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
        [FALLBACK_CATEGORY_KEY]: [
          {
            key: FALLBACK_CATEGORY_KEY,
            title: '全部词书',
            books,
          },
        ],
      },
    };
  }

  return { tabs, sectionsByTab };
};

const SelectWordBook: React.FC = () => {
  const navigate = useNavigate();
  const currentBook = useStudyStore((state) => state.currentBook);
  const [books, setBooks] = useState<UserBookBasicInfo[]>([]);
  const [categories, setCategories] = useState<UserBookCategory[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAllTabs, setShowAllTabs] = useState(false);

  useEffect(() => {
    const loadBooks = async () => {
      setLoading(true);
      try {
        const result = await studyService.getAllBooks();
        setBooks(result.books);
        setCategories(result.categories);
        const initialTab =
          result.categories[0]?.cate_id ||
          result.categories[0]?.category_name ||
          FALLBACK_CATEGORY_KEY;
        setActiveTab(initialTab);
      } catch (error) {
        console.error('获取全部词书失败:', error);
        toast.error('获取词书列表失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    void loadBooks();
  }, []);

  const { tabs, sectionsByTab } = useMemo(
    () => buildSections(books, categories),
    [books, categories],
  );

  const visibleSections = sectionsByTab[activeTab] ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h1 className={styles.title}>全部词书</h1>
          <p className={styles.subtitle}>选择新的学习词书，并为它制定每日计划。</p>
        </header>

        {showAllTabs ? (
          <div className={styles.tabsBlock}>
            <div className={`${styles.tabs} ${styles.tabsExpanded}`} role="tablist" aria-label="词书分类">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
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
                    const isCurrent = currentBook?.id === book.id;
                    return (
                      <button
                        key={book.id}
                        type="button"
                        className={`${styles.bookTile} ${isCurrent ? styles.bookTileCurrent : ''}`}
                        onClick={() =>
                          navigate(
                            ROUTES.CREATE_STUDY_PLAN.replace(':bookId', String(book.id)),
                            {
                              state: { book },
                            },
                          )
                        }
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
                          {isCurrent ? <span className={styles.currentBadge}>当前计划</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectWordBook;
