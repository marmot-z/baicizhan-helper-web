import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from '../types';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

// API基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 按照技术设计文档要求，添加access_token字段
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.access_token = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 检查响应数据中的 code 字段
    if (response.data?.code === 401) {
      // 处理401错误（token过期）
      const authState = useAuthStore.getState();
      authState.logout();
      
      // 跳转到登录页面
      window.location.href = '/page/login';
      return Promise.reject(new Error('Token expired'));
    }
    
    if (response.data?.code === 403) {
      // 处理403错误（权限不足）
      console.error('Forbidden access');
      
      // 防抖机制：5秒内只显示一次toast
      const now = Date.now();
      const lastToastTime = (window as any).__lastToastTime || 0;
      
      if (now - lastToastTime > 5000) {
        (window as any).__lastToastTime = now;
        // 使用 setTimeout 确保在 React 上下文中调用 toast
        setTimeout(() => {
          toast.error('权限不足，请开通会员');
        }, 0);
      }
      
      return Promise.reject(new Error(response.data?.message || 'Forbidden access'));
    }
    
    return response;
  },
  async (error) => {
    // 处理网络错误或其他HTTP错误
    return Promise.reject(error);
  }
);

// API请求方法封装
export class ApiService {
  static async get<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  static async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  static async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  static async delete<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  static async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }
}

export default apiClient;