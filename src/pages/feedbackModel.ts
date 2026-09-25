export const FEEDBACK_MAX_LENGTH = 500;

export const countFeedbackCharacters = (value: string): number =>
  Array.from(value).length;

export const normalizeFeedbackContent = (value: string): string => value.trim();

export const validateFeedbackContent = (value: string): string | null => {
  const normalized = normalizeFeedbackContent(value);
  if (!normalized) return '内容不能为空';
  if (countFeedbackCharacters(normalized) > FEEDBACK_MAX_LENGTH) {
    return '内容不能超过 500 个字';
  }
  return null;
};

export const parseFeedbackPage = (value: string | null): number => {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

export type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right';

export const getFeedbackPaginationItems = (
  currentPage: number,
  totalPages: number,
): PaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages];
};
