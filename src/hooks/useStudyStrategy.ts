import { useCallback, useState } from 'react';
import { Study } from '../services/study/Study';
import type { SelectBookPlanInfo, UserRoadMapElementV2 } from '../types';
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
  const { syncCurrentBookState } = useStudyStore();
  const [studyInstance, setStudyInstance] = useState<Study | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const init = useCallback(
    async (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => {
      setError(null);
      setLoading(true);

      try {
        const currentStudyPlan = studyPlans[0];
        if (!currentStudyPlan) {
          throw new Error('学习计划未就绪');
        }

        if (mode === 'learn') {
          await syncCurrentBookState(currentStudyPlan.book_id);
          const { homeState, syncedBookId } = useStudyStore.getState();

          if (syncedBookId !== currentStudyPlan.book_id) {
            throw new Error('当前书学习状态同步未完成');
          }

          const unlearnedWords: UserRoadMapElementV2[] = homeState.unlearnedWords
            .slice(0, currentStudyPlan.daily_plan_count);

          if (!unlearnedWords.length) {
            throw new Error('所有单词都已学习完成');
          }

          // Fetch UI Models
          const topicIds = unlearnedWords.map(w => w.topic_id);
          const uiModels = await studyService.getXModeWordDetails(
            currentStudyPlan.book_id,
            topicIds
          );

          const instance = new Study(unlearnedWords, uiModels, {
            planType: 'XModelNewStudy',
            bookId: currentStudyPlan.book_id
          });
          await instance.start();
          setStudyInstance(instance);
          setLoading(false);
          return;
        }

        // 复习已统一收口到 ReviewPage（reviewService + ReviewFlow），
        // 不再经由 StudyView 的旧 updateReviewData 链路。
        throw new Error('复习请使用复习页面（ReviewPage）');
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setLoading(false);
      }
    },
    [syncCurrentBookState]
  );

  return {
    studyInstance,
    loading,
    error,
    init,
  };
};
