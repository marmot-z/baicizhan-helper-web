import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useEffect } from 'react';

function App() {
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
      <RouterProvider router={router} />
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
