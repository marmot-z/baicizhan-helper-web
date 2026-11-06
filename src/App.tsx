import { RouterProvider } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { router } from './router';
import { useEffect } from 'react';
import { useAuthInit } from './hooks';
import { useAuthStore } from './stores/authStore';

function App() {
  useAuthInit();
  const isSwitchingAccount = useAuthStore((state) => state.isSwitchingAccount);

  useEffect(() => {
    const switchMessage = sessionStorage.getItem('account-switch-message');

    if (switchMessage) {
      sessionStorage.removeItem('account-switch-message');
      toast.success(switchMessage);
    }

    // 检查URL中是否有邀请码
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('inviteCode');
    
    if (inviteCode) {
      localStorage.setItem('invite_code', inviteCode);
      localStorage.setItem('invite_timestamp', Date.now().toString());
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div inert={isSwitchingAccount} aria-busy={isSwitchingAccount}>
        <RouterProvider router={router} />
      </div>
      {isSwitchingAccount && (
        <div className="account-switch-overlay" role="status" aria-live="polite">
          <div>登录微信账号中，请稍候…</div>
        </div>
      )}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

export default App;
