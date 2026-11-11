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
  skippedWordCount: number;
  init: (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => Promise<void>;
}

async function loadStudyWords(bookId: number, candidates: UserRoadMapElementV2[]) {
  const result = await studyService.getXModeWordDetails(bookId, candidates.map((word) => word.topic_id));
  if (result.words.length === 0) {
    throw new Error('本轮单词暂时无法加载，请重新加载');
  }

  return result;
}

export const useStudyStrategy = (): UseStudyStrategyResult => {
  const { syncCurrentBookState } = useStudyStore();
  const [studyInstance, setStudyInstance] = useState<Study | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [restored, setRestored] = useState(false);
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [skippedWordCount, setSkippedWordCount] = useState(0);

  const init = useCallback(
    async (mode: StudyMode, studyPlans: SelectBookPlanInfo[]) => {
      setError(null);
      setLoading(true);
      setRestored(false);
      setDraftSaveFailed(false);
      setSkippedWordCount(0);

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

          if (savedDraft?.state.wordTopicIds.length) {
            const roadmapByTopicId = new Map(wordList.map((word) => [word.topic_id, word]));
            const savedWords = savedDraft.state.wordTopicIds
              .map((topicId) => roadmapByTopicId.get(topicId))
              .filter((word): word is UserRoadMapElementV2 => word !== undefined);
            const batch = await loadStudyWords(currentStudyPlan.book_id, savedWords);
            const persistCheckpoint = (state: LearnSessionState) => {
              const saved = studySessionStore.save({
                ...savedDraft,
                updatedAt: Date.now(),
                state,
              });
              setDraftSaveFailed(!saved);
            };

            let instance: Study | undefined;
            try {
              instance = Study.restore(
                savedWords,
                batch.words,
                {
                  planType: 'XModelNewStudy',
                  bookId: currentStudyPlan.book_id,
                },
                savedDraft.state,
                persistCheckpoint,
              );
            } catch (restoreError) {
              console.error('恢复学习草稿失败，将重新开始:', restoreError);
            }

            if (instance) {
              await instance.resume();
              setStudyInstance(instance);
              setRestored(true);
              setSkippedWordCount(savedDraft.state.wordTopicIds.length - savedWords.length + batch.missingTopicIds.length);
              setLoading(false);
              return;
            }
          }

          const unlearnedWords: UserRoadMapElementV2[] = homeState.unlearnedWords
            .slice(0, currentStudyPlan.daily_plan_count);

          if (!unlearnedWords.length) {
            throw new Error('所有单词都已学习完成');
          }

          const batch = await loadStudyWords(currentStudyPlan.book_id, unlearnedWords);

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
            batch.words,
            {
              planType: 'XModelNewStudy',
              bookId: currentStudyPlan.book_id,
            },
            undefined,
            persistCheckpoint,
          );
          await instance.start();
          setStudyInstance(instance);
          setSkippedWordCount(batch.missingTopicIds.length);
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
    skippedWordCount,
    init,
  };
};
