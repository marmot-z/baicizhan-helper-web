import { describe, expect, it } from 'vitest';
import type { StudyOption } from '../services/study/types';
import {
  getStudyOptionSetKey,
  orderStudyOptions,
  shuffleStudyOptionIds,
} from './studyOptionOrder';

const createOption = (
  id: number,
  showOptionWord: boolean,
): StudyOption => ({
  id,
  word: `word-${id}`,
  translation: `translation-${id}`,
  isCorrect: false,
  showOptionWord,
  showOptionTranslation: true,
});

describe('study option order', () => {
  it('keeps the shuffled positions while applying updated display state by id', () => {
    const initialOptions = [createOption(1, false), createOption(2, false)];
    const optionIds = shuffleStudyOptionIds(
      initialOptions.map((option) => option.id),
      () => 0,
    );
    const updatedOptions = [createOption(1, true), createOption(2, false)];

    expect(optionIds).toEqual([2, 1]);
    expect(orderStudyOptions(updatedOptions, optionIds).map((option) => ({
      id: option.id,
      showOptionWord: option.showOptionWord,
    }))).toEqual([
      { id: 2, showOptionWord: false },
      { id: 1, showOptionWord: true },
    ]);
  });

  it('uses an order-independent key for the same option set', () => {
    expect(getStudyOptionSetKey([createOption(2, false), createOption(1, false)]))
      .toBe(getStudyOptionSetKey([createOption(1, true), createOption(2, false)]));
  });
});
