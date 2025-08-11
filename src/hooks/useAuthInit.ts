import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

/**
 * 认证初始化Hook
 * 用于应用启动时检查和恢复认证状态
 */
export const useAuthInit = () => {
  const { token, logout, getUserInfo } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 检查是否有token
        if (token) {
          // Token存在，尝试获取用户信息
          try {
            await getUserInfo();
          } catch (error) {
            // 获取用户信息失败，可能token无效
            console.error('Failed to get user info:', error);
            logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        logout();
      }
    };

    initAuth();
  }, [token, logout, getUserInfo]);
};