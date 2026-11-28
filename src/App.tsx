import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useEffect } from 'react';
import { useAuthInit } from './hooks';
import { useAuthStore } from './stores/authStore';
import { useStudyStore } from './stores/studyStore';
import { installStudySyncLifecycle } from './services/study/syncEngine';
import StudySyncStatus from './components/study/StudySyncStatus';
import { accountSession } from './services/accountSession';

function App() {
  useAuthInit();
  const isSwitchingAccount = useAuthStore((state) => state.isSwitchingAccount);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    let reloading = false;
    const reloadIfSessionChanged = () => {
      if (reloading || !accountSession.invalidateIfPersistedSessionChanged()) return;
      reloading = true;
      useStudyStore.getState().clearStudyData();
      // Recreate all flow instances and request headers from the newly persisted account.
      window.location.reload();
    };
    const onStorage = (event: StorageEvent) => {
      if ((event.key === 'auth-storage' || event.key === null)
        && (!event.storageArea || event.storageArea === window.localStorage)) reloadIfSessionChanged();
    };
    window.addEventListener('storage', onStorage);
    reloadIfSessionChanged();
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!token) return;
    return installStudySyncLifecycle(
      (bookId, forcePull) => { void useStudyStore.getState().syncCurrentBookState(bookId, { forcePull }).catch(console.error); },
      () => useStudyStore.getState().studyPlan?.book_id,
    );
  }, [token]);

  useEffect(() => {
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
        {token && <StudySyncStatus />}
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
