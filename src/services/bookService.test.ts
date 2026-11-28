import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TopicKey, WordListWordMetaV2 } from '../types';
import { accountSession } from './accountSession';
import { ApiService } from './api';
import { bookService } from './bookService';

const keys: TopicKey[] = [1, 2].map(topic_id => ({ topic_id, word_level_id: 10, tag_id: 7 }));
const metadata = (input = keys): WordListWordMetaV2[] => input.map(topic_key => ({
  topic_key, word: `word-${topic_key.topic_id}`, mean_cn: 'meaning',
}));
const response = (data = metadata()) => ({ code: 200, success: true, data });
let now: number;
beforeEach(() => {
  accountSession.invalidate();
  accountSession.setSwitching(false);
  now = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

describe('word-list metadata memory cache', () => {
  it('coalesces pending requests and reuses complete data without exposing cached objects', async () => {
    const post = vi.spyOn(ApiService, 'post').mockResolvedValue(response());
    const [a, b] = await Promise.all([
      bookService.getWordListWordMeta(keys), bookService.getWordListWordMeta(keys, { force: true }),
    ]);
    expect(post).toHaveBeenCalledOnce();
    a[0].word = 'changed';
    b[0].topic_key.topic_id = 999;
    expect(await bookService.getWordListWordMeta(keys)).toEqual(metadata());
    expect(post).toHaveBeenCalledOnce();
  });

  it('expires after ten minutes and permits explicit reload before expiry', async () => {
    const post = vi.spyOn(ApiService, 'post').mockResolvedValue(response());
    await bookService.getWordListWordMeta(keys);
    now += 599999;
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledOnce();
    now++;
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledTimes(2);
    await bookService.getWordListWordMeta(keys, { force: true });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('coalesces an older pending batch even when another batch was requested in between', async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    const post = vi.spyOn(ApiService, 'post').mockReturnValueOnce(new Promise(resolve => { release = resolve; }))
      .mockResolvedValue(response(metadata([keys[0]])));
    const first = bookService.getWordListWordMeta(keys);
    const other = bookService.getWordListWordMeta([keys[0]]);
    const repeat = bookService.getWordListWordMeta(keys);
    release(response());
    await Promise.all([first, other, repeat]);
    expect(post).toHaveBeenCalledTimes(2);
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('matches order, book and tag and retains only the latest batch', async () => {
    const post = vi.spyOn(ApiService, 'post').mockImplementation(async (_url, body) => response(metadata(body as TopicKey[])));
    await bookService.getWordListWordMeta(keys);
    await bookService.getWordListWordMeta([...keys].reverse());
    await bookService.getWordListWordMeta(keys.map(k => ({ ...k, tag_id: 8 })));
    await bookService.getWordListWordMeta(keys.map(k => ({ ...k, word_level_id: 11 })));
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledTimes(5);
  });

  it('does not cache failed, malformed or partial responses', async () => {
    const post = vi.spyOn(ApiService, 'post')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ code: 200, success: true, data: null })
      .mockResolvedValueOnce(response(metadata([keys[0]])))
      .mockResolvedValue(response());
    await expect(bookService.getWordListWordMeta(keys)).rejects.toThrow('offline');
    await expect(bookService.getWordListWordMeta(keys)).rejects.toThrow('响应格式');
    expect(await bookService.getWordListWordMeta(keys)).toHaveLength(1);
    expect(await bookService.getWordListWordMeta(keys)).toHaveLength(2);
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledTimes(4);
  });

  it('drops account/session caches and rejects a late response after switching', async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    const post = vi.spyOn(ApiService, 'post').mockReturnValueOnce(new Promise(resolve => { release = resolve; }))
      .mockResolvedValue(response());
    const pending = expect(bookService.getWordListWordMeta(keys)).rejects.toThrow('账号会话');
    accountSession.invalidate();
    await bookService.getWordListWordMeta(keys);
    release(response());
    await pending;
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledTimes(2);
    accountSession.invalidate();
    await bookService.getWordListWordMeta(keys);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('does not request an empty batch', async () => {
    const post = vi.spyOn(ApiService, 'post');
    expect(await bookService.getWordListWordMeta([])).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});
