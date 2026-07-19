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
  private context: ReviewInitData['context'];
  private onCheckpoint?: (state: ReviewSessionState) => void;

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
    if (!this.currentChoiceWord || this.snapshot.stage !== 'choice') {
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
    if (this.snapshot.stage !== 'detail' || !this.detailWord || !this.detailReason) {
      return;
    }

    if (this.detailReason === 'spell_error') {
      await this.advanceSpellQueue();
      return;
    }

    await this.advanceChoiceQueue();
  }

  async submitSpell(input: string): Promise<void> {
    if (!this.currentSpellWord || this.snapshot.stage !== 'spelling') {
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

    this.snapshot = {
      ...createInitialSnapshot(),
      stage: state.stage,
      totalWords: this.allWords.length,
      completedChoiceWords: state.completedChoiceWords,
      completedSpellWords: state.completedSpellWords,
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
    } else {
      throw new Error(`Cannot restore review stage ${state.stage}`);
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
    this.spellQueue = [...this.allWords];
    this.spellRetryQueue = [];
    this.spellRetrySet.clear();
    await this.enterSpellWord(this.spellQueue.shift() || null);
  }

  private async enterSpellWord(word: StudyUIModel | null): Promise<void> {
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
      completedWords: records.filter((record) => record.spellingPassed).length,
      totalErrors: records.reduce((sum, record) => sum + record.errorCount, 0),
      records,
    };
  }

  private syncProgress(): void {
    const records = Array.from(this.records.values());
    this.snapshot = {
      ...this.snapshot,
      completedChoiceWords: records.filter((record) => record.choicePassed).length,
      completedSpellWords: records.filter((record) => record.spellingPassed).length,
    };
    this.checkpoint();
  }

  private async complete(): Promise<void> {
    this.syncProgress();
    const records = Array.from(this.records.values());

    // 先完成正式本地记录与 pending 队列，再清理草稿并展示总结。
    await reviewService.finishReview(records, this.context);
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
