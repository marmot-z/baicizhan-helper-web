import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest } from '../types';
import { authService } from '../services/authService';
import { TokenManager } from '../utils/tokenManager';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  refreshToken: () => Promise<void>;
  getUserInfo: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true });
        try {
          const token = await authService.login(credentials);
          
          // 存储token到localStorage
          TokenManager.setToken(token);
          
          // 登录成功后获取用户信息
          try {
            const userInfo = await authService.getUserInfo();
            set({
              user: userInfo,
              token: token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (userError) {
            // 如果获取用户信息失败，仍然保持登录状态，但用户信息为空
            set({
              user: null,
              token: token,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // 清除本地存储的token
          TokenManager.clearTokens();
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      refreshToken: async () => {
        try {
          const response = await authService.refreshToken();
          
          // 更新本地存储的token
          TokenManager.setToken(response.token);
          
          set({ token: response.token });
        } catch (error) {
          // Token刷新失败，清除认证状态和本地存储
          TokenManager.clearTokens();
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      getUserInfo: async () => {
        try {
          const user = await authService.getUserInfo();
          set({ user: user });
        } catch (error) {
          console.error('Get user info error:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);