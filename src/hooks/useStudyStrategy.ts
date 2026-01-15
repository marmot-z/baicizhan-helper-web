import { useCallback, useState } from 'react';
import { Study } from '../services/study/Study';
import type { SelectBookPlanInfo, UserRoadMapElementV2, UserDoneWordRecord } from '../types';
import { useStudyStore } from '../stores/studyStore';
import { studyService } from '../services/studyService';

type StudyMode = 'learn' | 'review';

interface UseStudyStrategyResult {
  studyInstance: Study | null;
  loading: boolean;
  error: Error | null;
  init: (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => Promise<void>;
}

export const useStudyStrategy = (): UseStudyStrategyResult => {
  const { wordList } = useStudyStore();
  const [studyInstance, setStudyInstance] = useState<Study | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const init = useCallback(
    async (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => {
      setError(null);
      setLoading(true);

      try {
        const currentStudyPlan = studyPlans[0];
        if (!currentStudyPlan || !wordList.length) {
          throw new Error('学习计划或单词列表未就绪');
        }

        if (mode === 'learn') {
          const learnedWords = await studyService.getLearnedWords(
            currentStudyPlan.book_id
          );
          const learnedTopicIds = new Set(
            learnedWords.map((word) => word.topic_id)
          );

          const unlearnedWords: UserRoadMapElementV2[] = wordList
            .filter((word) => !learnedTopicIds.has(word.topic_id))
            .slice(0, currentStudyPlan.daily_plan_count);

          if (!unlearnedWords.length) {
            throw new Error('所有单词都已学习完成');
          }

          const instance = new Study(unlearnedWords);
          await instance.start();
          setStudyInstance(instance);
          setLoading(false);
          return;
        }

        if (mode === 'review') {
          // 1. 获取已学单词
          const learnedWords = await studyService.getLearnedWords(
            currentStudyPlan.book_id
          );

          if (!learnedWords.length) {
            throw new Error('暂无已学单词，无法复习');
          }

          // 2. 按 update_days 降序排序（距离现在最久的在前）
          const sortedLearnedWords = learnedWords.sort(
            (a, b) => b.update_days - a.update_days
          );

          // 3. 截取复习计划数量
          const reviewCount = currentStudyPlan.review_plan_count || 20; // 默认20兜底
          const targetWords = sortedLearnedWords.slice(0, reviewCount);

          // 4. 从全局 wordList 中查找对应的完整信息（复用 options）
          // 建立 topic_id -> word 映射以提高查找效率
          const wordMap = new Map(wordList.map((w) => [w.topic_id, w]));
          
          const reviewWords: UserRoadMapElementV2[] = [];
          
          for (const lw of targetWords) {
            const wordInfo = wordMap.get(lw.topic_id);
            if (wordInfo) {
              reviewWords.push(wordInfo);
            }
          }

          if (!reviewWords.length) {
            throw new Error('未找到可复习的单词详情');
          }

          // 5. 初始化 Study 实例，注入复习上报策略
          const instance = new Study(reviewWords, async (study) => {
            const words = study.getWords();
            const failMap = study.getFailMap();
            const useTimeMap = study.getUseTimeMap();

            const doneWordRecords: UserDoneWordRecord[] = words.map((word) => {
              const wrongTimes = failMap.get(word.topic_id) || 0;
              const usedTime = useTimeMap.get(word.topic_id) || 0;

              return {
                word_topic_id: word.topic_id,
                current_score: 0,
                span_days: 0,
                used_time: usedTime,
                done_times: 1,
                wrong_times: wrongTimes,
                is_first_do_at_today: 1,
                tag_id: word.tag_id,
                spell_score: 0,
                listening_score: 0,
                chn_score: 0,
                review_round: 0,
              };
            });

            await studyService.updateReviewData(doneWordRecords);
          });

          await instance.start();
          setStudyInstance(instance);
          setLoading(false);
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setLoading(false);
      }
    },
    [wordList]
  );

  return {
    studyInstance,
    loading,
    error,
    init,
  };
};

