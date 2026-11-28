import { accountSession } from '../accountSession';
import { ProcessIterator } from './ProcessIterator';
import type { UserRoadMapElementV2 } from '../../types';
import { WordCard } from './WordCard';
import { studyService } from '../studyService';
import { StudyUtils } from './StudyUtils';
import { applyStudyCorrect } from './recordReducers';
import { studyRecordStore } from './recordStore';
import type { StudyStatistcs, StudyUIModel, StudyContext } from './types';
import { useStudyStore } from '../../stores/studyStore';
import type { LearnSessionState, StudyQuestionState } from './sessionTypes';
import { createStudySessionId, getLocalPlanDate, studySessionStore } from './sessionStore';
import { isKilledRecord } from '../../types/studyRecord';
import { wordStatusService } from './wordStatusService';

/**
 * Study类 - 背单词功能的控制中心
 * 负责管理学习流程和整体状态
 */
export class Study {
  private readonly accountVersion = accountSession.getVersion();
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
  private sessionId = createStudySessionId();
  private question: StudyQuestionState | undefined;
  private answerInProgress = false;
  private paused = false;
  private activeSince = Date.now();
  private completionTask?: Promise<void>;
  
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
    const availableIds = new Set(uiModels.map((model) => model.topicId));
    this.words = words.filter((word) => availableIds.has(word.topic_id));
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
    const skippedTopicIds = new Set(state.wordTopicIds.filter((topicId) => !modelsByTopicId.has(topicId)));
    const keepTopic = (topicId: number) => !skippedTopicIds.has(topicId);
    const { queues } = state.process;
    instance.processIterator = ProcessIterator.restore(uiModels, {
      ...state.process,
      queues: {
        recognition: queues.recognition?.filter(keepTopic) ?? [],
        understanding: queues.understanding?.filter(keepTopic) ?? [],
        mastery: queues.mastery?.filter(keepTopic) ?? [],
      },
    });

    if (state.currentCard && keepTopic(state.currentCard.topicId)) {
      const model = modelsByTopicId.get(state.currentCard.topicId);
      if (!model) {
        throw new Error(`Cannot restore study card ${state.currentCard.topicId}`);
      }
      instance.currentWordCard = WordCard.restore(model, state.currentCard);
    }
    instance.failMap = new Map(
      Object.entries(state.failMap)
        .filter(([topicId]) => keepTopic(Number(topicId)))
        .map(([topicId, count]) => [Number(topicId), count]),
    );
    instance.useTimeMap = new Map(
      Object.entries(state.useTimeMap)
        .filter(([topicId]) => keepTopic(Number(topicId)))
        .map(([topicId, time]) => [Number(topicId), time]),
    );
    const persistedKilledTopicIds = instance.words
      .filter((word) => isKilledRecord(studyRecordStore.getRecord(context.bookId, word.topic_id)))
      .map((word) => word.topic_id);
    // 草稿记录本会话已经“斩并跳过”的单词，正式记录补充其他入口产生的斩词。
    // 即使用户随后从管理页取消斩词，本轮也不应把未作答的词按普通完成再次结算。
    instance.killedTopicIds = new Set([
      ...(state.killedTopicIds ?? []).filter(keepTopic),
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
    instance.sessionId = state.sessionId;
    instance.question = state.question ? { ...state.question } : undefined;
    instance.activeSince = Date.now();
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
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

    if (!this.completed) {
      this.onCheckpoint?.(this.exportState());
    }
    this.listeners.forEach(listener => listener(this.currentWordCard));
  }
  
  public async start(): Promise<void> {  
    await this.process();
  }

  public async resume(): Promise<void> {
    if (this.question?.committed && this.currentWordCard && !this.currentWordCard.showAnswer) {
      await this.process();
      return;
    }
    if (!this.question && this.currentWordCard) this.beginQuestion();
    if (!this.currentWordCard && !this.completed) {
      await this.process();
    } else if (this.currentWordCard) {
      this.loadCurrentOptions();
      this.checkpoint();
    }
  }

  public checkpoint(): void {
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

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

  public getCurrentQuestionId(): string | undefined {
    return this.question?.questionId;
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    if (!this.paused && this.question && !this.question.committed) {
      this.question.elapsedTime += Math.max(0, Date.now() - this.activeSince);
    }
    this.paused = paused;
    this.activeSince = Date.now();
    this.checkpoint();
  }

  private beginQuestion(): void {
    if (!this.currentWordCard) { this.question = undefined; return; }
    this.question = {
      questionId: `${this.sessionId}:${createStudySessionId()}`,
      topicId: this.currentWordCard.getId(),
      phase: this.currentWordCard.stage,
      hadWrong: false,
      elapsedTime: 0,
      committed: false,
    };
    this.activeSince = Date.now();
  }

  private questionElapsed(): number {
    if (!this.question) return 0;
    return this.question.elapsedTime + (!this.paused && !this.question.committed
      ? Math.max(0, Date.now() - this.activeSince) : 0);
  }

  private restoreCheckpoint(state: LearnSessionState): void {
    const restored = Study.restore(this.words, this.processIterator.getAllWords(), this.context, state);
    this.processIterator = restored.processIterator;
    this.currentWordCard = restored.currentWordCard;
    this.failMap = restored.failMap;
    this.useTimeMap = restored.useTimeMap;
    this.killedTopicIds = restored.killedTopicIds;
    this.question = restored.question;
    this.activeSince = Date.now();
  }

  private async commitAnswer(before: LearnSessionState): Promise<void> {
    if (!this.currentWordCard || !this.question || this.question.committed) return;
    const topicId = this.currentWordCard.getId();
    const elapsed = this.questionElapsed();
    this.question.elapsedTime = elapsed;
    this.question.committed = true;
    this.useTimeMap.set(topicId, (this.useTimeMap.get(topicId) ?? 0) + elapsed);
    const word = this.words.find((item) => item.topic_id === topicId);
    try {
      await studyRecordStore.commitQuestionResult({
        bookId: this.context.bookId,
        topicId,
        eventId: this.question.questionId,
        mutate: (existing) => applyStudyCorrect(existing, {
          bookId: this.context.bookId, topicId, tagId: word?.tag_id,
          usedTime: elapsed, doNumDelta: 1, errNumDelta: this.question?.hadWrong ? 1 : 0,
          now: Date.now(), isFirstDoAtToday: existing?.isTodayNew ?? true,
          nextScore: Math.max(existing?.topicScore ?? 0, 0),
          nextSpanDays: 0, nextReviewRound: existing?.reviewRound ?? 0,
        }),
        checkpoint: studySessionStore.buildCheckpoint('learn', this.context.bookId, this.exportState()),
      });
      accountSession.assertCurrent(this.accountVersion);
      const store = useStudyStore.getState();
      store.loadLocalLearnRecords(this.context.bookId);
      store.recomputeHomeState(this.context.bookId);
    } catch (error) {
      this.restoreCheckpoint(before);
      this.listeners.forEach((listener) => listener(this.currentWordCard));
      throw error;
    }
  }

  private async process(): Promise<void> {
    if (!this.processIterator.hasNext()) {
      await this.complete();
      return;
    }    

    this.currentWordCard = this.processIterator.next();
    this.beginQuestion();
    
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

      this.loadCurrentOptions();
    }

    this.wordStudyTime = Date.now();
    this.notify();
  }

  private loadCurrentOptions(): void {
    const card = this.currentWordCard;
    if (!card || StudyUtils.getCachedOptions(card.getId())) {
      return;
    }

    const { options } = card.uiModel.front;
    if (options.length > 0) {
      StudyUtils.setCachedOptions(card.getId(), options);
      return;
    }

    const word = this.words.find((item) => item.topic_id === card.getId());
    if (word) {
      StudyUtils.loadOptionsForTopic(word, card.uiModel).then(() => {
        if (this.currentWordCard === card) {
          this.notify();
        }
      }).catch(console.error);
    }
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
    if (this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || !this.currentWordCard || this.killInProgress || this.answerInProgress || this.completed) return;
    this.killInProgress = true;
    const before = this.exportState();
    const topicId = this.currentWordCard.getId();
    const word = this.words.find((item) => item.topic_id === topicId);
    const usedTime = this.question?.committed ? 0 : this.questionElapsed();
    try {
      this.killedTopicIds.add(topicId);
      this.processIterator.removeTopic(topicId);
      this.currentWordCard = null;
      const eventId = `${this.question?.questionId ?? this.sessionId}:kill`;
      if (this.question) { this.question.elapsedTime = usedTime; this.question.committed = true; }
      await wordStatusService.killWord({
        bookId: this.context.bookId, topicId, tagId: word?.tag_id,
        usedTime, errNumDelta: 0, isTodayNew: true, eventId,
        checkpoint: studySessionStore.buildCheckpoint('learn', this.context.bookId, this.exportState()),
      });
      this.useTimeMap.set(topicId, (this.useTimeMap.get(topicId) ?? 0) + usedTime);
      await this.process();
    } catch (error) {
      this.restoreCheckpoint(before);
      this.listeners.forEach((listener) => listener(this.currentWordCard));
      throw error;
    } finally { this.killInProgress = false; }
  }

  public getFailMap(): Map<number, number> {
    return this.failMap;
  }

  public getUseTimeMap(): Map<number, number> {
    return this.useTimeMap;
  }

  public async continueFromDetail(expectedQuestionId?: string): Promise<void> {
    if (!this.currentWordCard?.showAnswer) return;
    await this.pass(undefined, expectedQuestionId);
  }

  public async pass(choiceTopicId?: number, expectedQuestionId?: string): Promise<void> {
    if (this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || !this.currentWordCard || this.answerInProgress || this.killInProgress
      || (expectedQuestionId !== undefined && expectedQuestionId !== this.question?.questionId)) return;
    this.answerInProgress = true;
    try {
      if (this.currentWordCard.showAnswer) {
        if (choiceTopicId !== undefined) return;
        if (this.currentWordCard.attemptCount === 0) {
          this.currentWordCard.showAnswer = false;
          this.beginQuestion();
          this.notify();
        } else await this.process();
        return;
      }
      if (!this.question) this.beginQuestion();
      if (this.question?.committed) return;
      const before = this.exportState();
      if (choiceTopicId !== undefined) {
        void studyService.reportEvent('choose_in_recite_click', JSON.stringify({
          topic_id: this.currentWordCard.getId(), strategy_id: this.getCurrentStrategyId(),
          choice_topic_id: choiceTopicId, is_right: 1, plan_type: this.context.planType,
        }), 'study-detail-common').catch(console.error);
      }
      const skipDetail = this.currentWordCard.stage !== 'recognition'
        && !this.failMap.has(this.currentWordCard.getId());
      if (!skipDetail) this.currentWordCard.pass();
      await this.commitAnswer(before);
      if (skipDetail) await this.process();
      else { this.reportWikiShow(); this.notify(); }
    } finally { this.answerInProgress = false; }
  }

  public async fail(optionId: number, expectedQuestionId?: string): Promise<boolean> {
    if (this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || !this.currentWordCard || this.currentWordCard.showAnswer || this.question?.committed
      || this.answerInProgress || this.killInProgress
      || (expectedQuestionId !== undefined && expectedQuestionId !== this.question?.questionId)) return false;
    if (this.currentWordCard.clickedOptionIds.has(optionId)) return false;
    this.answerInProgress = true;
    try {
      if (!this.question) this.beginQuestion();
      const before = this.exportState();
      void studyService.reportEvent('choose_in_recite_click', JSON.stringify({
        topic_id: this.currentWordCard.getId(), strategy_id: this.getCurrentStrategyId(),
        choice_topic_id: optionId, is_right: 0, plan_type: this.context.planType,
      }), 'study-detail-common').catch(console.error);
      const topicId = this.currentWordCard.getId();
      this.failMap.set(topicId, (this.failMap.get(topicId) ?? 0) + 1);
      if (this.question) this.question.hadWrong = true;
      this.processIterator.putback(this.currentWordCard.uiModel);
      const result = this.currentWordCard.fail(optionId);
      if (result) { await this.commitAnswer(before); this.reportWikiShow(); }
      this.notify();
      return result;
    } finally { this.answerInProgress = false; }
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
      sessionId: this.sessionId,
      question: this.question ? { ...this.question, elapsedTime: this.questionElapsed() } : undefined,
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
  
  public complete(): Promise<void> {
    if (!this.completionTask) {
      this.completionTask = this.finishComplete().catch((error) => {
        this.completionTask = undefined;
        throw error;
      });
    }
    return this.completionTask;
  }

  private async finishComplete(): Promise<void> {
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

    if (this.completed) {
      return;
    }

    await studySessionStore.clear('learn', this.context.bookId);

    const studyStatistics: StudyStatistcs = {
      failMap: Object.fromEntries(this.failMap),
      usedTimeMap: Object.fromEntries(this.useTimeMap),
      totalTime: Array.from(this.useTimeMap.values()).reduce((sum, time) => sum + time, 0),
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
      const date = getLocalPlanDate();
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
    void useStudyStore.getState().syncCurrentBookState(this.context.bookId).then((result) => {
      if (result?.upload === 'synced') this.reportFinishDailyPlan();
    }).catch(console.error);

    if (this.onUpload) {
      await this.onUpload(this);
      return;
    }

  }

  private reportFinishDailyPlan(): void {
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

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
