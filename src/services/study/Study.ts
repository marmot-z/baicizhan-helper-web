import { ProcessIterator } from './ProcessIterator';
import type { UserRoadMapElementV2, UserDoneWordRecord } from '../../types';
import type { WordCard } from './WordCard';
import { studyService } from '../studyService';
import { StudyUtils } from './StudyUtils';
import type { StudyStatistcs, StudyUIModel, StudyContext } from './types';
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
  private context: StudyContext;
  private wordStudyTime: number;
  private startTime: number;
  public completed: boolean;
  private onUpload?: (study: Study) => void;
  private listeners: Set<(wordCard: WordCard | null) => void>;
  
  /**
   * 构造函数
   * @param words 学习单词列表(原始数据)
   * @param uiModels UI模型列表(预加载数据)
   * @param context 学习上下文
   */
  constructor(words: UserRoadMapElementV2[], uiModels: StudyUIModel[], context: StudyContext, onUpload?: (study: Study) => void) {
    this.processIterator = new ProcessIterator(uiModels);
    this.currentWordCard = null;
    this.failMap = new Map();
    this.useTimeMap = new Map();
    this.words = words;
    this.context = context;
    this.wordStudyTime = Date.now();
    this.completed = false;
    this.startTime = Date.now();
    this.onUpload = onUpload;
    this.listeners = new Set();
  }
  
  public subscribe(listener: (wordCard: WordCard | null) => void): () => void {
    this.listeners.add(listener);
    // 立即回调当前状态
    listener(this.currentWordCard);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.currentWordCard));
  }
  
  public async start(): Promise<void> {  
    await this.process();
  }

  private getCurrentStrategyId(): string {
    if (!this.currentWordCard) {
      return 'q1';
    }
    
    switch (this.currentWordCard.stage) {
      case 'recognition':
        return 'q1';
      case 'understanding':
        return 'q2';
      case 'mastery':
        return 'q3';
      default:
        return 'q1';
    }
  }

  private async process(): Promise<void> {
    if (this.currentWordCard) {
      this.useTimeMap.set(this.currentWordCard.getId(), Date.now() - this.wordStudyTime);
    }

    if (!this.processIterator.hasNext()) {
      this.complete();
      return;
    }    

    this.currentWordCard = this.processIterator.next();
    
    // Progressive Option Loading: Check and load options if missing
    if (this.currentWordCard) {
      const topicId = this.currentWordCard.getId();
      
      // Report event: strategy_study_enter
      studyService.reportEvent(
        'strategy_study_enter',
        JSON.stringify({
          topic_id: topicId,
          strategy_id: this.getCurrentStrategyId(),
          plan_type: this.context.planType
        }),
        'study-detail-common'
      ).catch(console.error);

      if (!StudyUtils.getCachedOptions(topicId)) {
        const wordInfo = this.words.find(w => w.topic_id === topicId);
        if (wordInfo) {
          // Fire and forget - notify when loaded to update UI
          StudyUtils.loadOptionsForTopic(wordInfo, this.currentWordCard.uiModel).then(() => {
            this.notify();
          }).catch(console.error);
        }
      }
    }

    this.wordStudyTime = Date.now();
    this.notify();
  }

  public getCurrentWord(): WordCard | null {
    return this.currentWordCard;
  }

  public getWords(): UserRoadMapElementV2[] {
    return this.words;
  }

  public getFailMap(): Map<number, number> {
    return this.failMap;
  }

  public getUseTimeMap(): Map<number, number> {
    return this.useTimeMap;
  }

  public async pass(choiceTopicId?: number): Promise<void> {
    // Report event: choose_in_recite_click (correct)
    if (choiceTopicId !== undefined && this.currentWordCard) {
      studyService.reportEvent(
        'choose_in_recite_click',
        JSON.stringify({
          topic_id: this.currentWordCard.getId(),
          strategy_id: this.getCurrentStrategyId(),
          choice_topic_id: choiceTopicId,
          is_right: 1,
          plan_type: this.context.planType
        }),
        'study-detail-common'
      ).catch(console.error);
    }

    // 当前为反面
    if (this.currentWordCard?.showAnswer) {
      // 选项全部错误时，展示答案，继续背该单词
      if (this.currentWordCard?.attemptCount == 0) {
        this.currentWordCard.showAnswer = false;
        this.notify();
      } 
      // 下一个单词
      else {
        await this.process();
      }
    } 
    // 当前为正面
    else {
      // 第二三个环节，如果没有选错，则不展示单词详情，直接下一个单词
      if (this.currentWordCard?.stage != 'recognition' &&
         !this.failMap.has(this.currentWordCard?.getId() || 0)) {        
        await this.process();
      } 
      // 反面，显示反面
      else {
        this.currentWordCard?.pass();
        this.notify();
      }
    }
  }

  public async fail(optionId: number): Promise<boolean> {
    if (!this.currentWordCard) {
      return false;
    }

    // Report event: choose_in_recite_click (wrong)
    studyService.reportEvent(
      'choose_in_recite_click',
      JSON.stringify({
        topic_id: this.currentWordCard.getId(),
        strategy_id: this.getCurrentStrategyId(),
        choice_topic_id: optionId,
        is_right: 0,
        plan_type: this.context.planType
      }),
      'study-detail-common'
    ).catch(console.error);

    const failedTimes = this.failMap.get(this.currentWordCard.getId()) || 0;
    this.failMap.set(this.currentWordCard?.getId(), failedTimes + 1);
    this.processIterator.putback(this.currentWordCard.uiModel);
    const result = this.currentWordCard?.fail(optionId);
    this.notify();
    return result;
  }

  public getProgress(): number {
    return parseFloat((this.processIterator.getProgress() * 100).toFixed(0));
  }
  
  public complete(): void {
    this.completed = true;
    this.notify();
    const studyStatistics: StudyStatistcs = {
      failMap: Object.fromEntries(this.failMap),
      usedTimeMap: Object.fromEntries(this.useTimeMap),
      totalTime: Date.now() - this.startTime,
      words: this.processIterator.getWordBriefInfos(),
      updateTime: Date.now(),
    };
    
    // 保存学习统计信息
    // 如果今天已学习过单词，合并统计数据
    const { lastStudyStatistics } = useStudyStore.getState();
    const beginOfToday = new Date().setHours(0, 0, 0, 0);    
    if (lastStudyStatistics?.updateTime && lastStudyStatistics.updateTime > beginOfToday) {
      studyStatistics.failMap = {
        ...lastStudyStatistics.failMap,
        ...studyStatistics.failMap,
      };
      studyStatistics.usedTimeMap = {
        ...lastStudyStatistics.usedTimeMap,
        ...studyStatistics.usedTimeMap,
      };
      studyStatistics.totalTime += lastStudyStatistics.totalTime;
      studyStatistics.words = [...lastStudyStatistics.words, ...studyStatistics.words];
    }

    useStudyStore.getState().setLastStudyStatistics(studyStatistics);

    // XMode 打卡逻辑
    try {
      const date = new Date().toISOString().split('T')[0];
      const finalStats = useStudyStore.getState().lastStudyStatistics;
      const totalCount = finalStats?.words.length || 0;
      
      // 只有在新词学习模式下才进行打卡，或者根据需求在所有模式下都打卡
      // 这里根据之前的讨论，count 是今日学习新单词的总量
      // 假设所有模式下学完都进行打卡同步进度
      studyService.xModeDaka(totalCount, date).catch(console.error);
    } catch (error) {
      console.error('打卡逻辑执行失败:', error);
    }
    
    // Report event: finish-normal-plan
    studyService.reportEvent(
      'finish-normal-plan',
      JSON.stringify({
        plan_type: this.context.planType
      }),
      'main-study'
    ).catch(console.error);

    // Report event: review_midpage_view
    studyService.reportEvent(
      'review_midpage_view',
      JSON.stringify({
        mode_type: 3
      }),
      'main-study'
    ).catch(console.error);

    if (this.onUpload) {
      this.onUpload(this);
      return;
    }
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
