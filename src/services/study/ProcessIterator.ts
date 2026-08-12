import { WordIterator } from './WordIterator';
import type { StudyUIModel } from './types';
import type { SearchWordResultV2 } from '../../types';
import { WordCard } from './WordCard';
import type { LearnProcessState } from './sessionTypes';

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

  public static restore(words: StudyUIModel[], state: LearnProcessState): ProcessIterator {
    const instance = new ProcessIterator(words);
    const wordsByTopicId = new Map(words.map((word) => [word.topicId, word]));
    instance.iterators = (['recognition', 'understanding', 'mastery'] as const).map((stage) =>
      WordIterator.restore(
        { stage, queueTopicIds: state.queues[stage] ?? [] },
        wordsByTopicId,
      ),
    );
    instance.currentIteratorIndex = Math.min(Math.max(state.currentIteratorIndex, 0), 2);
    return instance;
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

  public removeTopic(topicId: number): void {
    this.iterators.forEach((iterator) => iterator.removeTopic(topicId));
  }

  public getProgress(currentTopicId?: number): number {
    const remain = this.iterators.reduce((acc, cur) => acc + cur.getRemainNum(), 0);
    const total = this.iterators.length * this.wordNum;
    if (total === 0) {
      return 0;
    }

    // next() 会先把正在展示的词移出队列，因此正常情况下它尚未完成，
    // 需要从完成数中扣除。答错后 putback() 已把同一词放回当前队列，
    // 此时不能再次扣除，否则第一题答错就会得到负进度。
    const currentIsQueued = currentTopicId !== undefined
      && this.iterators[this.currentIteratorIndex]?.contains(currentTopicId);
    const activeWordOffset = currentTopicId !== undefined && !currentIsQueued ? 1 : 0;
    const completed = total - remain - activeWordOffset;
    return Math.min(1, Math.max(0, completed / total));
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

  public exportState(): LearnProcessState {
    const iteratorStates = this.iterators.map((iterator) => iterator.exportState());
    return {
      currentIteratorIndex: this.currentIteratorIndex,
      queues: {
        recognition: iteratorStates.find((state) => state.stage === 'recognition')?.queueTopicIds ?? [],
        understanding: iteratorStates.find((state) => state.stage === 'understanding')?.queueTopicIds ?? [],
        mastery: iteratorStates.find((state) => state.stage === 'mastery')?.queueTopicIds ?? [],
      },
    };
  }
}
