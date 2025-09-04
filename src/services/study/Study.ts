import { ProcessIterator } from './ProcessIterator';
import type { UserRoadMapElementV2 } from '../../types';
import type { WordCard } from './WordCard';

/**
 * Study类 - 背单词功能的控制中心
 * 负责管理学习流程和整体状态
 */
export class Study {
  private processIterator: ProcessIterator;
  private startTime: number;
  private currentWordCard: WordCard | null;
  private statistics: Map<number, number>;
  private isComplete: boolean;
  
  /**
   * 构造函数
   * @param words 学习单词列表
   */
  constructor(words: UserRoadMapElementV2[]) {
    this.processIterator = new ProcessIterator(words);
    this.startTime = 0;
    this.currentWordCard = null;
    this.statistics = new Map();
    this.isComplete = false;
  }
  
  public async start(): Promise<void> {  
    this.startTime = Date.now();
    await this.process();
  }

  private async process(): Promise<void> {
    if (!this.processIterator.hasNext()) {
      this.complete();
      return;
    }

    this.currentWordCard = await this.processIterator.next();
  }

  public getCurrentWord(): WordCard | null {
    return this.currentWordCard;
  }

  public async pass(): Promise<void> {
    if (this.currentWordCard?.showAnswer) {
      // 选项全部错误时，展示答案，继续背该单词
      if (this.currentWordCard?.attemptCount == 0) {
        this.currentWordCard.showAnswer = false;
      } else {
        await this.process();
      }
    } else {
      this.currentWordCard?.pass();
    }
  }

  public async fail(optionId: number): Promise<void> {
    if (!this.currentWordCard) {
      return;
    }

    let failedTimes: number = this.statistics.get(this.currentWordCard.getId()) || 0;
    this.statistics.set(this.currentWordCard?.getId(), failedTimes + 1);
    this.currentWordCard?.fail(optionId);
    this.processIterator.putback(this.currentWordCard.originInfo);
  }
  
  public complete(): void {    
    let studyInfo = {
      totalTimeSpent: Date.now() - this.startTime,
      statistics: this.statistics,
    }
    console.log(studyInfo);
    this.isComplete = true;
  }
}