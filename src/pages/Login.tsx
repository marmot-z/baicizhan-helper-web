import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoginForm } from '../components';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../constants';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // 如果已经登录，重定向到仪表板
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-300/10 to-indigo-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo和标题 */}
        <div className="text-center mb-8 animate-fade-in">
          <Link to="/" className="inline-block group">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-blue-500/25">
              <span className="text-white text-3xl font-bold tracking-tight">百</span>
            </div>
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent mb-3">
            欢迎回来
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            登录您的百词斩助手账户
          </p>
          <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mx-auto mt-4"></div>
        </div>

        {/* 登录表单 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 animate-slide-up">
          <LoginForm />
        </div>

        {/* 返回首页 */}
        <div className="mt-8 text-center animate-fade-in-delayed">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-all duration-300 group font-medium"
          >
            <svg className="w-4 h-4 mr-2 transform transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </Link>
        </div>
      </div>


    </div>
  );
};

export default Login;