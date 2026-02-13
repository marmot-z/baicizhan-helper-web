import { WordIterator } from './WordIterator';
import type { StudyUIModel } from './types';
import type { SearchWordResultV2 } from '../../types';
import { WordCard } from './WordCard';

/**
 * ProcessIterator类 - 学习流程迭代器
 * 负责管理三个学习环节的流程和状态，实现迭代器模式
 */
export class ProcessIterator {
  private iterators: WordIterator[];
  private currentIteratorIndex: number;
  private wordNum: number;
  private allWords: StudyUIModel[];
  
  /**
   * 构造函数
   * @param words 学习单词列表
   */
  constructor(words: StudyUIModel[]) {
    // 初始化三个环节的迭代器，每个环节使用相同的单词数组
    this.iterators = [
      new WordIterator('recognition', words),
      new WordIterator('understanding', words),
      new WordIterator('mastery', words) 
    ];    
    this.currentIteratorIndex = 0;
    this.wordNum = words.length;
    this.allWords = words;
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
  public next(): WordCard | null {
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
      const uiModel: StudyUIModel | null = currentIterator.next();
      return uiModel ? new WordCard(uiModel, currentIterator.stage) : null;
    }
    
    return null;
  }

  public putback(word: StudyUIModel) : void {
    this.iterators[this.currentIteratorIndex]?.putback(word);
  }

  public getProgress(): number {
    const remain = this.iterators.reduce((acc, cur) => acc + cur.getRemainNum(), 0);
    const total = this.iterators.length * this.wordNum;
    return (total - remain - 1) / total;
  }

  public getAllWords(): StudyUIModel[] {
    return this.allWords;
  }

  public getWordBriefInfos(): SearchWordResultV2[] {
    const result: SearchWordResultV2[] = [];
    
    // 遍历 allWords 中的所有单词
    this.allWords.forEach((uiModel) => {
      const meanCn = uiModel.back.cnMeans
        .map(m => `${m.type}.${m.text}`)
        .join('；');      
      const accent = uiModel.front.accent.us || uiModel.front.accent.uk || '';
      
      result.push({
        word: uiModel.word,
        topic_id: uiModel.topicId,
        mean_cn: meanCn,
        accent: accent
      });
    });
    
    return result;
  }
}
