import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthInit } from './hooks';
import { useAuthStore } from './stores/authStore';

function App() {
  // 初始化认证状态
  useAuthInit();
  
  const { isLoading } = useAuthStore();
  
  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
