import { useState, useEffect } from 'react';
import { Study } from '../services/study/Study';

/**
 * Custom hook to manage Study state using the Observer pattern.
 * Subscribes to the Study instance and updates local state whenever the Study state changes.
 */
export const useStudyState = (study: Study | null) => {
  const [wordCard, setWordCard] = useState<any | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!study) {
      setWordCard(null);
      setIsCompleted(false);
      return;
    }

    // Function to sync state from Study instance
    const syncState = () => {
      setWordCard(study.getCurrentWord()?.toObject() || null);
      setIsCompleted(study.completed);
    };

    // Initial sync
    syncState();

    // Subscribe to changes
    // The subscribe method returns an unsubscribe function
    const unsubscribe = study.subscribe(syncState);

    return () => {
      unsubscribe();
    };
  }, [study]);

  return { wordCard, isCompleted };
};
