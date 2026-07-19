import { useCallback, useState } from 'react';
import { Study } from '../services/study/Study';
import type { SelectBookPlanInfo, UserRoadMapElementV2 } from '../types';
import { useStudyStore } from '../stores/studyStore';
import { studyService } from '../services/studyService';
import {
  createStudySessionId,
  getLocalPlanDate,
  studySessionStore,
} from '../services/study/sessionStore';
import type { LearnSessionState } from '../services/study/sessionTypes';

type StudyMode = 'learn' | 'review';

interface UseStudyStrategyResult {
  studyInstance: Study | null;
  loading: boolean;
  error: Error | null;
  restored: boolean;
  draftSaveFailed: boolean;
  init: (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => Promise<void>;
}

export const useStudyStrategy = (): UseStudyStrategyResult => {
  const { syncCurrentBookState } = useStudyStore();
  const [studyInstance, setStudyInstance] = useState<Study | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [restored, setRestored] = useState(false);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);

  const init = useCallback(
    async (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => {
      setError(null);
      setLoading(true);
      setRestored(false);
      setDraftSaveFailed(false);

      try {
        const currentStudyPlan = studyPlans[0];
        if (!currentStudyPlan) {
          throw new Error('学习计划未就绪');
        }

        if (mode === 'learn') {
          await syncCurrentBookState(currentStudyPlan.book_id);
          const { homeState, syncedBookId, wordList } = useStudyStore.getState();

          if (syncedBookId !== currentStudyPlan.book_id) {
            throw new Error('当前书学习状态同步未完成');
          }

          const planDate = getLocalPlanDate();
          studySessionStore.removeExpired(planDate);
          const savedDraft = studySessionStore.load('learn', currentStudyPlan.book_id);

          if (savedDraft) {
            try {
              const roadmapByTopicId = new Map(wordList.map((word) => [word.topic_id, word]));
              const savedWords = savedDraft.state.wordTopicIds.map((topicId) =>
                roadmapByTopicId.get(topicId),
              );
              if (savedWords.some((word) => !word)) {
                throw new Error('学习草稿中的单词已不在当前路线图中');
              }

              const topicIds = savedDraft.state.wordTopicIds;
              const uiModels = await studyService.getXModeWordDetails(
                currentStudyPlan.book_id,
                topicIds,
              );
              if (
                uiModels.length !== topicIds.length ||
                topicIds.some((topicId) => !uiModels.some((model) => model.topicId === topicId))
              ) {
                throw new Error('学习草稿缺少对应的单词资源');
              }

              const persistCheckpoint = (state: LearnSessionState) => {
                const saved = studySessionStore.save({
                  ...savedDraft,
                  updatedAt: Date.now(),
                  state,
                });
                setDraftSaveFailed(!saved);
              };
              const orderedModels = topicIds.map(
                (topicId) => uiModels.find((model) => model.topicId === topicId)!,
              );
              const instance = Study.restore(
                savedWords as UserRoadMapElementV2[],
                orderedModels,
                {
                  planType: 'XModelNewStudy',
                  bookId: currentStudyPlan.book_id,
                },
                savedDraft.state,
                persistCheckpoint,
              );
              setStudyInstance(instance);
              setRestored(true);
              setLoading(false);
              return;
            } catch (restoreError) {
              console.error('恢复学习进度失败，将重新开始:', restoreError);
              studySessionStore.clear('learn', currentStudyPlan.book_id);
            }
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

          const now = Date.now();
          const sessionId = createStudySessionId();
          const persistCheckpoint = (state: LearnSessionState) => {
            const saved = studySessionStore.save({
              version: 1,
              mode: 'learn',
              bookId: currentStudyPlan.book_id,
              planDate,
              createdAt: now,
              updatedAt: Date.now(),
              sessionId,
              state,
            });
            setDraftSaveFailed(!saved);
          };
          const instance = new Study(
            unlearnedWords,
            uiModels,
            {
              planType: 'XModelNewStudy',
              bookId: currentStudyPlan.book_id,
            },
            undefined,
            persistCheckpoint,
          );
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
    restored,
    draftSaveFailed,
    init,
  };
};
