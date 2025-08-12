import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import type { LoginRequest } from '../types';

interface LoginFormProps {
  onSubmit?: (credentials: LoginRequest) => Promise<void>;
  loading?: boolean;
  error?: string;
}

export default function LoginForm({ onSubmit, loading: externalLoading = false, error: externalError }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginRequest>({
    phoneNum: '',
    smsVerifyCode: '',
  });
  const [localError, setLocalError] = useState<string>('');
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  
  const { login } = useAuthStore();
  
  const loading = externalLoading;
  const error = externalError || localError;

  // 倒计时逻辑
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!formData.phoneNum) {
      setLocalError('请输入手机号码');
      return;
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(formData.phoneNum)) {
      setLocalError('请输入正确的手机号码');
      return;
    }

    setSendingCode(true);
    setLocalError('');
    
    try {
      await authService.sendSmsVerifyCode(formData.phoneNum);
      setCountdown(60); // 开始60秒倒计时
    } catch (err: any) {
      setLocalError(err.message || '发送验证码失败，请稍候再试');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // 使用默认的登录逻辑
        await login(formData);
      }
    } catch (err: any) {
      setLocalError(err.message || '登录失败，请重试');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 错误提示 */}
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4 animate-shake">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* 手机号码输入 */}
      <div className="space-y-2">
        <label htmlFor="phoneNum" className="block text-sm font-semibold text-gray-700 mb-2">
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            手机号码
          </span>
        </label>
        <div className="relative group">
          <input
            id="phoneNum"
            name="phoneNum"
            type="tel"
            required
            maxLength={11}
            value={formData.phoneNum}
            onChange={handleInputChange}
            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 placeholder-gray-400 bg-gray-50/50 hover:bg-white hover:border-gray-300 group-hover:shadow-md"
            placeholder="请输入11位手机号码"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              formData.phoneNum.length === 11 ? 'bg-green-500' : 'bg-gray-300'
            }`}></div>
          </div>
        </div>
      </div>

      {/* 验证码输入 */}
      <div className="space-y-2">
        <label htmlFor="smsVerifyCode" className="block text-sm font-semibold text-gray-700 mb-2">
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            短信验证码
          </span>
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative group">
            <input
              id="smsVerifyCode"
              name="smsVerifyCode"
              type="text"
              required
              maxLength={6}
              value={formData.smsVerifyCode}
              onChange={handleInputChange}
              className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 placeholder-gray-400 bg-gray-50/50 hover:bg-white hover:border-gray-300 group-hover:shadow-md"
              placeholder="请输入6位验证码"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                formData.smsVerifyCode.length === 6 ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={countdown > 0 || sendingCode || !formData.phoneNum}
            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 whitespace-nowrap font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
          >
            {sendingCode ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                发送中
              </div>
            ) : countdown > 0 ? (
              <span className="font-mono">{countdown}s</span>
            ) : (
              '获取验证码'
            )}
          </button>
        </div>
      </div>

      {/* 登录按钮 */}
      <button
        type="submit"
        disabled={loading || !formData.phoneNum || !formData.smsVerifyCode}
        className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:transform-none hover:shadow-xl"
      >
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
            <span>登录中...</span>
          </div>
        ) : (
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>立即登录</span>
          </div>
        )}
      </button>

      {/* 安全提示 */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800 mb-1">安全登录</p>
            <p className="text-xs text-blue-600">我们使用短信验证码确保您的账户安全，验证码有效期为5分钟</p>
          </div>
        </div>
      </div>


    </form>
  );
}