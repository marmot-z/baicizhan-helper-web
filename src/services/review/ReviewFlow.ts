import type { StudyOption, StudyUIModel } from '../study/types';
import { studyService } from '../studyService';
import { feedbackSoundPlayer } from '../../utils/feedbackSound';
import { reviewService } from './reviewService';
import type {
  ReviewChoiceOptionView,
  ReviewDetailReason,
  ReviewInitData,
  ReviewSnapshot,
  ReviewSummaryState,
  ReviewWordRecord,
} from './types';
import type { ReviewSessionState } from '../study/sessionTypes';
import { studySessionStore } from '../study/sessionStore';
import { studyRecordStore } from '../study/recordStore';
import { wordStatusService } from '../study/wordStatusService';
import { isKilledRecord } from '../../types/studyRecord';

const createInitialSnapshot = (): ReviewSnapshot => ({
  stage: 'loading',
  totalWords: 0,
  completedChoiceWords: 0,
  completedSpellWords: 0,
  choiceState: null,
  detailState: null,
  spellState: null,
  summaryState: null,
  errorMessage: null,
});

export class ReviewFlow {
  private snapshot: ReviewSnapshot = createInitialSnapshot();
  private listeners = new Set<(snapshot: ReviewSnapshot) => void>();
  private records = new Map<number, ReviewWordRecord>();
  private allWords: StudyUIModel[];
  private roadmapMap: ReviewInitData['roadmapMap'];
  private context: ReviewInitData['context'];
  private onCheckpoint?: (state: ReviewSessionState) => void;
  private killedTopicIds = new Set<number>();
  private killInProgress = false;

  private choiceQueue: StudyUIModel[];
  private choiceRetryQueue: StudyUIModel[] = [];
  private choiceRetrySet = new Set<number>();
  private currentChoiceWord: StudyUIModel | null = null;
  private currentChoiceOptions: StudyOption[] = [];
  private currentChoiceAttemptCount = 0;
  private currentChoiceClickedOptionIds = new Set<number>();

  private detailWord: StudyUIModel | null = null;
  private detailReason: ReviewDetailReason | null = null;

  private spellQueue: StudyUIModel[] = [];
  private spellRetryQueue: StudyUIModel[] = [];
  private spellRetrySet = new Set<number>();
  private currentSpellWord: StudyUIModel | null = null;
  private currentSpellWrong = false;

  constructor(
    initData: ReviewInitData,
    onCheckpoint?: (state: ReviewSessionState) => void,
    restoredState?: ReviewSessionState,
  ) {
    this.allWords = initData.words;
    this.choiceQueue = [...initData.words];
    this.roadmapMap = initData.roadmapMap;
    this.context = initData.context;
    this.onCheckpoint = onCheckpoint;

    initData.words.forEach((word) => {
      this.records.set(word.topicId, {
        topicId: word.topicId,
        word: word.word,
        errorCount: 0,
        completedAt: null,
        reviewStartedAt: null,
        savedStudyRecord: false,
        choicePassed: false,
        spellingPassed: false,
        choiceFailed: false,
        spellingFailed: false,
      });
    });

    this.snapshot = {
      ...createInitialSnapshot(),
      totalWords: initData.words.length,
    };

    if (restoredState) {
      this.restoreState(restoredState);
    }
  }

  static restore(
    initData: ReviewInitData,
    state: ReviewSessionState,
    onCheckpoint?: (state: ReviewSessionState) => void,
  ): ReviewFlow {
    return new ReviewFlow(initData, onCheckpoint, state);
  }

  subscribe(listener: (snapshot: ReviewSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): ReviewSnapshot {
    return this.snapshot;
  }

  async resume(): Promise<void> {
    if (this.snapshot.stage === 'choice' && !this.currentChoiceWord) {
      await this.advanceChoiceQueue();
      return;
    }

    if (this.snapshot.stage === 'detail' && !this.detailWord) {
      if (this.detailReason === 'spell_error') {
        await this.advanceSpellQueue();
      } else {
        await this.advanceChoiceQueue();
      }
      return;
    }

    if (this.snapshot.stage === 'spelling' && !this.currentSpellWord) {
      await this.advanceSpellQueue();
      return;
    }

    if (
      this.snapshot.stage === 'spelling' &&
      this.currentSpellWord &&
      this.mustGetRecord(this.currentSpellWord.topicId).spellingPassed
    ) {
      await this.advanceSpellQueue();
      return;
    }

    if (
      this.snapshot.stage === 'choice' &&
      this.currentChoiceWord &&
      this.mustGetRecord(this.currentChoiceWord.topicId).choicePassed
    ) {
      await this.advanceChoiceQueue();
      return;
    }

    if (this.snapshot.stage !== 'choice' || !this.currentChoiceWord) {
      this.checkpoint();
      return;
    }

    const savedOptionIds = this.currentChoiceOptions.map((option) => option.id);
    const options = await reviewService.getChoiceOptions(this.currentChoiceWord);
    const optionsById = new Map(options.map((option) => [option.id, option]));
    const ordered = savedOptionIds.map((id) => optionsById.get(id)).filter(Boolean) as StudyOption[];
    this.currentChoiceOptions = ordered.length === options.length ? ordered : options;
    this.updateChoiceSnapshot(false);
  }

  exportState(): ReviewSessionState {
    return {
      wordTopicIds: this.allWords.map((word) => word.topicId),
      ...(this.killedTopicIds.size > 0
        ? { killedTopicIds: Array.from(this.killedTopicIds) }
        : {}),
      stage: this.snapshot.stage,
      completedChoiceWords: this.snapshot.completedChoiceWords,
      completedSpellWords: this.snapshot.completedSpellWords,
      records: Array.from(this.records.values()).map((record) => ({ ...record })),
      choiceQueueTopicIds: this.choiceQueue.map((word) => word.topicId),
      choiceRetryQueueTopicIds: this.choiceRetryQueue.map((word) => word.topicId),
      choiceRetryTopicIds: Array.from(this.choiceRetrySet),
      currentChoiceTopicId: this.currentChoiceWord?.topicId ?? null,
      currentChoiceOptionIds: this.currentChoiceOptions.map((option) => option.id),
      currentChoiceAttemptCount: this.currentChoiceAttemptCount,
      currentChoiceClickedOptionIds: Array.from(this.currentChoiceClickedOptionIds),
      detailTopicId: this.detailWord?.topicId ?? null,
      detailReason: this.detailReason,
      spellQueueTopicIds: this.spellQueue.map((word) => word.topicId),
      spellRetryQueueTopicIds: this.spellRetryQueue.map((word) => word.topicId),
      spellRetryTopicIds: Array.from(this.spellRetrySet),
      currentSpellTopicId: this.currentSpellWord?.topicId ?? null,
      currentSpellWrong: this.currentSpellWrong,
    };
  }

  checkpoint(): void {
    if (['choice', 'detail', 'spelling'].includes(this.snapshot.stage)) {
      this.onCheckpoint?.(this.exportState());
    }
  }

  async start(): Promise<void> {
    if (!this.allWords.length) {
      this.setSnapshot({
        stage: 'empty',
        choiceState: null,
        detailState: null,
        spellState: null,
        summaryState: null,
        errorMessage: null,
      });
      return;
    }

    await this.enterChoiceWord(this.choiceQueue.shift() || null);
  }

  async chooseOption(optionId: number): Promise<void> {
    if (this.killInProgress || !this.currentChoiceWord || this.snapshot.stage !== 'choice') {
      return;
    }

    if (this.currentChoiceClickedOptionIds.has(optionId)) {
      return;
    }

    const option = this.currentChoiceOptions.find((item) => item.id === optionId);
    if (!option) {
      return;
    }

    const record = this.mustGetRecord(this.currentChoiceWord.topicId);

    if (option.isCorrect) {
      feedbackSoundPlayer.playCorrect();
      reviewService
        .reportChoiceResult(this.currentChoiceWord, optionId, true)
        .catch(console.error);

      if (this.currentChoiceAttemptCount >= 1) {
        this.enterDetail(this.currentChoiceWord, 'choice_retry');
        return;
      }

      record.choicePassed = true;
      this.syncProgress();
      await this.advanceChoiceQueue();
      return;
    }

    feedbackSoundPlayer.playIncorrect();
    this.currentChoiceAttemptCount += 1;
    this.currentChoiceClickedOptionIds.add(optionId);
    record.errorCount += 1;
    record.choiceFailed = true;
    this.enqueueChoiceRetry(this.currentChoiceWord);

    reviewService
      .reportChoiceResult(this.currentChoiceWord, optionId, false)
      .catch(console.error);

    if (this.currentChoiceAttemptCount > 2) {
      this.enterDetail(this.currentChoiceWord, 'choice_max_errors');
      return;
    }

    this.updateChoiceSnapshot(false);
  }

  async continueFromDetail(): Promise<void> {
    if (
      this.killInProgress ||
      this.snapshot.stage !== 'detail' ||
      !this.detailWord ||
      !this.detailReason
    ) {
      return;
    }

    if (this.detailReason === 'spell_error') {
      await this.advanceSpellQueue();
      return;
    }

    await this.advanceChoiceQueue();
  }

  async submitSpell(input: string): Promise<void> {
    if (this.killInProgress || !this.currentSpellWord || this.snapshot.stage !== 'spelling') {
      return;
    }

    if (this.currentSpellWrong) {
      return;
    }

    const normalizedInput = input.trim().toLowerCase();
    const normalizedWord = this.currentSpellWord.word.trim().toLowerCase();
    const isCorrect = normalizedInput === normalizedWord;
    const record = this.mustGetRecord(this.currentSpellWord.topicId);

    if (isCorrect) {
      feedbackSoundPlayer.playCorrect();
      const completedAt = Date.now();
      record.spellingPassed = true;
      record.completedAt = completedAt;
      this.checkpoint();

      reviewService
        .reportSpellResult(this.currentSpellWord, true)
        .catch(console.error);

      if (!record.choiceFailed && !record.spellingFailed && !record.savedStudyRecord) {
        const startedAt = record.reviewStartedAt ?? completedAt;
        const costMilliseconds = Math.max(0, completedAt - startedAt);
        await studyService
          .saveStudyRecord(this.context.bookId, this.currentSpellWord.topicId, costMilliseconds)
          .catch(console.error);
        record.savedStudyRecord = true;
        this.checkpoint();
      }

      this.syncProgress();
      await this.advanceSpellQueue();
      return;
    }

    feedbackSoundPlayer.playIncorrect();
    record.errorCount += 1;
    record.spellingFailed = true;
    this.currentSpellWrong = true;
    this.enqueueSpellRetry(this.currentSpellWord);

    reviewService
      .reportSpellResult(this.currentSpellWord, false)
      .catch(console.error);

    this.setSnapshot({
      stage: 'spelling',
      choiceState: null,
      detailState: null,
      summaryState: null,
      errorMessage: null,
      spellState: {
        word: this.currentSpellWord,
        isWrong: true,
        remainingInRound: this.spellQueue.length,
        retryCount: this.spellRetryQueue.length,
      },
    });
  }

  clearSpellWrongOnInput(): void {
    if (
      this.killInProgress ||
      this.snapshot.stage !== 'spelling' ||
      !this.currentSpellWord ||
      !this.currentSpellWrong ||
      !this.snapshot.spellState
    ) {
      return;
    }

    this.currentSpellWrong = false;
    this.setSnapshot({
      spellState: {
        ...this.snapshot.spellState,
        isWrong: false,
      },
    });
  }

  private setSnapshot(patch: Partial<ReviewSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
    };
    this.checkpoint();
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private restoreState(state: ReviewSessionState): void {
    const wordsByTopicId = new Map(this.allWords.map((word) => [word.topicId, word]));
    const getWord = (topicId: number | null): StudyUIModel | null => {
      if (topicId === null) return null;
      const word = wordsByTopicId.get(topicId);
      if (!word) throw new Error(`Cannot restore review word ${topicId}`);
      return word;
    };
    const getWords = (topicIds: number[]): StudyUIModel[] =>
      topicIds.map((topicId) => {
        const word = getWord(topicId);
        if (!word) throw new Error(`Cannot restore review queue word ${topicId}`);
        return word;
      });

    this.records = new Map(state.records.map((record) => [record.topicId, { ...record }]));
    if (this.allWords.some((word) => !this.records.has(word.topicId))) {
      throw new Error('Cannot restore review records: missing word record');
    }
    this.choiceQueue = getWords(state.choiceQueueTopicIds);
    this.choiceRetryQueue = getWords(state.choiceRetryQueueTopicIds);
    this.choiceRetrySet = new Set(state.choiceRetryTopicIds);
    this.currentChoiceWord = getWord(state.currentChoiceTopicId);
    this.currentChoiceAttemptCount = state.currentChoiceAttemptCount;
    this.currentChoiceClickedOptionIds = new Set(state.currentChoiceClickedOptionIds);
    const choiceOptions = this.currentChoiceWord?.front.options ?? [];
    const choiceOptionsById = new Map(choiceOptions.map((option) => [option.id, option]));
    this.currentChoiceOptions = state.currentChoiceOptionIds
      .map((id) => choiceOptionsById.get(id))
      .filter(Boolean) as StudyOption[];
    this.detailWord = getWord(state.detailTopicId);
    this.detailReason = state.detailReason;
    this.spellQueue = getWords(state.spellQueueTopicIds);
    this.spellRetryQueue = getWords(state.spellRetryQueueTopicIds);
    this.spellRetrySet = new Set(state.spellRetryTopicIds);
    this.currentSpellWord = getWord(state.currentSpellTopicId);
    this.currentSpellWrong = state.currentSpellWrong;
    const persistedKilledTopicIds = this.allWords
      .filter((word) =>
        isKilledRecord(studyRecordStore.getRecord(this.context.bookId, word.topicId)),
      )
      .map((word) => word.topicId);
    this.killedTopicIds = new Set([
      ...(state.killedTopicIds ?? []),
      ...persistedKilledTopicIds,
    ]);
    this.killedTopicIds.forEach((topicId) => this.removeTopicFromQueues(topicId));

    this.snapshot = {
      ...createInitialSnapshot(),
      stage: state.stage,
      totalWords: this.allWords.length,
      completedChoiceWords: this.getCompletedChoiceWords(),
      completedSpellWords: this.getCompletedSpellWords(),
    };

    if (state.stage === 'choice' && this.currentChoiceWord) {
      this.snapshot.choiceState = {
        word: this.currentChoiceWord,
        options: this.decorateChoiceOptions(this.currentChoiceOptions),
        selectedOptionIds: Array.from(this.currentChoiceClickedOptionIds),
        attemptCount: this.currentChoiceAttemptCount,
        isOptionsLoading: this.currentChoiceOptions.length === 0,
        remainingInRound: this.choiceQueue.length,
        retryCount: this.choiceRetryQueue.length,
        showWord: true,
        showSentence: true,
        showTranslation: this.currentChoiceAttemptCount === 1,
        showEnglishTranslation: this.currentChoiceAttemptCount === 2,
      };
    } else if (state.stage === 'detail' && this.detailWord && this.detailReason) {
      this.snapshot.detailState = {
        word: this.detailWord,
        reason: this.detailReason,
        nextLabel: this.detailReason === 'spell_error' ? '继续拼写' : '继续复习',
      };
    } else if (state.stage === 'spelling' && this.currentSpellWord) {
      this.snapshot.spellState = {
        word: this.currentSpellWord,
        isWrong: this.currentSpellWrong,
        remainingInRound: this.spellQueue.length,
        retryCount: this.spellRetryQueue.length,
      };
    } else if (!['choice', 'detail', 'spelling'].includes(state.stage)) {
      throw new Error(`Cannot restore review stage ${state.stage}`);
    }
  }

  private getActiveWord(): StudyUIModel | null {
    if (this.snapshot.stage === 'choice') {
      return this.currentChoiceWord;
    }

    if (this.snapshot.stage === 'detail') {
      return this.detailWord;
    }

    if (this.snapshot.stage === 'spelling') {
      return this.currentSpellWord;
    }

    return null;
  }

  private removeTopicFromQueues(topicId: number): void {
    this.choiceQueue = this.choiceQueue.filter((word) => word.topicId !== topicId);
    this.choiceRetryQueue = this.choiceRetryQueue.filter((word) => word.topicId !== topicId);
    this.choiceRetrySet.delete(topicId);
    this.spellQueue = this.spellQueue.filter((word) => word.topicId !== topicId);
    this.spellRetryQueue = this.spellRetryQueue.filter((word) => word.topicId !== topicId);
    this.spellRetrySet.delete(topicId);

    if (this.currentChoiceWord?.topicId === topicId) {
      this.currentChoiceWord = null;
      this.currentChoiceOptions = [];
      this.currentChoiceAttemptCount = 0;
      this.currentChoiceClickedOptionIds.clear();
    }

    if (this.detailWord?.topicId === topicId) {
      this.detailWord = null;
    }

    if (this.currentSpellWord?.topicId === topicId) {
      this.currentSpellWord = null;
      this.currentSpellWrong = false;
    }
  }

  private getCompletedChoiceWords(): number {
    return Array.from(this.records.values()).filter(
      (record) => record.choicePassed || this.killedTopicIds.has(record.topicId),
    ).length;
  }

  private getCompletedSpellWords(): number {
    return Array.from(this.records.values()).filter(
      (record) => record.spellingPassed || this.killedTopicIds.has(record.topicId),
    ).length;
  }

  async killCurrent(): Promise<void> {
    const stage = this.snapshot.stage;
    const activeWord = this.getActiveWord();
    if (this.killInProgress || !activeWord || !['choice', 'detail', 'spelling'].includes(stage)) {
      return;
    }

    const detailReason = this.detailReason;
    const record = this.mustGetRecord(activeWord.topicId);
    const now = Date.now();
    const usedTime = record.reviewStartedAt == null
      ? 0
      : Math.max(0, now - record.reviewStartedAt);

    this.killInProgress = true;
    try {
      wordStatusService.killWord({
        bookId: this.context.bookId,
        topicId: activeWord.topicId,
        tagId: this.roadmapMap.get(activeWord.topicId)?.tag_id,
        usedTime,
        errNumDelta: record.errorCount,
        isTodayNew: false,
      });

      record.completedAt = now;
      this.killedTopicIds.add(activeWord.topicId);
      this.removeTopicFromQueues(activeWord.topicId);
      this.syncProgress();

      if (stage === 'choice') {
        await this.advanceChoiceQueue();
        return;
      }

      if (stage === 'detail' && detailReason !== 'spell_error') {
        await this.advanceChoiceQueue();
        return;
      }

      await this.advanceSpellQueue();
    } finally {
      this.killInProgress = false;
    }
  }

  private mustGetRecord(topicId: number): ReviewWordRecord {
    const record = this.records.get(topicId);
    if (!record) {
      throw new Error(`Missing review record for topic ${topicId}`);
    }

    return record;
  }

  private decorateChoiceOptions(options: StudyOption[]): ReviewChoiceOptionView[] {
    return options.map((option) => ({
      ...option,
      disabled: this.currentChoiceClickedOptionIds.has(option.id),
      status: this.currentChoiceClickedOptionIds.has(option.id)
        ? option.isCorrect
          ? 'correct'
          : 'incorrect'
        : 'idle',
      showOptionWord: this.currentChoiceClickedOptionIds.has(option.id),
      showOptionTranslation: true,
    }));
  }

  private updateChoiceSnapshot(isOptionsLoading: boolean): void {
    if (!this.currentChoiceWord) {
      return;
    }

    this.setSnapshot({
      stage: 'choice',
      detailState: null,
      spellState: null,
      summaryState: null,
      errorMessage: null,
      choiceState: {
        word: this.currentChoiceWord,
        options: this.decorateChoiceOptions(this.currentChoiceOptions),
        selectedOptionIds: Array.from(this.currentChoiceClickedOptionIds),
        attemptCount: this.currentChoiceAttemptCount,
        isOptionsLoading,
        remainingInRound: this.choiceQueue.length,
        retryCount: this.choiceRetryQueue.length,
        showWord: true,
        showSentence: true,
        showTranslation: this.currentChoiceAttemptCount === 1,
        showEnglishTranslation: this.currentChoiceAttemptCount === 2,
      },
    });
  }

  private async enterChoiceWord(word: StudyUIModel | null): Promise<void> {
    if (word && this.killedTopicIds.has(word.topicId)) {
      await this.advanceChoiceQueue();
      return;
    }

    if (!word) {
      await this.startSpellPhase();
      return;
    }

    this.currentChoiceWord = word;
    this.currentChoiceAttemptCount = 0;
    this.currentChoiceClickedOptionIds = new Set();
    this.currentChoiceOptions = [];
    this.detailWord = null;
    this.detailReason = null;
    const record = this.mustGetRecord(word.topicId);
    if (record.reviewStartedAt === null) {
      record.reviewStartedAt = Date.now();
    }

    this.updateChoiceSnapshot(true);
    reviewService
      .reportWordShown(word, 'choice')
      .catch(console.error);

    const options = await reviewService.getChoiceOptions(word);
    if (!this.currentChoiceWord || this.currentChoiceWord.topicId !== word.topicId) {
      return;
    }

    this.currentChoiceOptions = reviewService.shuffleOptions(options);
    this.updateChoiceSnapshot(false);
  }

  private enterDetail(word: StudyUIModel, reason: ReviewDetailReason): void {
    this.detailWord = word;
    this.detailReason = reason;
    this.currentChoiceWord = null;
    this.currentSpellWord = null;

    this.setSnapshot({
      stage: 'detail',
      choiceState: null,
      spellState: null,
      summaryState: null,
      errorMessage: null,
      detailState: {
        word,
        reason,
        nextLabel: reason === 'spell_error' ? '继续拼写' : '继续复习',
      },
    });

    reviewService.reportWordDetailShown(word, this.context).catch(console.error);
  }

  private enqueueChoiceRetry(word: StudyUIModel): void {
    if (this.choiceRetrySet.has(word.topicId)) {
      return;
    }

    this.choiceRetrySet.add(word.topicId);
    this.choiceRetryQueue.push(word);
  }

  private enqueueSpellRetry(word: StudyUIModel): void {
    if (this.spellRetrySet.has(word.topicId)) {
      return;
    }

    this.spellRetrySet.add(word.topicId);
    this.spellRetryQueue.push(word);
  }

  private async advanceChoiceQueue(): Promise<void> {
    if (this.choiceQueue.length > 0) {
      await this.enterChoiceWord(this.choiceQueue.shift() || null);
      return;
    }

    if (this.choiceRetryQueue.length > 0) {
      this.choiceQueue = [...this.choiceRetryQueue];
      this.choiceRetryQueue = [];
      this.choiceRetrySet.clear();
      await this.enterChoiceWord(this.choiceQueue.shift() || null);
      return;
    }

    await this.startSpellPhase();
  }

  private async startSpellPhase(): Promise<void> {
    this.spellQueue = this.allWords.filter(
      (word) => !this.killedTopicIds.has(word.topicId),
    );
    this.spellRetryQueue = [];
    this.spellRetrySet.clear();
    await this.enterSpellWord(this.spellQueue.shift() || null);
  }

  private async enterSpellWord(word: StudyUIModel | null): Promise<void> {
    if (word && this.killedTopicIds.has(word.topicId)) {
      await this.advanceSpellQueue();
      return;
    }

    if (!word) {
      await this.complete();
      return;
    }

    this.currentSpellWord = word;
    this.currentSpellWrong = false;
    this.detailWord = null;
    this.detailReason = null;

    this.setSnapshot({
      stage: 'spelling',
      choiceState: null,
      detailState: null,
      summaryState: null,
      errorMessage: null,
      spellState: {
        word,
        isWrong: false,
        remainingInRound: this.spellQueue.length,
        retryCount: this.spellRetryQueue.length,
      },
    });

    reviewService
      .reportWordShown(word, 'spelling')
      .catch(console.error);
  }

  private async advanceSpellQueue(): Promise<void> {
    if (this.spellQueue.length > 0) {
      await this.enterSpellWord(this.spellQueue.shift() || null);
      return;
    }

    if (this.spellRetryQueue.length > 0) {
      this.spellQueue = [...this.spellRetryQueue];
      this.spellRetryQueue = [];
      this.spellRetrySet.clear();
      await this.enterSpellWord(this.spellQueue.shift() || null);
      return;
    }

    await this.complete();
  }

  private buildSummaryState(): ReviewSummaryState {
    const records = Array.from(this.records.values());
    return {
      totalWords: this.allWords.length,
      completedWords: this.getCompletedSpellWords(),
      totalErrors: records.reduce((sum, record) => sum + record.errorCount, 0),
      records,
      killedTopicIds: Array.from(this.killedTopicIds),
    };
  }

  private syncProgress(): void {
    this.snapshot = {
      ...this.snapshot,
      completedChoiceWords: this.getCompletedChoiceWords(),
      completedSpellWords: this.getCompletedSpellWords(),
    };
    this.checkpoint();
  }

  private async complete(): Promise<void> {
    this.syncProgress();
    const records = Array.from(this.records.values());

    // 先完成正式本地记录与 pending 队列，再清理草稿并展示总结。
    await reviewService.finishReview(
      records,
      this.context,
      Array.from(this.killedTopicIds),
    );
    studySessionStore.clear('review', this.context.bookId);

    this.setSnapshot({
      stage: 'summary',
      choiceState: null,
      detailState: null,
      spellState: null,
      errorMessage: null,
      summaryState: this.buildSummaryState(),
    });

    await reviewService.reportReviewFinished().catch(console.error);
  }
}
