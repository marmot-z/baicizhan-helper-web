import type {
  LearnSessionDraftV1,
  ReviewSessionDraftV1,
  StudySessionDraftV1,
  StudySessionMode,
  StudySessionStore,
} from './sessionTypes';

const STORAGE_KEY = 'study-session-store';

interface StudySessionStoreSnapshotV1 {
  version: 1;
  drafts: Record<string, StudySessionDraftV1>;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createEmptySnapshot(): StudySessionStoreSnapshotV1 {
  return { version: 1, drafts: {} };
}

function draftKey(mode: StudySessionMode, bookId: number): string {
  return `${mode}:${bookId}`;
}

function readSnapshot(): StudySessionStoreSnapshotV1 {
  if (!canUseLocalStorage()) {
    return createEmptySnapshot();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptySnapshot();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudySessionStoreSnapshotV1>;
    if (parsed.version !== 1 || !parsed.drafts || typeof parsed.drafts !== 'object') {
      window.localStorage.removeItem(STORAGE_KEY);
      return createEmptySnapshot();
    }
    return parsed as StudySessionStoreSnapshotV1;
  } catch (error) {
    console.error('Failed to parse study session snapshot:', error);
    window.localStorage.removeItem(STORAGE_KEY);
    return createEmptySnapshot();
  }
}

function writeSnapshot(snapshot: StudySessionStoreSnapshotV1): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.error('Failed to persist study session snapshot:', error);
    return false;
  }
}

function isDraftValid(
  draft: StudySessionDraftV1 | undefined,
  mode: StudySessionMode,
  bookId: number,
): draft is StudySessionDraftV1 {
  return Boolean(
    draft &&
      draft.version === 1 &&
      draft.mode === mode &&
      draft.bookId === bookId &&
      draft.state &&
      Array.isArray(draft.state.wordTopicIds),
  );
}

export function getLocalPlanDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createStudySessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadStudySession(mode: 'learn', bookId: number): LearnSessionDraftV1 | null;
function loadStudySession(mode: 'review', bookId: number): ReviewSessionDraftV1 | null;
function loadStudySession(
  mode: StudySessionMode,
  bookId: number,
): StudySessionDraftV1 | null {
  const snapshot = readSnapshot();
  const draft = snapshot.drafts[draftKey(mode, bookId)];
  if (!isDraftValid(draft, mode, bookId)) {
    if (draft) {
      const drafts = { ...snapshot.drafts };
      delete drafts[draftKey(mode, bookId)];
      writeSnapshot({ ...snapshot, drafts });
    }
    return null;
  }
  return draft;
}

export const studySessionStore: StudySessionStore = {
  load: loadStudySession,

  save(draft: StudySessionDraftV1): boolean {
    const snapshot = readSnapshot();
    const otherModeDrafts = Object.fromEntries(
      Object.entries(snapshot.drafts).filter(([key]) => !key.startsWith(`${draft.mode}:`)),
    );
    return writeSnapshot({
      ...snapshot,
      drafts: {
        ...otherModeDrafts,
        [draftKey(draft.mode, draft.bookId)]: draft,
      },
    });
  },

  clear(mode: StudySessionMode, bookId: number): void {
    const snapshot = readSnapshot();
    const key = draftKey(mode, bookId);
    if (!snapshot.drafts[key]) {
      return;
    }
    const drafts = { ...snapshot.drafts };
    delete drafts[key];
    writeSnapshot({ ...snapshot, drafts });
  },

  clearAll(): void {
    if (!canUseLocalStorage()) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
  },

  removeExpired(currentPlanDate: string): void {
    const snapshot = readSnapshot();
    const drafts = Object.fromEntries(
      Object.entries(snapshot.drafts).filter(([, draft]) => draft.planDate === currentPlanDate),
    );
    if (Object.keys(drafts).length !== Object.keys(snapshot.drafts).length) {
      writeSnapshot({ ...snapshot, drafts });
    }
  },
};
