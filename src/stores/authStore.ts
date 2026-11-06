import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserBindInfo, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { useStudyStore } from './studyStore';
import { useWordBookStore } from './wordBookStore';
import { studySessionStore } from '../services/study/sessionStore';
import { studyRecordStore } from '../services/study/recordStore';
import { syncBeforeAccountSwitch } from '../services/study/syncBeforeAccountSwitch';
import { accountSession } from '../services/accountSession';

export type LoginMethod = 'phone' | 'weixin' | null;

interface AuthState {
  user: UserBindInfo[] | null;
  token: string | null;
  isAuthenticated: boolean;
  loginMethod: LoginMethod;
  isSwitchingAccount: boolean;
  login: (credentials: LoginRequest, inviteCode?: string) => Promise<void>;
  loginWithWeixin: () => Promise<boolean>;
  logout: () => Promise<void>;
  getUserInfo: () => Promise<void>;
  checkAndGetUserInfo: () => Promise<void>;
}

export function canLoginWithWeixin(state: Pick<AuthState, 'isAuthenticated' | 'loginMethod' | 'user'>): boolean {
  return state.isAuthenticated && state.loginMethod !== 'weixin' && Boolean(state.user?.some((user) => user.provider === 'weixin'));
}

function clearAccountData() {
  useStudyStore.getState().clearStudyData();
  studySessionStore.clearAll();
  studyRecordStore.clearAll();
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
        set({ user: null, token, loginMethod, isAuthenticated: true });

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

          set({ isSwitchingAccount: true });
          accountSession.setSwitching(true);

          try {
            const discardedRecords = await syncBeforeAccountSwitch();
            const version = accountSession.getVersion();
            const token = await authService.loginWithWeixin();
            accountSession.assertCurrent(version);

            // 成功取得新凭据后才登出旧账号；清理与安装新会话之间不让出执行权。
            accountSession.invalidate();
            set({ user: null, token: null, loginMethod: null, isAuthenticated: false });
            clearAccountData();
            await completeLogin(token, 'weixin');
            return discardedRecords;
          } catch (error) {
            accountSession.setSwitching(false);
            set({ isSwitchingAccount: false });
            throw error;
          }
          // 成功后保持页面锁定，由入口重新加载首页。
        },

        logout: async () => {
          accountSession.invalidate();
          accountSession.setSwitching(false);
          set({ user: null, token: null, loginMethod: null, isAuthenticated: false, isSwitchingAccount: false });
          clearAccountData();
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
        };
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loginMethod: state.loginMethod,
      }),
    },
  ),
);
