import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthInit } from './hooks';

function App() {
  // 初始化认证状态
  useAuthInit();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
