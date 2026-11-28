import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserBindInfo, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { useStudyStore } from './studyStore';
import { useWordBookStore } from './wordBookStore';
import { studySessionStore } from '../services/study/sessionStore';
import { studyRecordStore } from '../services/study/recordStore';
import { syncBeforeAccountSwitch } from '../services/study/syncBeforeAccountSwitch';
import { accountSession, createAccountStorageId } from '../services/accountSession';

export type LoginMethod = 'phone' | 'weixin' | null;

interface AuthState {
  user: UserBindInfo[] | null;
  token: string | null;
  isAuthenticated: boolean;
  loginMethod: LoginMethod;
  isSwitchingAccount: boolean;
  accountStorageId: string | null;
  login: (credentials: LoginRequest, inviteCode?: string) => Promise<void>;
  loginWithWeixin: () => Promise<boolean>;
  logout: () => Promise<void>;
  getUserInfo: () => Promise<void>;
  checkAndGetUserInfo: () => Promise<void>;
}

export function canLoginWithWeixin(state: Pick<AuthState, 'isAuthenticated' | 'loginMethod' | 'user'>): boolean {
  return state.isAuthenticated && state.loginMethod !== 'weixin' && Boolean(state.user?.some((user) => user.provider === 'weixin'));
}

async function clearAccountData() {
  useStudyStore.getState().clearStudyData();
  await studyRecordStore.clearAll();
  await studySessionStore.clearAll();
  window.localStorage.removeItem('study-record-store');
  window.localStorage.removeItem('study-session-store');
  useWordBookStore.getState().clearAllData();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      const completeLogin = async (token: string, loginMethod: LoginMethod) => {
        if (!token?.trim()) {
          throw new Error('登录结果缺少凭据');
        }

        accountSession.invalidate();
        const version = accountSession.getVersion();
        const accountStorageId = createAccountStorageId();
        accountSession.bindStorageSession(token, accountStorageId);
        set({ user: null, token, loginMethod, isAuthenticated: true, accountStorageId });
        studyRecordStore.configureAccount(accountStorageId);

        try {
          const user = await authService.getUserInfo(true);
          accountSession.assertCurrent(version);
          set({ user });
        } catch {
          // 资料查询失败保留登录态；401 已由请求层处理，不能恢复已失效会话。
        }

        accountSession.assertCurrent(version);
      };

      return {
        user: null,
        token: null,
        isAuthenticated: false,
        loginMethod: null,
        isSwitchingAccount: false,
        accountStorageId: null,

        login: async (credentials, inviteCode) => {
          const version = accountSession.getVersion();
          const token = await authService.login(credentials, inviteCode);
          accountSession.assertCurrent(version);
          await completeLogin(token, 'phone');
        },

        loginWithWeixin: async () => {
          if (get().isSwitchingAccount || !canLoginWithWeixin(get())) {
            throw new Error('当前无法切换微信账号');
          }

          accountSession.assertPersistedSession(get().token);
          set({ isSwitchingAccount: true });
          accountSession.setSwitching(true);

          try {
            const discardedRecords = await syncBeforeAccountSwitch();
            const version = accountSession.getVersion();
            const token = await authService.loginWithWeixin();
            accountSession.assertCurrent(version);

            // Clear the captured old namespace while its credentials still own it.
            await clearAccountData();
            accountSession.assertCurrent(version);
            accountSession.invalidate();
            set({ user: null, token: null, loginMethod: null, isAuthenticated: false });
            await completeLogin(token, 'weixin');
            return discardedRecords;
          } catch (error) {
            // A stale tab must not persist its old credentials over another tab's login.
            if (!accountSession.invalidateIfPersistedSessionChanged()) {
              accountSession.setSwitching(false);
              set({ isSwitchingAccount: false });
            }
            throw error;
          }
          // 成功后保持页面锁定，由入口重新加载首页。
        },

        logout: async () => {
          accountSession.assertPersistedSession(get().token);
          accountSession.invalidate();
          accountSession.setSwitching(true);
          try { await clearAccountData(); }
          finally {
            if (!accountSession.invalidateIfPersistedSessionChanged()) {
              accountSession.setSwitching(false);
              set({ user: null, token: null, loginMethod: null, isAuthenticated: false, isSwitchingAccount: false, accountStorageId: null });
              accountSession.bindStorageSession(null);
              studyRecordStore.configureAccount('__signed_out__');
            }
          }
        },

        getUserInfo: async () => {
          const version = accountSession.getVersion();
          const user = await authService.getUserInfo();
          accountSession.assertCurrent(version);
          set({ user });
        },

        checkAndGetUserInfo: async () => {
          if (get().user === null && get().isAuthenticated && !get().isSwitchingAccount) {
            try {
              await get().getUserInfo();
            } catch {
              // 暂时不可用不代表认证失效，401 统一由请求层处理。
            }
          }
        },
      };
    },
    {
      name: 'auth-storage',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState> | undefined;
        return {
          ...currentState,
          user: persisted?.user ?? null,
          token: persisted?.token ?? null,
          isAuthenticated: persisted?.isAuthenticated ?? false,
          loginMethod: persisted?.isAuthenticated ? (persisted.loginMethod ?? 'phone') : null,
          accountStorageId: persisted?.token ? (persisted.accountStorageId ?? accountSession.getStorageKey()) : null,
        };
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loginMethod: state.loginMethod,
        accountStorageId: state.accountStorageId,
      }),
    },
  ),
);

// Freeze this tab's hydrated credentials before any learning data can be opened.
// A later localStorage change belongs to another tab until this tab reloads.
const hydratedAuth = useAuthStore.getState();
if (hydratedAuth.token) accountSession.bindStorageSession(hydratedAuth.token, hydratedAuth.accountStorageId);
