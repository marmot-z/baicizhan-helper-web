import { accountSession } from '../accountSession';
import { useStudyStore } from '../../stores/studyStore';
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
import type { ReviewSessionState, StudyQuestionState } from '../study/sessionTypes';
import { createStudySessionId, studySessionStore } from '../study/sessionStore';
import { studyRecordStore } from '../study/recordStore';
import { wordStatusService } from '../study/wordStatusService';
import { isKilledRecord } from '../../types/studyRecord';
import { applyStudyCorrect, applyReviewCorrect, applyReviewWrong } from '../study/recordReducers';

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
  private readonly accountVersion = accountSession.getVersion();
  private snapshot: ReviewSnapshot = createInitialSnapshot();
  private listeners = new Set<(snapshot: ReviewSnapshot) => void>();
  private records = new Map<number, ReviewWordRecord>();
  private allWords: StudyUIModel[];
  private roadmapMap: ReviewInitData['roadmapMap'];
  private context: ReviewInitData['context'];
  private onCheckpoint?: (state: ReviewSessionState) => void;
  private killedTopicIds = new Set<number>();
  private killInProgress = false;
  private answerInProgress = false;
  private preparingCommit = false;
  private sessionId = createStudySessionId();
  private question: StudyQuestionState | undefined;
  private paused = false;
  private activeSince = Date.now();
  private completionTask?: Promise<void>;

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
        activeTime: 0,
        scoreSettled: false,
        scoreBeforeReview: studyRecordStore.getRecord(this.context.bookId, word.topicId)?.topicScore ?? 0,
        reviewRoundBeforeReview: studyRecordStore.getRecord(this.context.bookId, word.topicId)?.reviewRound ?? 0,
      });
    });

    this.snapshot = {
      ...createInitialSnapshot(),
      totalWords: initData.words.length,
    };

    if (restoredState) {
      this.restoreState(restoredState, initData.missingTopicIds);
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

  getCurrentQuestionId(): string | undefined { return this.question?.questionId; }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    if (!this.paused && this.question && !this.question.committed) {
      this.question.elapsedTime += Math.max(0, Date.now() - this.activeSince);
    }
    this.paused = paused;
    this.activeSince = Date.now();
    this.checkpoint();
  }

  private beginQuestion(word: StudyUIModel, phase: string): void {
    this.question = {
      questionId: `${this.sessionId}:${createStudySessionId()}`, topicId: word.topicId,
      phase, hadWrong: false, elapsedTime: 0, committed: false,
    };
    this.activeSince = Date.now();
  }

  private questionElapsed(): number {
    if (!this.question) return 0;
    return this.question.elapsedTime + (!this.paused && !this.question.committed
      ? Math.max(0, Date.now() - this.activeSince) : 0);
  }

  private async commitAnswer(before: ReviewSessionState, settleScore = false): Promise<void> {
    if (!this.question || this.question.committed) return;
    const topicId = this.question.topicId;
    const elapsed = this.questionElapsed();
    const hadWrong = this.question.hadWrong;
    this.question.elapsedTime = elapsed;
    this.question.committed = true;
    const reviewRecord = this.mustGetRecord(topicId);
    reviewRecord.activeTime = reviewRecord.activeTime + elapsed;
    if (settleScore) reviewRecord.scoreSettled = true;
    try {
      await studyRecordStore.commitQuestionResult({
        bookId: this.context.bookId, topicId, eventId: this.question.questionId,
        mutate: (existing) => {
          const input = {
            bookId: this.context.bookId, topicId,
            tagId: this.roadmapMap.get(topicId)?.tag_id,
            usedTime: elapsed, doNumDelta: 1, errNumDelta: hadWrong ? 1 : 0,
            now: Date.now(), isFirstDoAtToday: false, nextSpanDays: 0,
            nextScore: existing?.topicScore ?? 0, nextReviewRound: existing?.reviewRound ?? 0,
          };
          if (!settleScore) return applyStudyCorrect(existing, input);
          const errorFree = reviewRecord.errorCount === 0;
          input.nextScore = errorFree
            ? Math.max(reviewRecord.scoreBeforeReview, 5)
            : Math.min(Math.max(reviewRecord.scoreBeforeReview, 0), 4);
          input.nextReviewRound = reviewRecord.reviewRoundBeforeReview
            + (errorFree ? 1 : 0);
          return errorFree ? applyReviewCorrect(existing, input) : applyReviewWrong(existing, input);
        },
        checkpoint: studySessionStore.buildCheckpoint('review', this.context.bookId, this.exportState()),
      });
      accountSession.assertCurrent(this.accountVersion);
      const store = useStudyStore.getState();
      store.loadLocalLearnRecords(this.context.bookId);
      store.recomputeHomeState(this.context.bookId);
    } catch (error) {
      this.restoreState(before, []);
      this.notify();
      throw error;
    }
  }

  async resume(): Promise<void> {
    if (!this.question) {
      const word = this.currentChoiceWord ?? this.currentSpellWord;
      if (word) this.beginQuestion(word, this.snapshot.stage);
    }
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
      && this.question?.committed
    ) {
      await this.advanceSpellQueue();
      return;
    }

    if (
      this.snapshot.stage === 'choice' &&
      this.currentChoiceWord &&
      this.mustGetRecord(this.currentChoiceWord.topicId).choicePassed
      && this.question?.committed
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
      sessionId: this.sessionId,
      question: this.question ? { ...this.question, elapsedTime: this.questionElapsed() } : undefined,
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
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

    if (!this.preparingCommit && ['choice', 'detail', 'spelling'].includes(this.snapshot.stage)) {
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

  async chooseOption(optionId: number, expectedQuestionId?: string): Promise<void> {
    if (this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || this.killInProgress || this.answerInProgress || !this.currentChoiceWord
      || this.snapshot.stage !== 'choice' || this.question?.committed
      || (expectedQuestionId !== undefined && expectedQuestionId !== this.question?.questionId)) return;
    if (this.currentChoiceClickedOptionIds.has(optionId)) return;
    const option = this.currentChoiceOptions.find((item) => item.id === optionId);
    if (!option) return;
    this.answerInProgress = true;
    const before = this.exportState();
    const word = this.currentChoiceWord;
    const record = this.mustGetRecord(word.topicId);
    try {
      if (!this.question) this.beginQuestion(word, 'choice');
      void reviewService.reportChoiceResult(word, optionId, option.isCorrect).catch(console.error);
      if (option.isCorrect) {
        feedbackSoundPlayer.playCorrect();
        this.preparingCommit = true;
        if (this.currentChoiceAttemptCount >= 1) this.enterDetail(word, 'choice_retry');
        else record.choicePassed = true;
        await this.commitAnswer(before);
        this.preparingCommit = false;
        if (this.currentChoiceAttemptCount >= 1) { this.checkpoint(); this.notify(); }
        else { this.syncProgress(); await this.advanceChoiceQueue(); }
        return;
      }
      feedbackSoundPlayer.playIncorrect();
      this.currentChoiceAttemptCount += 1;
      this.currentChoiceClickedOptionIds.add(optionId);
      record.errorCount += 1;
      record.choiceFailed = true;
      if (this.question) this.question.hadWrong = true;
      this.enqueueChoiceRetry(word);
      if (this.currentChoiceAttemptCount > 2) {
        this.preparingCommit = true;
        this.enterDetail(word, 'choice_max_errors');
        await this.commitAnswer(before);
        this.preparingCommit = false;
        this.checkpoint(); this.notify();
      } else this.updateChoiceSnapshot(false);
    } finally { this.preparingCommit = false; this.answerInProgress = false; }
  }

  async continueFromDetail(): Promise<void> {
    if (
      this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || this.killInProgress || this.answerInProgress ||
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

  async submitSpell(input: string, expectedQuestionId?: string): Promise<void> {
    if (this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || this.killInProgress || this.answerInProgress || !this.currentSpellWord
      || this.snapshot.stage !== 'spelling' || this.currentSpellWrong || this.question?.committed
      || (expectedQuestionId !== undefined && expectedQuestionId !== this.question?.questionId)) return;
    this.answerInProgress = true;
    const before = this.exportState();
    const word = this.currentSpellWord;
    try {
      if (!this.question) this.beginQuestion(word, 'spelling');
      const isCorrect = input.trim().toLowerCase() === word.word.trim().toLowerCase();
      const record = this.mustGetRecord(word.topicId);
      void reviewService.reportSpellResult(word, isCorrect).catch(console.error);
      if (isCorrect) {
        feedbackSoundPlayer.playCorrect();
        const completedAt = Date.now();
        record.spellingPassed = true;
        record.completedAt = completedAt;
        await this.commitAnswer(before, !record.scoreSettled);
        if (!record.choiceFailed && !record.spellingFailed && !record.savedStudyRecord) {
          await studyService.saveStudyRecord(this.context.bookId, word.topicId, record.activeTime)
            .then(() => { record.savedStudyRecord = true; })
            .catch(console.error);
          this.checkpoint();
        }
        this.syncProgress();
        await this.advanceSpellQueue();
        return;
      }
      feedbackSoundPlayer.playIncorrect();
      record.errorCount += 1;
      record.spellingFailed = true;
      if (this.question) this.question.hadWrong = true;
      this.currentSpellWrong = true;
      this.enqueueSpellRetry(word);
      this.setSnapshot({
        stage: 'spelling', choiceState: null, detailState: null, summaryState: null, errorMessage: null,
        spellState: { word, isWrong: true, remainingInRound: this.spellQueue.length,
          retryCount: this.spellRetryQueue.length },
      });
    } finally { this.answerInProgress = false; }
  }

  clearSpellWrongOnInput(): void {
    if (
      this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || this.killInProgress || this.answerInProgress ||
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
    if (!this.preparingCommit) { this.checkpoint(); this.notify(); }
  }

  private notify(): void {
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private restoreState(state: ReviewSessionState, missingTopicIds: number[]): void {
    this.sessionId = state.sessionId;
    this.question = state.question ? { ...state.question } : undefined;
    this.activeSince = Date.now();
    const wordsByTopicId = new Map(this.allWords.map((word) => [word.topicId, word]));
    const skippedTopicIds = new Set(missingTopicIds);
    const keepTopic = (topicId: number) => !skippedTopicIds.has(topicId);
    const getWord = (topicId: number | null): StudyUIModel | null => {
      if (topicId === null || !keepTopic(topicId)) return null;
      const word = wordsByTopicId.get(topicId);
      if (!word) throw new Error(`Cannot restore review word ${topicId}`);
      return word;
    };
    const getWords = (topicIds: number[]): StudyUIModel[] =>
      topicIds.filter(keepTopic).map((topicId) => {
        const word = getWord(topicId);
        if (!word) throw new Error(`Cannot restore review queue word ${topicId}`);
        return word;
      });

    this.records = new Map(
      state.records
        .filter((record) => keepTopic(record.topicId))
        .map((record) => [record.topicId, { ...record }]),
    );
    if (this.allWords.some((word) => !this.records.has(word.topicId))) {
      throw new Error('Cannot restore review records: missing word record');
    }
    this.choiceQueue = getWords(state.choiceQueueTopicIds);
    this.choiceRetryQueue = getWords(state.choiceRetryQueueTopicIds);
    this.choiceRetrySet = new Set(state.choiceRetryTopicIds.filter(keepTopic));
    this.currentChoiceWord = getWord(state.currentChoiceTopicId);
    this.currentChoiceAttemptCount = this.currentChoiceWord ? state.currentChoiceAttemptCount : 0;
    this.currentChoiceClickedOptionIds = new Set(this.currentChoiceWord ? state.currentChoiceClickedOptionIds : []);
    const choiceOptions = this.currentChoiceWord?.front.options ?? [];
    const choiceOptionsById = new Map(choiceOptions.map((option) => [option.id, option]));
    this.currentChoiceOptions = state.currentChoiceOptionIds
      .map((id) => choiceOptionsById.get(id))
      .filter(Boolean) as StudyOption[];
    this.detailWord = getWord(state.detailTopicId);
    this.detailReason = state.detailReason;
    this.spellQueue = getWords(state.spellQueueTopicIds);
    this.spellRetryQueue = getWords(state.spellRetryQueueTopicIds);
    this.spellRetrySet = new Set(state.spellRetryTopicIds.filter(keepTopic));
    this.currentSpellWord = getWord(state.currentSpellTopicId);
    this.currentSpellWrong = this.currentSpellWord ? state.currentSpellWrong : false;
    const persistedKilledTopicIds = this.allWords
      .filter((word) =>
        isKilledRecord(studyRecordStore.getRecord(this.context.bookId, word.topicId)),
      )
      .map((word) => word.topicId);
    this.killedTopicIds = new Set([
      ...(state.killedTopicIds ?? []).filter(keepTopic),
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
    if (this.accountVersion !== accountSession.getVersion() || accountSession.isSwitching()
      || this.killInProgress || this.answerInProgress || !activeWord
      || !['choice', 'detail', 'spelling'].includes(stage)) return;
    const before = this.exportState();
    const detailReason = this.detailReason;
    const record = this.mustGetRecord(activeWord.topicId);
    const now = Date.now();
    const usedTime = this.question?.committed ? 0 : this.questionElapsed();
    this.killInProgress = true;
    try {
      record.completedAt = now;
      record.activeTime = record.activeTime + usedTime;
      this.killedTopicIds.add(activeWord.topicId);
      this.removeTopicFromQueues(activeWord.topicId);
      const eventId = `${this.question?.questionId ?? this.sessionId}:kill`;
      if (this.question) { this.question.elapsedTime = usedTime; this.question.committed = true; }
      await wordStatusService.killWord({
        bookId: this.context.bookId, topicId: activeWord.topicId,
        tagId: this.roadmapMap.get(activeWord.topicId)?.tag_id, usedTime,
        errNumDelta: 0, isTodayNew: false, eventId,
        checkpoint: studySessionStore.buildCheckpoint('review', this.context.bookId, this.exportState()),
      });
      this.syncProgress();
      if (stage === 'choice' || (stage === 'detail' && detailReason !== 'spell_error'))
        await this.advanceChoiceQueue();
      else await this.advanceSpellQueue();
    } catch (error) { this.restoreState(before, []); this.notify(); throw error; }
    finally { this.killInProgress = false; }
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
    this.beginQuestion(word, 'choice');
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
    this.beginQuestion(word, 'spelling');
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

  private complete(): Promise<void> {
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

    this.syncProgress();
    const records = Array.from(this.records.values());

    // 作答结果已逐题提交；整组完成只更新汇总并触发同步。
    await reviewService.finishReview(records, this.context);
    if (this.accountVersion !== accountSession.getVersion()) {
      return;
    }

    await studySessionStore.clear('review', this.context.bookId);

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
