import type { UserRoadMapElementV2, WordListWordMetaV2 } from '../types';
import {
  isKilledRecord,
  isUnlearnedRecord,
  type TopicLearnRecordMap,
} from '../types/studyRecord';

export type WordListTab = 'learned' | 'unlearned' | 'killed';
export type WordSortOrder = 'asc' | 'desc';

export function parseWordListTab(value: string | null): WordListTab {
  return value === 'unlearned' || value === 'killed' ? value : 'learned';
}

export function parseWordSortOrder(value: string | null): WordSortOrder {
  return value === 'desc' ? 'desc' : 'asc';
}

export interface CurrentBookWordListEntry {
  roadmap: UserRoadMapElementV2;
  originalIndex: number;
  metadata?: WordListWordMetaV2;
}

export type CategorizedWordLists = Record<
  WordListTab,
  CurrentBookWordListEntry[]
>;

export function createWordMetadataMap(
  metadata: WordListWordMetaV2[]
): Map<number, WordListWordMetaV2> {
  return new Map(metadata.map((item) => [item.topic_key.topic_id, item]));
}

export function categorizeCurrentBookWords(
  roadmap: UserRoadMapElementV2[],
  records: TopicLearnRecordMap,
  metadataByTopicId: ReadonlyMap<number, WordListWordMetaV2> = new Map()
): CategorizedWordLists {
  const result: CategorizedWordLists = {
    learned: [],
    unlearned: [],
    killed: [],
  };

  roadmap.forEach((roadmapItem, originalIndex) => {
    const record = records[roadmapItem.topic_id];
    const entry: CurrentBookWordListEntry = {
      roadmap: roadmapItem,
      originalIndex,
      metadata: metadataByTopicId.get(roadmapItem.topic_id),
    };

    if (isUnlearnedRecord(record)) {
      result.unlearned.push(entry);
    } else if (isKilledRecord(record)) {
      result.killed.push(entry);
    } else {
      result.learned.push(entry);
    }
  });

  return result;
}

export function sortCurrentBookWords(
  entries: CurrentBookWordListEntry[],
  order: WordSortOrder
): CurrentBookWordListEntry[] {
  return [...entries].sort((left, right) => {
    const leftWord = left.metadata?.word.trim() ?? '';
    const rightWord = right.metadata?.word.trim() ?? '';

    if (!leftWord || !rightWord) {
      if (!leftWord && !rightWord) {
        return left.originalIndex - right.originalIndex;
      }
      return leftWord ? -1 : 1;
    }

    const comparison = leftWord.localeCompare(rightWord, 'en', {
      sensitivity: 'base',
    });
    if (comparison !== 0) {
      return order === 'asc' ? comparison : -comparison;
    }

    return left.originalIndex - right.originalIndex;
  });
}
