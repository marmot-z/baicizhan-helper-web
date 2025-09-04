import type { StudyWord, StudyStage, StudyOption } from './types';
import type { UserRoadMapElementV2 } from '../../types';

/**
 * WordCard类 - 表示单个单词的学习卡片
 * 负责管理单词的展示、答案检查和提示逻辑
 */
export class WordCard {
  public word: StudyWord;
  public originInfo: UserRoadMapElementV2;
  public stage: StudyStage;
  public showAnswer: boolean;
  public attemptCount: number;
  public maxAttempts: number;
  public clickedOptionIds: Set<number>;
  
  /**
   * 构造函数
   * @param word 单词信息（包含选项）
   */
  constructor(originInfo: UserRoadMapElementV2, word: StudyWord, stage: StudyStage) {
    this.originInfo = originInfo;
    this.stage = stage;
    this.word = word;
    this.word.options = this.shuffle(this.word.options);
    this.attemptCount = 0;
    this.maxAttempts = 3;
    this.showAnswer = false;
    this.clickedOptionIds = new Set();
  }

  private shuffle(options: StudyOption[]): StudyOption[] {
    const shuffledOptions = [...options];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }
    return shuffledOptions;
  }

  public pass(): void {
    this.attemptCount++;
    this.showAnswer = true;
    this.clickedOptionIds.clear();
  }

  public fail(optionId: number): void {
    this.attemptCount++;
    this.clickedOptionIds.add(optionId);

    if (this.attemptCount >= this.maxAttempts) {
      this.showAnswer = true;
      this.attemptCount = 0;
      this.clickedOptionIds.clear();
    }
  }

  public getId(): number {
    return this.word.word.dict.word_basic_info.topic_id;
  }

  public getOptions(): StudyOption[] {
    return this.word.options;
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

  public toObject(): any {
    return {
      word: this.word as StudyWord,
      showAnswer: this.showAnswer,
      showWord: this.showWord(),
      showSentence: this.showSentence(),
      showTranslation: this.showTranslation(),
      showEnglishTranslation: this.showEnglishTranslation(),
      options: this.getOptions().reduce((acc, option) => {
        acc[option.id] = {
          id: option.id,
          word: option.word,
          translation: option.translation,     
          isCorrect: option.isCorrect,   
          showOptionWord: this.showOptionWord(option.id),
          showOptionTranslation: this.showOptionTranslation(option.id)
        };
        return acc;
      }, {} as Record<number, any>),
    }
  }
}