import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '../constants';
import { studyService } from '../services/studyService';
import type { AllBooksResponse } from '../services/studyService';
import { useStudyStore } from '../stores/studyStore';
import WordBookCatalog from './WordBookCatalog';
import styles from './SelectWordBook.module.css';

export default function SelectWordBook() {
  const navigate = useNavigate();
  const currentBook = useStudyStore((state) => state.currentBook);
  const [catalog, setCatalog] = useState<AllBooksResponse>({ books: [], categories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadBooks = async () => {
      try {
        setCatalog(await studyService.getAllBooks(controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('获取全部词书失败:', error);
          toast.error('获取词书列表失败，请稍后重试');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadBooks();
    return () => controller.abort();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h1 className={styles.title}>全部词书</h1>
          <p className={styles.subtitle}>选择新的学习词书，并为它制定每日计划。</p>
        </header>

        <WordBookCatalog
          data={catalog}
          loading={loading}
          currentBookId={currentBook?.id}
          onBookClick={(book) => navigate(
            ROUTES.CREATE_STUDY_PLAN.replace(':bookId', String(book.id)),
            { state: { book } },
          )}
        />
      </div>
    </div>
  );
}
