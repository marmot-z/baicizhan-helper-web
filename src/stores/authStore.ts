import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserBindInfo, LoginRequest } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  user: UserBindInfo[] | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  getUserInfo: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials: LoginRequest) => {
        try {
          const token = await authService.login(credentials);                
          
          // 登录成功后获取用户信息
          try {
            const userInfo = await authService.getUserInfo();
            set({
              user: userInfo,
              token: token,
              isAuthenticated: true,
            });
          } catch (userError) {
            // 如果获取用户信息失败，仍然保持登录状态，但用户信息为空
            set({
              user: null,
              token: token,
              isAuthenticated: true,
            });
          }
        } catch (error) {
          throw error;
        }
      },

      logout: async () => {
        set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
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