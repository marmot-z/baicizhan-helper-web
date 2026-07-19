import type { StudyUIModel } from './types';
import type { StudyStage } from './types';

export interface WordIteratorState {
  stage: StudyStage;
  queueTopicIds: number[];
}

/**
 * WordIterator类 - 表示单个学习环节的迭代器
 * 负责管理环节内的单词队列和学习进度
 * 实现迭代器模式，只提供 hasNext 和 next 方法
 */
export class WordIterator {
  private wordQueue: StudyUIModel[];
  public stage: StudyStage;
  
  /**
   * 构造函数
   * @param words 单词列表
   * @param stage 学习阶段
   */
  constructor(stage: StudyStage, words: StudyUIModel[]) {    
    this.wordQueue = Array.from(words);
    this.stage = stage;
  }

  public static restore(
    state: WordIteratorState,
    wordsByTopicId: Map<number, StudyUIModel>,
  ): WordIterator {
    const words = state.queueTopicIds.map((topicId) => wordsByTopicId.get(topicId));
    if (words.some((word) => !word)) {
      throw new Error(`Cannot restore ${state.stage} iterator: missing word resource`);
    }
    return new WordIterator(state.stage, words as StudyUIModel[]);
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
  public next(): StudyUIModel | null {
    if (!this.hasNext()) {
      return null;
    }
    
    return this.wordQueue.shift() || null;
  }

  public putback(word: StudyUIModel): void {
    if (this.wordQueue.some(w => w.topicId === word.topicId)) {
      return;
    }

    this.wordQueue.push(word);
  }

  public getRemainNum(): number {
    return this.wordQueue.length;
  }

  public exportState(): WordIteratorState {
    return {
      stage: this.stage,
      queueTopicIds: this.wordQueue.map((word) => word.topicId),
    };
  }
}
