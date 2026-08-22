import { describe, expect, it } from 'vitest';
import type { SelectBookPlanInfo, UserBookBasicInfo } from '../types';
import {
  buildSwitchStudyBookItems,
  getCurrentSelectedPlan,
  getProgressPercent,
  getRemainingDays,
} from './switchStudyBookModel';

function plan(
  bookId: number,
  learnedWordsCount: number,
  dailyPlanCount: number,
  reviewPlanCount = 0,
): SelectBookPlanInfo {
  return {
    book_id: bookId,
    learned_words_count: learnedWordsCount,
    group_id: 0,
    daily_plan_count: dailyPlanCount,
    review_plan_count: reviewPlanCount,
  };
}

function book(id: number, name: string, totalWordsCount: number): UserBookBasicInfo {
  return {
    id,
    name,
    total_words_count: totalWordsCount,
    is_word_course: false,
    group_count: 0,
    book_flag: 0,
    img: '',
    desc: '',
  };
}

describe('switch study book model', () => {
  it('使用计划数组第一个元素作为当前计划', () => {
    const plans = [plan(10, 5, 10), plan(20, 2, 15)];

    expect(getCurrentSelectedPlan(plans)?.book_id).toBe(10);
    expect(getCurrentSelectedPlan([])).toBeNull();
  });

  it('合并已选计划和词书信息并计算展示状态', () => {
    const items = buildSwitchStudyBookItems(
      [plan(10, 377, 5), plan(20, 856, 15)],
      [book(10, '新概念英语', 867), book(20, '中考词汇', 2124)],
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      isCurrent: true,
      learnedWordsCount: 377,
      totalWordsCount: 867,
      remainingWordsCount: 490,
      remainingDays: 98,
      progressPercent: 43,
    });
    expect(items[1]).toMatchObject({
      isCurrent: false,
      learnedWordsCount: 856,
      totalWordsCount: 2124,
      remainingWordsCount: 1268,
      remainingDays: 85,
      progressPercent: 40,
    });
  });

  it('剩余天数和进度会处理边界值', () => {
    expect(getRemainingDays(100, 100, 0)).toBe(0);
    expect(getRemainingDays(101, 1, 0)).toBe(100);
    expect(getProgressPercent(0, 50)).toBe(0);
    expect(getProgressPercent(100, 150)).toBe(100);
    expect(getProgressPercent(100, -20)).toBe(0);
  });

  it('未匹配到词书时仍保留计划并使用安全默认值', () => {
    const [item] = buildSwitchStudyBookItems([plan(30, 8, 10)], []);

    expect(item.book).toBeNull();
    expect(item.totalWordsCount).toBe(0);
    expect(item.progressPercent).toBe(0);
  });
});
