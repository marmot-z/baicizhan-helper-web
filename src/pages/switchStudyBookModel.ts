import type { SelectBookPlanInfo, UserBookBasicInfo } from '../types';

export interface SwitchStudyBookItem {
  plan: SelectBookPlanInfo;
  book: UserBookBasicInfo | null;
  isCurrent: boolean;
  learnedWordsCount: number;
  totalWordsCount: number;
  remainingWordsCount: number;
  remainingDays: number;
  progressPercent: number;
}

export function getCurrentSelectedPlan(
  plans: SelectBookPlanInfo[],
): SelectBookPlanInfo | null {
  return plans[0] ?? null;
}

export function getRemainingDays(
  totalWordsCount: number,
  learnedWordsCount: number,
  dailyPlanCount: number,
): number {
  const remainingWordsCount = Math.max(totalWordsCount - learnedWordsCount, 0);
  return Math.ceil(remainingWordsCount / Math.max(dailyPlanCount, 1));
}

export function getProgressPercent(
  totalWordsCount: number,
  learnedWordsCount: number,
): number {
  if (totalWordsCount <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((learnedWordsCount / totalWordsCount) * 100)),
  );
}

export function buildSwitchStudyBookItems(
  plans: SelectBookPlanInfo[],
  books: UserBookBasicInfo[],
): SwitchStudyBookItem[] {
  const currentPlan = getCurrentSelectedPlan(plans);
  const booksById = new Map(books.map((book) => [book.id, book]));

  return plans.map((plan) => {
    const book = booksById.get(plan.book_id) ?? null;
    const totalWordsCount = book?.total_words_count ?? 0;
    const learnedWordsCount = Math.max(plan.learned_words_count ?? 0, 0);

    return {
      plan,
      book,
      isCurrent: currentPlan?.book_id === plan.book_id,
      learnedWordsCount,
      totalWordsCount,
      remainingWordsCount: Math.max(totalWordsCount - learnedWordsCount, 0),
      remainingDays: getRemainingDays(
        totalWordsCount,
        learnedWordsCount,
        plan.daily_plan_count,
      ),
      progressPercent: getProgressPercent(totalWordsCount, learnedWordsCount),
    };
  });
}
