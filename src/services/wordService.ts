import { bookService } from './bookService';
import { useWordBookStore } from '../stores/wordBookStore';
import { toast } from 'react-hot-toast';

export class WordService {

  // 加载用户单词本列表
  async loadUserBooks(word: string, setUserBooks: any, setSelectedBookId: any) {
    try {
      const books = await bookService.getBooks();
      setUserBooks(books);
      
      // 检查当前单词已经在哪些单词本中
      const currentTopicId = parseInt(word);
      let currentBookId: number | null = null;
      
      // 获取最新的store状态
      const store = useWordBookStore.getState();
      const wordBooks = store.wordBooks;
      
      for (const book of books) {
        const cachedWords = wordBooks[book.user_book_id.toString()]?.words;
        if (cachedWords && cachedWords.some((w: any) => w.topic_id === currentTopicId)) {
          currentBookId = book.user_book_id;
          break; // 只能在一个单词本中
        }
      }
      
      setSelectedBookId(currentBookId);
    } catch (error) {
      console.error('加载单词本列表失败:', error);
      toast.error('加载单词本列表失败');
    }
  }

  // 保存收藏设置
  async saveCollectSettings(word: string, selectedBookId: number | null) {
    if (!word) return false;
    
    const currentTopicId = parseInt(word);
    const store = useWordBookStore.getState();
    const wordBooks = store.wordBooks;
    const setWordBook = store.setWordBook;
    
    try {
      if (selectedBookId === null) {
        // 没有选中任何单词本，取消收藏
        const success = await bookService.cancelCollectWord(0, currentTopicId);
        if (success) {
          // 更新本地缓存，移除该单词
          for (const [bookIdStr, bookData] of Object.entries(wordBooks)) {
            if ((bookData as any).words.some((wordItem: any) => wordItem.topic_id === currentTopicId)) {
              const updatedWords = (bookData as any).words.filter((wordItem: any) => wordItem.topic_id !== currentTopicId);
              setWordBook(bookIdStr, updatedWords);
            }
          }
          toast.success('取消收藏成功');
          return true;
        } else {
          toast.error('取消收藏失败');
          return false;
        }
      } else {
        // 有选中的单词本，进行收藏
        const success = await bookService.collectWord(selectedBookId, currentTopicId);
        if (success) {
          // 更新本地缓存：先从所有单词本中移除当前单词
          for (const [bookIdStr, bookData] of Object.entries(wordBooks)) {
            if ((bookData as any).words.some((wordItem: any) => wordItem.topic_id === currentTopicId)) {
              const updatedWords = (bookData as any).words.filter((wordItem: any) => wordItem.topic_id !== currentTopicId);
              setWordBook(bookIdStr, updatedWords);
            }
          }
          
          // 然后添加到选中的单词本中
          const selectedBookIdStr = selectedBookId.toString();
          const selectedBookWords = wordBooks[selectedBookIdStr]?.words || [];
          if (!selectedBookWords.some((w: any) => w.topic_id === currentTopicId)) {
            // 需要重新获取单词列表以确保数据一致性
            const updatedWords = await bookService.getBookWords(selectedBookId);
            setWordBook(selectedBookIdStr, updatedWords);
          }
          
          toast.success('收藏成功');
          return true;
        } else {
          toast.error('收藏失败');
          return false;
        }
      }
    } catch (error) {
      console.error('保存收藏设置失败:', error);
      toast.error('保存失败');
      throw error;
    }
  }
}

// 创建单例实例
export const wordService = new WordService();