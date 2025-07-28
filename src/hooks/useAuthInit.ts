import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { TokenManager } from '../utils/tokenManager';
import { authService } from '../services/authService';

/**
 * 认证初始化Hook
 * 用于应用启动时检查和恢复认证状态
 */
export const useAuthInit = () => {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      
      try {
        // 检查本地是否有有效的token
        const token = TokenManager.getToken();
        
        if (token && !TokenManager.isTokenExpired()) {
          // Token存在且未过期，尝试获取用户信息
          try {
            const userInfo = await authService.getUserInfo();
            setUser(userInfo);
          } catch (error) {
            // 获取用户信息失败，可能token无效
            console.error('Failed to get user info:', error);
            await logout();
          }
        } else if (token && TokenManager.isTokenExpired()) {
          // Token过期，尝试刷新
          const refreshToken = TokenManager.getRefreshToken();
          
          if (refreshToken) {
            try {
              const response = await authService.refreshToken();
              TokenManager.setToken(response.token);
              
              // 获取用户信息
              const userInfo = await authService.getUserInfo();
              setUser(userInfo);
            } catch (error) {
              // 刷新失败，清除认证状态
              console.error('Failed to refresh token:', error);
              await logout();
            }
          } else {
            // 没有refresh token，清除认证状态
            await logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [setUser, setLoading, logout]);
};