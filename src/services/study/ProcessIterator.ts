import { WordIterator } from './WordIterator';
import type { StudyWord } from './types';
import type { UserRoadMapElementV2 } from '../../types';
import { WordCard } from './WordCard';
import { StudyUtils } from './StudyUtils';

/**
 * ProcessIterator类 - 学习流程迭代器
 * 负责管理三个学习环节的流程和状态，实现迭代器模式
 */
export class ProcessIterator {
  private iterators: WordIterator[];
  private currentIteratorIndex: number;
  private wordCache: Map<number, StudyWord>;
  
  /**
   * 构造函数
   * @param words 学习单词列表
   */
  constructor(words: UserRoadMapElementV2[]) {
    // 初始化三个环节的迭代器，每个环节使用相同的单词数组
    this.iterators = [
      // new WordIterator('recognition', words), // recognition
      // new WordIterator('understanding', words), // understanding
      new WordIterator('mastery', words)  // mastery
    ];    
    this.currentIteratorIndex = 0;
    this.wordCache = new Map();
  }
  
  /**
   * 检查是否有下一个单词
   * @returns 是否有下一个单词
   */
  public hasNext(): boolean {
    // 如果当前迭代器还有下一个单词，返回true
    if (this.currentIteratorIndex < this.iterators.length) {
      const currentIterator = this.iterators[this.currentIteratorIndex];
      
      if (currentIterator.hasNext()) {
        return true;
      }
      
      // 当前迭代器没有下一个单词，检查后续迭代器
      for (let i = this.currentIteratorIndex + 1; i < this.iterators.length; i++) {
        if (this.iterators[i].hasNext()) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * 获取下一个单词卡片
   * @returns 下一个单词卡片，如果没有则返回null
   */
  public async next(): Promise<WordCard | null> {
    if (!this.hasNext()) {
      return null;
    }
    
    // 获取当前迭代器
    let currentIterator = this.iterators[this.currentIteratorIndex];
    
    // 如果当前迭代器没有下一个单词，切换到下一个迭代器
    while (!currentIterator.hasNext() && this.currentIteratorIndex < this.iterators.length - 1) {
      this.currentIteratorIndex++;
      currentIterator = this.iterators[this.currentIteratorIndex];
    }
    
    // 获取下一个单词卡片
    if (currentIterator.hasNext()) {
      let wordId: UserRoadMapElementV2 | null = currentIterator.next();
      return wordId ? await this.getWordCardFromCache(wordId) : null;
    }
    
    return null;
  }

  private async getWordCardFromCache(word: UserRoadMapElementV2): Promise<WordCard> {
    let wordInfo: StudyWord | undefined = this.wordCache.get(word.topic_id);

    if (!wordInfo) {
      this.wordCache.set(word.topic_id, wordInfo = await StudyUtils.fetchWordInfo(word));
    }

    return new WordCard(word, wordInfo, this.iterators[this.currentIteratorIndex].stage);
  }

  public putback(wordId: UserRoadMapElementV2) : void {
    this.iterators[this.currentIteratorIndex]?.putback(wordId);
  }
}