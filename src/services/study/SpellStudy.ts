import { studyService } from '../studyService';
import type { StudyUIModel } from './types';

/**
 * SpellStudy 类 - 拼写练习流程驱动
 * 负责管理拼写队列、判定对错以及轮次重练逻辑
 */
export class SpellStudy {
  private queue: StudyUIModel[] = [];
  private retryQueue: StudyUIModel[] = [];
  private currentWord: StudyUIModel | null = null;
  private planType: string;
  private bookId: number;
  
  public isWrong: boolean = false;
  public isCompleted: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor(words: StudyUIModel[], planType: string = '', bookId: number = 0) {
    this.planType = planType;
    this.bookId = bookId;
    // 初始队列
    this.queue = [...words];
    this.reportPlanEvent('begin-spelling-plan');
    this.next();
  }

  private reportStrategyEnter(topicId: number): void {
    studyService.reportEvent(
      'strategy_study_enter',
      JSON.stringify({
        topic_id: topicId,
        strategy_id: 'q4',
        plan_type: this.planType
      }),
      'study-detail-common'
    ).catch(console.error);
  }

  private reportClick(topicId: number, isRight: number): void {
    studyService.reportEvent(
      'choose_in_recite_click',
      JSON.stringify({
        topic_id: topicId,
        strategy_id: 'q4',
        choice_topic_id: null,
        is_right: isRight,
        plan_type: this.planType
      }),
      'study-detail-common'
    ).catch(console.error);
  }

  private reportPlanEvent(eventName: 'begin-spelling-plan' | 'finish-spelling-plan'): void {
    studyService.reportEvent(
      eventName,
      JSON.stringify({
        book_id: this.bookId,
        plan_type: this.planType
      }),
      'study-detail-common'
    ).catch(console.error);
  }

  /**
   * 订阅状态变化
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  /**
   * 获取当前单词
   */
  public getCurrentWord(): StudyUIModel | null {
    return this.currentWord;
  }

  /**
   * 检查用户输入
   * @param input 用户拼写的单词
   * @returns 是否拼写正确
   */
  public check(input: string): boolean {
    if (!this.currentWord || this.isCompleted) return false;

    const isCorrect = input.trim().toLowerCase() === this.currentWord.word.toLowerCase();
    
    if (isCorrect) {
      this.reportClick(this.currentWord.topicId, 1);
      // 只有拼写正确才切换到下一个单词
      this.next();
      return true;
    } else {
      // 拼写错误：信号通知视图，且不切换单词
      if (!this.isWrong) {
        this.isWrong = true;
        // 只要不是一次性通过，就加入下一轮重练队列
        // 注意：同一轮中同一个单词只加一次
        if (!this.retryQueue.find(w => w.topicId === this.currentWord?.topicId)) {
          this.retryQueue.push(this.currentWord);
        }
      }
      this.reportClick(this.currentWord.topicId, 0);
      // 每次错误都通知监听者（用于视图触发震动或错误提示）
      this.notify();
      return false;
    }
  }

  /**
   * 切换到下一个单词或下一轮
   */
  public next(): void {
    this.isWrong = false;
    
    if (this.queue.length > 0) {
      // 继续当前队列
      this.currentWord = this.queue.shift() || null;
    } else if (this.retryQueue.length > 0) {
      // 当前轮次结束，但有需要重练的单词，开启新一轮
      this.queue = [...this.retryQueue];
      this.retryQueue = [];
      this.currentWord = this.queue.shift() || null;
    } else {
      // 所有单词都已一次性通过或重练完成
      this.currentWord = null;
      this.isCompleted = true;
      this.reportPlanEvent('finish-spelling-plan');
    }

    if (this.currentWord) {
      this.reportStrategyEnter(this.currentWord.topicId);
    }
    
    this.notify();
  }

  /**
   * 获取当前进度统计
   */
  public getStats() {
    return {
      remainingInRound: this.queue.length,
      retryCount: this.retryQueue.length,
      isCompleted: this.isCompleted
    };
  }
}
