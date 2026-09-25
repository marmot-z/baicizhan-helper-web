import { describe, expect, it } from 'vitest';
import {
  countFeedbackCharacters,
  getFeedbackPaginationItems,
  normalizeFeedbackContent,
  parseFeedbackPage,
  validateFeedbackContent,
} from './feedbackModel';

describe('feedback content', () => {
  it('counts Unicode code points instead of UTF-16 units', () => {
    expect(countFeedbackCharacters('中文😀')).toBe(3);
    expect(validateFeedbackContent('😀'.repeat(500))).toBeNull();
    expect(validateFeedbackContent('😀'.repeat(501))).toBe('内容不能超过 500 个字');
  });

  it('trims content and rejects blank text', () => {
    expect(normalizeFeedbackContent('  问题  ')).toBe('问题');
    expect(validateFeedbackContent(' \n\t ')).toBe('内容不能为空');
  });
});

describe('feedback pagination', () => {
  it('parses only positive integer page parameters', () => {
    expect(parseFeedbackPage('3')).toBe(3);
    expect(parseFeedbackPage(null)).toBe(1);
    expect(parseFeedbackPage('0')).toBe(1);
    expect(parseFeedbackPage('1.5')).toBe(1);
    expect(parseFeedbackPage('nope')).toBe(1);
  });

  it('shows compact page ranges for long lists', () => {
    expect(getFeedbackPaginationItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 10]);
    expect(getFeedbackPaginationItems(6, 10)).toEqual([1, 'ellipsis-left', 5, 6, 7, 'ellipsis-right', 10]);
    expect(getFeedbackPaginationItems(10, 10)).toEqual([1, 'ellipsis-left', 6, 7, 8, 9, 10]);
  });
});
