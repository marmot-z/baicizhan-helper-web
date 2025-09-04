import type { UserRoadMapElementV2 } from '../../types';
import type { StudyStage } from './types';

/**
 * WordIterator类 - 表示单个学习环节的迭代器
 * 负责管理环节内的单词队列和学习进度
 * 实现迭代器模式，只提供 hasNext 和 next 方法
 */
export class WordIterator {
  private wordQueue: UserRoadMapElementV2[];
  public stage: StudyStage;
  
  /**
   * 构造函数
   * @param words 单词列表
   * @param stage 学习阶段
   */
  constructor(stage: StudyStage, words: UserRoadMapElementV2[]) {    
    this.wordQueue = Array.from(words);
    this.stage = stage;
  }
  
  /**
   * 检查是否有下一个单词
   * @returns 是否有下一个单词
   */
  public hasNext(): boolean {
    return this.wordQueue.length > 0;
  }
  
  /**
   * 获取下一个单词卡片并移动迭代器
   * @returns 下一个单词卡片，如果没有则返回null
   */
  public next(): UserRoadMapElementV2 | null {
    if (!this.hasNext()) {
      return null;
    }
    
    return this.wordQueue.shift() || null;
  }

  public putback(wordId: UserRoadMapElementV2): void {
    if (this.wordQueue.includes(wordId)) {
      return;
    }

    this.wordQueue.push(wordId);
  }
}