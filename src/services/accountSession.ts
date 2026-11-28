// 与 store 解耦，供请求层和异步学习任务判断所属会话。
let version = 0;
let switching = false;
const requests = new Set<Promise<void>>();

export function createAccountStorageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface StorageSession {
  token: string | null;
  storageKey: string;
}
let activeStorageSession: StorageSession | undefined;
const signedOutSession = (): StorageSession => ({ token: null, storageKey: '__signed_out__' });

function storage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function readStorageSession(migrate = false): StorageSession {
  const currentStorage = storage();
  const raw = currentStorage?.getItem('auth-storage');
  if (!raw) return signedOutSession();
  let auth: { state?: { token?: unknown; accountStorageId?: unknown } };
  try { auth = JSON.parse(raw) as typeof auth; } catch { return signedOutSession(); }
  if (typeof auth?.state?.token !== 'string' || !auth.state.token.trim()) return signedOutSession();
  let storageKey = typeof auth.state.accountStorageId === 'string' ? auth.state.accountStorageId : '';
  if (!storageKey && migrate) {
    storageKey = createAccountStorageId();
    auth.state.accountStorageId = storageKey;
    currentStorage?.setItem('auth-storage', JSON.stringify(auth));
  }
  return { token: auth.state.token, storageKey };
}

function activeSession(): StorageSession {
  return activeStorageSession ??= readStorageSession(true);
}

// Bind only after this tab intentionally installs credentials. Other tabs' localStorage
// writes must never silently redirect an existing learning page into a new namespace.
function bindStorageSession(token: string | null, storageKey?: string | null): string {
  if (!token) activeStorageSession = signedOutSession();
  else {
    const persisted = readStorageSession(true);
    activeStorageSession = {
      token,
      storageKey: storageKey || (persisted.token === token ? persisted.storageKey : '') || createAccountStorageId(),
    };
  }
  return activeStorageSession.storageKey;
}

function persistedSessionChanged(): boolean {
  if (!storage()) return false;
  const active = activeSession();
  const persisted = readStorageSession();
  return active.token !== persisted.token || active.storageKey !== persisted.storageKey;
}

function assertPersistedSession(token?: string | null): void {
  // Read-only service tests and server environments do not have browser persistence.
  if (!storage()) return;
  const active = activeSession();
  if ((token !== undefined && token !== active.token) || persistedSessionChanged()) {
    throw new AccountSessionChangedError();
  }
}

function invalidateIfPersistedSessionChanged(): boolean {
  if (!persistedSessionChanged()) return false;
  version += 1;
  switching = true;
  return true;
}

export class AccountSessionChangedError extends Error {
  constructor() {
    super('账号会话已变化或正在切换');
    this.name = 'AccountSessionChangedError';
  }
}

export const accountSession = {
  getStorageKey: () => activeSession().storageKey,
  bindStorageSession,
  assertPersistedSession,
  invalidateIfPersistedSessionChanged,
  getVersion: () => version,
  isSwitching: () => switching,
  setSwitching(value: boolean) { switching = value; },
  invalidate() { version += 1; },
  assertCurrent(expected: number) {
    if (expected !== version) {
      throw new AccountSessionChangedError();
    }
    assertPersistedSession();
  },
  trackRequest(): () => void {
    let finish!: () => void;
    const request = new Promise<void>((resolve) => { finish = resolve; });
    requests.add(request);
    return () => {
      requests.delete(request);
      finish();
    };
  },
  async waitForRequests(): Promise<void> {
    while (requests.size > 0) {
      await Promise.all([...requests]);
    }
  },
};
