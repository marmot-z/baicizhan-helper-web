import { ProcessIterator } from './ProcessIterator';
import type { UserRoadMapElementV2 } from '../../types';
import { WordCard } from './WordCard';
import { studyService } from '../studyService';
import { StudyUtils } from './StudyUtils';
import { applyStudyCorrect } from './recordReducers';
import { studyRecordStore } from './recordStore';
import { toPendingDoneRecord } from './uploadAdapter';
import type { StudyStatistcs, StudyUIModel, StudyContext } from './types';
import { useStudyStore } from '../../stores/studyStore';
import type { LearnSessionState } from './sessionTypes';
import { studySessionStore } from './sessionStore';
import { isKilledRecord } from '../../types/studyRecord';
import { wordStatusService } from './wordStatusService';

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
  private onUpload?: (study: Study) => void | Promise<void>;
  private onCheckpoint?: (state: LearnSessionState) => void;
  private listeners: Set<(wordCard: WordCard | null) => void>;
  private killedTopicIds: Set<number>;
  private killInProgress: boolean;
  
  /**
   * 构造函数
   * @param words 学习单词列表(原始数据)
   * @param uiModels UI模型列表(预加载数据)
   * @param context 学习上下文
   */
  constructor(
    words: UserRoadMapElementV2[],
    uiModels: StudyUIModel[],
    context: StudyContext,
    onUpload?: (study: Study) => void | Promise<void>,
    onCheckpoint?: (state: LearnSessionState) => void,
  ) {
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
    this.onCheckpoint = onCheckpoint;
    this.listeners = new Set();
    this.killedTopicIds = new Set();
    this.killInProgress = false;
  }

  public static restore(
    words: UserRoadMapElementV2[],
    uiModels: StudyUIModel[],
    context: StudyContext,
    state: LearnSessionState,
    onCheckpoint?: (state: LearnSessionState) => void,
    onUpload?: (study: Study) => void | Promise<void>,
  ): Study {
    const instance = new Study(words, uiModels, context, onUpload, onCheckpoint);
    const modelsByTopicId = new Map(uiModels.map((model) => [model.topicId, model]));
    instance.processIterator = ProcessIterator.restore(uiModels, state.process);
    if (state.currentCard) {
      const model = modelsByTopicId.get(state.currentCard.topicId);
      if (!model) {
        throw new Error(`Cannot restore study card ${state.currentCard.topicId}`);
      }
      instance.currentWordCard = WordCard.restore(model, state.currentCard);
    }
    instance.failMap = new Map(
      Object.entries(state.failMap).map(([topicId, count]) => [Number(topicId), count]),
    );
    instance.useTimeMap = new Map(
      Object.entries(state.useTimeMap).map(([topicId, time]) => [Number(topicId), time]),
    );
    const persistedKilledTopicIds = state.wordTopicIds.filter((topicId) =>
      isKilledRecord(studyRecordStore.getRecord(context.bookId, topicId)),
    );
    // 草稿记录本会话已经“斩并跳过”的单词，正式记录补充其他入口产生的斩词。
    // 即使用户随后从管理页取消斩词，本轮也不应把未作答的词按普通完成再次结算。
    instance.killedTopicIds = new Set([
      ...(state.killedTopicIds ?? []),
      ...persistedKilledTopicIds,
    ]);
    instance.killedTopicIds.forEach((topicId) => {
      instance.processIterator.removeTopic(topicId);
    });
    if (
      instance.currentWordCard &&
      instance.killedTopicIds.has(instance.currentWordCard.getId())
    ) {
      instance.currentWordCard = null;
    }
    instance.startTime = Date.now() - Math.max(0, state.elapsedTime);
    instance.wordStudyTime = Date.now() - Math.max(0, state.currentWordElapsedTime);
    return instance;
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
    if (!this.completed) {
      this.onCheckpoint?.(this.exportState());
    }
    this.listeners.forEach(listener => listener(this.currentWordCard));
  }
  
  public async start(): Promise<void> {  
    await this.process();
  }

  public async resume(): Promise<void> {
    if (!this.currentWordCard && !this.completed) {
      await this.process();
    }
  }

  public checkpoint(): void {
    if (!this.completed) {
      this.onCheckpoint?.(this.exportState());
    }
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

  private reportWikiShow(): void {
    if (!this.currentWordCard) return;
    studyService.reportEvent(
      'topic_wiki_show',
      JSON.stringify({
        topic_id: this.currentWordCard.getId(),
        book_id: this.words[0]?.word_level_id || 0,
        channel: 'study_mainstream',
        plan_type: this.context.planType
      }),
      'study-detail-common'
    ).catch(console.error);
  }

  private async process(): Promise<void> {
    if (this.currentWordCard) {
      this.useTimeMap.set(this.currentWordCard.getId(), Date.now() - this.wordStudyTime);
    }

    if (!this.processIterator.hasNext()) {
      await this.complete();
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
        if (this.currentWordCard.uiModel.front.options.length) {
          StudyUtils.setCachedOptions(topicId, this.currentWordCard.uiModel.front.options);
        } else {
        const wordInfo = this.words.find(w => w.topic_id === topicId);
        if (wordInfo) {
          // Fire and forget - notify when loaded to update UI
          StudyUtils.loadOptionsForTopic(wordInfo, this.currentWordCard.uiModel).then(() => {
            this.notify();
          }).catch(console.error);
        }
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

  public getAllWords(): StudyUIModel[] {
    return this.processIterator
      .getAllWords()
      .filter((word) => !this.killedTopicIds.has(word.topicId));
  }

  public getKilledTopicIds(): number[] {
    return Array.from(this.killedTopicIds);
  }

  public async killCurrent(): Promise<void> {
    if (!this.currentWordCard || this.killInProgress || this.completed) {
      return;
    }

    this.killInProgress = true;
    const topicId = this.currentWordCard.getId();
    const word = this.words.find((item) => item.topic_id === topicId);
    const elapsed = Math.max(0, Date.now() - this.wordStudyTime);
    const usedTime = (this.useTimeMap.get(topicId) ?? 0) + elapsed;

    try {
      wordStatusService.killWord({
        bookId: this.context.bookId,
        topicId,
        tagId: word?.tag_id,
        usedTime,
        errNumDelta: this.failMap.get(topicId) ?? 0,
        isTodayNew: true,
      });
      this.useTimeMap.set(topicId, usedTime);
      this.killedTopicIds.add(topicId);
      this.processIterator.removeTopic(topicId);
      this.currentWordCard = null;
      this.onCheckpoint?.(this.exportState());
      await this.process();
    } finally {
      this.killInProgress = false;
    }
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
        this.reportWikiShow();
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
    if (result) {
      this.reportWikiShow();
    }
    this.notify();
    return result;
  }

  public getProgress(): number {
    if (this.completed) {
      return 100;
    }

    return parseFloat((
      this.processIterator.getProgress(this.currentWordCard?.getId()) * 100
    ).toFixed(0));
  }

  public exportState(): LearnSessionState {
    return {
      wordTopicIds: this.words.map((word) => word.topic_id),
      process: this.processIterator.exportState(),
      currentCard: this.currentWordCard?.exportState() ?? null,
      failMap: Object.fromEntries(this.failMap),
      useTimeMap: Object.fromEntries(this.useTimeMap),
      elapsedTime: Math.max(0, Date.now() - this.startTime),
      currentWordElapsedTime: this.currentWordCard
        ? Math.max(0, Date.now() - this.wordStudyTime)
        : 0,
      killedTopicIds: Array.from(this.killedTopicIds),
    };
  }
  
  public async complete(): Promise<void> {
    if (this.completed) {
      return;
    }

    // 先把正式记录和待同步队列可靠地写入本地，再清除进行中草稿。
    const updatedRecords = this.writeStudyRecordsToLocal();
    studyRecordStore.queuePendingDoneRecords(
      this.context.bookId,
      updatedRecords.map((record) => toPendingDoneRecord(record)),
    );
    studySessionStore.clear('learn', this.context.bookId);

    const studyStatistics: StudyStatistcs = {
      failMap: Object.fromEntries(this.failMap),
      usedTimeMap: Object.fromEntries(this.useTimeMap),
      totalTime: Date.now() - this.startTime,
      words: this.processIterator.getWordBriefInfos(),
      updateTime: Date.now(),
      killedTopicIds: Array.from(this.killedTopicIds),
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
      studyStatistics.killedTopicIds = Array.from(new Set([
        ...(lastStudyStatistics.killedTopicIds ?? []),
        ...studyStatistics.killedTopicIds!,
      ]));
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

    this.completed = true;
    this.notify();

    // 正式记录已经在本地持久化；远端失败由 pending 队列负责后续补传。
    void useStudyStore.getState().syncCurrentBookState(this.context.bookId);

    if (this.onUpload) {
      await this.onUpload(this);
      this.reportFinishDailyPlan();
      return;
    }

    this.reportFinishDailyPlan();
  }

  private writeStudyRecordsToLocal() {
    if (!this.words.length) {
      return [];
    }

    const now = Date.now();
    const updatedRecords = this.words
      .filter((word) => !this.killedTopicIds.has(word.topic_id))
      .map((word) => {
      const existingRecord = studyRecordStore.getRecord(
        this.context.bookId,
        word.topic_id,
      );
      const wrongTimes = this.failMap.get(word.topic_id) || 0;
      const usedTime = this.useTimeMap.get(word.topic_id) || 0;

      return applyStudyCorrect(existingRecord, {
        bookId: this.context.bookId,
        topicId: word.topic_id,
        tagId: word.tag_id,
        usedTime,
        doNumDelta: 1,
        errNumDelta: wrongTimes,
        now,
        isFirstDoAtToday: true,
        nextScore: Math.max(existingRecord?.topicScore ?? 0, 0),
        nextSpanDays: existingRecord?.topicDay ?? 0,
        nextReviewRound: existingRecord?.reviewRound ?? 0,
      });
    });

    studyRecordStore.upsertRecords(this.context.bookId, updatedRecords);
    const store = useStudyStore.getState();
    store.loadLocalLearnRecords(this.context.bookId);
    store.recomputeHomeState(this.context.bookId);
    return updatedRecords;
  }

  private reportFinishDailyPlan(): void {
    const { homeState } = useStudyStore.getState();
    const currentBook = useStudyStore.getState().currentBook;
    const bookFinished =
      homeState.unlearnedWords.length === 0 &&
      (currentBook ? currentBook.id === this.context.bookId : true);

    studyService
      .reportFinishDailyPlan(
        this.context.bookId,
        this.words.length,
        this.words.length,
        bookFinished,
      )
      .catch(console.error);
  }
}
