import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuthInit = () => {
  const { token, getUserInfo, isSwitchingAccount } = useAuthStore();

  useEffect(() => {
    if (!token || isSwitchingAccount) {
      return;
    }

    void getUserInfo().catch(() => {
      // 网络错误不登出；真实的 401 由请求层统一处理。
    });
  }, [token, getUserInfo, isSwitchingAccount]);
};
