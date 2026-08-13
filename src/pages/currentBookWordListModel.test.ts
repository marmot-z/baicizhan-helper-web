import { describe, expect, it } from 'vitest';
import type { UserRoadMapElementV2, WordListWordMetaV2 } from '../types';
import {
  UNLEARNED_SCORE,
  createTopicLearnRecord,
  type TopicLearnRecordMap,
} from '../types/studyRecord';
import { applyUnkill } from '../services/study/recordReducers';
import {
  categorizeCurrentBookWords,
  createWordMetadataMap,
  parseWordListTab,
  parseWordSortOrder,
  sortCurrentBookWords,
} from './currentBookWordListModel';

function roadmapItem(topicId: number): UserRoadMapElementV2 {
  return {
    topic_id: topicId,
    word_level_id: 1,
    tag_id: 2,
    options: [],
  };
}

function metadata(topicId: number, word: string): WordListWordMetaV2 {
  return {
    topic_key: {
      topic_id: topicId,
      word_level_id: 1,
      tag_id: 2,
    },
    word,
    mean_cn: `${word} 的释义`,
  };
}

describe('categorizeCurrentBookWords', () => {
  it('将 roadmap 互斥且完整地分为未学、已斩和已学', () => {
    const roadmap = [1, 2, 3, 4, 5].map(roadmapItem);
    const records: TopicLearnRecordMap = {
      2: createTopicLearnRecord({
        bookId: 10,
        topicId: 2,
        topicScore: UNLEARNED_SCORE,
      }),
      3: createTopicLearnRecord({ bookId: 10, topicId: 3, topicScore: -1 }),
      4: createTopicLearnRecord({ bookId: 10, topicId: 4, topicScore: 0 }),
      5: createTopicLearnRecord({ bookId: 10, topicId: 5, topicScore: 5 }),
    };

    const categorized = categorizeCurrentBookWords(roadmap, records);

    expect(categorized.unlearned.map((item) => item.roadmap.topic_id)).toEqual([
      1, 2,
    ]);
    expect(categorized.killed.map((item) => item.roadmap.topic_id)).toEqual([
      3,
    ]);
    expect(categorized.learned.map((item) => item.roadmap.topic_id)).toEqual([
      4, 5,
    ]);

    const allIds = Object.values(categorized)
      .flat()
      .map((item) => item.roadmap.topic_id);
    expect(allIds.sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5]);
    expect(
      categorized.learned.some((item) => item.roadmap.topic_id === 3)
    ).toBe(false);
  });

  it('取消斩词后将单词从已斩列表移入已学列表', () => {
    const roadmap = [roadmapItem(1)];
    const killedRecord = createTopicLearnRecord({
      bookId: 10,
      topicId: 1,
      topicScore: -4,
    });

    const before = categorizeCurrentBookWords(roadmap, { 1: killedRecord });
    const restoredRecord = applyUnkill(killedRecord, {
      bookId: 10,
      topicId: 1,
      doNumDelta: 0,
    });
    const after = categorizeCurrentBookWords(roadmap, { 1: restoredRecord });

    expect(before.killed.map((item) => item.roadmap.topic_id)).toEqual([1]);
    expect(after.killed).toEqual([]);
    expect(after.learned.map((item) => item.roadmap.topic_id)).toEqual([1]);
  });
});

describe('sortCurrentBookWords', () => {
  const roadmap = [1, 2, 3, 4, 5].map(roadmapItem);
  const metadataByTopicId = createWordMetadataMap([
    metadata(1, 'banana'),
    metadata(2, 'Apple'),
    metadata(3, 'apple'),
    metadata(5, ''),
  ]);
  const entries = categorizeCurrentBookWords(
    roadmap,
    Object.fromEntries(
      roadmap.map((item) => [
        item.topic_id,
        createTopicLearnRecord({
          bookId: 10,
          topicId: item.topic_id,
          topicScore: 1,
        }),
      ])
    ),
    metadataByTopicId
  ).learned;

  it('按大小写不敏感的 A 到 Z 排序，同名单词保持 roadmap 顺序，缺失项置后', () => {
    expect(
      sortCurrentBookWords(entries, 'asc').map((item) => item.roadmap.topic_id)
    ).toEqual([2, 3, 1, 4, 5]);
  });

  it('按 Z 到 A 排序，同时保持同名稳定和缺失项置后', () => {
    expect(
      sortCurrentBookWords(entries, 'desc').map((item) => item.roadmap.topic_id)
    ).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('word list URL state', () => {
  it('从查询参数恢复 Tab 和排序方式', () => {
    expect(parseWordListTab('unlearned')).toBe('unlearned');
    expect(parseWordListTab('killed')).toBe('killed');
    expect(parseWordSortOrder('desc')).toBe('desc');
  });

  it('缺失或非法参数回退到已学和正序', () => {
    expect(parseWordListTab(null)).toBe('learned');
    expect(parseWordListTab('unknown')).toBe('learned');
    expect(parseWordSortOrder(null)).toBe('asc');
    expect(parseWordSortOrder('unknown')).toBe('asc');
  });
});
