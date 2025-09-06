import { ProcessIterator } from './ProcessIterator';
import type { UserRoadMapElementV2, UserDoneWordRecord } from '../../types';
import type { WordCard } from './WordCard';
import { studyService } from '../studyService';
import type { StudyStatistcs } from './types';
import { useStudyStore } from '../../stores/studyStore';

/**
 * Study类 - 背单词功能的控制中心
 * 负责管理学习流程和整体状态
 */
export class Study {
  private processIterator: ProcessIterator;
  private currentWordCard: WordCard | null;
  private failMap: Map<number, number>;
  private useTimeMap: Map<number, number>;
  private words: UserRoadMapElementV2[];
  private wordStudyTime: number;
  private startTime: number;
  public completed: boolean;
  
  /**
   * 构造函数
   * @param words 学习单词列表
   */
  constructor(words: UserRoadMapElementV2[]) {
    this.processIterator = new ProcessIterator(words);
    this.currentWordCard = null;
    this.failMap = new Map();
    this.useTimeMap = new Map();
    this.words = words;
    this.wordStudyTime = Date.now();
    this.completed = false;
    this.startTime = Date.now();
  }
  
  public async start(): Promise<void> {  
    await this.process();
  }

  private async process(): Promise<void> {
    if (this.currentWordCard) {
      this.useTimeMap.set(this.currentWordCard.getId(), Date.now() - this.wordStudyTime);
    }

    if (!this.processIterator.hasNext()) {
      this.complete();
      return;
    }    

    this.currentWordCard = await this.processIterator.next();
    this.wordStudyTime = Date.now();
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

    let failedTimes = this.failMap.get(this.currentWordCard.getId()) || 0;
    this.failMap.set(this.currentWordCard?.getId(), failedTimes + 1);
    this.currentWordCard?.fail(optionId);
    this.processIterator.putback(this.currentWordCard.originInfo);
  }

  public getProgress(): number {
    return parseFloat((this.processIterator.getProgress() * 100).toFixed(0));
  }
  
  public complete(): void {
    this.completed = true;
    const studyStatistics: StudyStatistcs = {
      failMap: Object.fromEntries(this.failMap),
      usedTimeMap: Object.fromEntries(this.useTimeMap),
      totalTime: Date.now() - this.startTime,
      words: this.processIterator.getWordBriefInfos()
    };
    
    // 存储学习统计信息到 studyStore
    const { setLastStudyStatistics } = useStudyStore.getState();
    setLastStudyStatistics(studyStatistics);
    
    this.uploadDoneData();
  }

  private uploadDoneData(): void {
    const doneWordRecords: UserDoneWordRecord[] = this.words.map(word => {
      const wrongTimes = this.failMap.get(word.topic_id) || 0;
      const usedTime = this.useTimeMap.get(word.topic_id) || 0;
      
      return {
        word_topic_id: word.topic_id,
        current_score: 0, // 默认分数
        span_days: 0, // 默认间隔天数
        used_time: usedTime, // 默认用时
        done_times: 1, // 固定为1
        wrong_times: wrongTimes, // 从statistics map中获取
        is_first_do_at_today: 1, // 默认为今天首次完成
        tag_id: word.tag_id,
        spell_score: 0, // 默认拼写分数
        listening_score: 0, // 默认听力分数
        chn_score: 0, // 默认中文分数
        review_round: 0 // 默认复习轮次
      };
    });
    
    studyService.updateDoneData(doneWordRecords, this.words[0]?.word_level_id || 0);
  }
}