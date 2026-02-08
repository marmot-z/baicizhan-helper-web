import type { StudyStage, StudyOption, StudyUIModel } from './types';
import { StudyUtils } from './StudyUtils';

/**
 * WordCard类 - 表示单个单词的学习卡片
 * 负责管理单词的展示、答案检查和提示逻辑
 */
export class WordCard {
  public uiModel: StudyUIModel;
  public stage: StudyStage;
  public showAnswer: boolean;
  public attemptCount: number;
  public maxAttempts: number;
  public clickedOptionIds: Set<number>;
  
  /**
   * 构造函数
   * @param uiModel UI模型
   * @param stage 学习阶段
   */
  constructor(uiModel: StudyUIModel, stage: StudyStage) {
    this.stage = stage;
    this.uiModel = uiModel;
    // Options are lazy loaded, so we don't init them here
    this.attemptCount = 0;
    this.maxAttempts = 3;
    this.showAnswer = false;
    this.clickedOptionIds = new Set();
  }

  public pass(): void {
    this.attemptCount++;
    this.showAnswer = true;
    this.clickedOptionIds.clear();
  }

  public fail(optionId: number): boolean {
    this.attemptCount++;
    this.clickedOptionIds.add(optionId);

    if (this.attemptCount >= this.maxAttempts) {
      this.showAnswer = true;
      this.attemptCount = 0;
      this.clickedOptionIds.clear();
      return true;
    }

    return false;
  }

  public getId(): number {
    return this.uiModel.topicId;
  }

  public getOptions(): StudyOption[] {
    const cached = StudyUtils.getCachedOptions(this.uiModel.topicId);
    return cached || this.uiModel.front.options;
  }

  public showWord(): boolean {
    return this.stage === 'recognition' || this.stage === 'understanding';
  }

  public showSentence(): boolean {
    return this.stage === 'recognition' ||
    (this.stage === 'understanding' && this.attemptCount === 1) ||
    (this.stage === 'mastery' && this.attemptCount === 2);
  }

  public showTranslation(): boolean {
    return this.stage === 'recognition' && this.attemptCount === 1;
  }

  public showEnglishTranslation(): boolean {
    return (this.stage === 'recognition' && this.attemptCount === 2) ||
    (this.stage === 'understanding' && this.attemptCount === 2);
  }

  public showOptionWord(id: number): boolean {
    return (this.stage === 'recognition' && this.clickedOptionIds.has(id)) ||
    (this.stage === 'understanding' && this.clickedOptionIds.has(id)) ||
    this.stage === 'mastery';
  }

  public showOptionTranslation(id: number): boolean {
    return this.stage === 'recognition' || 
    this.stage === 'understanding' ||
    (this.stage === 'mastery' && this.clickedOptionIds.has(id));
  }

  public toObject(): object {
    const options: { 
      id: number; 
      word: string; 
      translation: string; 
      isCorrect: boolean; 
      showOptionWord: boolean; 
      showOptionTranslation: boolean;
    }[] = [];
    
    for (const o of this.getOptions()) {
      options.push({
        id: o.id,
        word: o.word,
        translation: o.translation,     
        isCorrect: o.isCorrect,     
        showOptionWord: this.showOptionWord(o.id),
        showOptionTranslation: this.showOptionTranslation(o.id)
      });
    }

    return {
      uiModel: this.uiModel,
      showAnswer: this.showAnswer,
      showWord: this.showWord(),
      showSentence: this.showSentence(),
      showTranslation: this.showTranslation(),
      showEnglishTranslation: this.showEnglishTranslation(),
      options: options,
    }
  }
}
