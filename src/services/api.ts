import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from '../types';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { accountSession, AccountSessionChangedError } from './accountSession';

declare module 'axios' {
  interface AxiosRequestConfig {
    allowDuringAccountSwitch?: boolean;
    accountVersion?: number;
    finishAccountRequest?: () => void;
  }
}

function checkResponseSession(config?: AxiosRequestConfig) {
  config?.finishAccountRequest?.();

  if (config?.accountVersion !== undefined) {
    accountSession.assertCurrent(config.accountVersion);
  }
}

interface ApiErrorBody {
  message?: unknown;
}

export class ApiError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

interface ToastWindow extends Window {
  __lastToastTime?: number;
}

const getRequestPath = (url?: string) => url?.split('?')[0];

const getResponseErrorMessage = (
  response: AxiosResponse,
  fallback: string,
) => {
  const body = response.data as ApiErrorBody | undefined;
  const serverMessage =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message.trim()
      : null;
  const requestPath = getRequestPath(response.config.url);

  return serverMessage || `${fallback}${requestPath ? `（${requestPath}）` : ''}`;
};

// API基础配置
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : '//www.baicizhan-helper.cn/');

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
    if (accountSession.isSwitching() && !config.allowDuringAccountSwitch) {
      throw new AccountSessionChangedError();
    }

    config.accountVersion = accountSession.getVersion();
    config.finishAccountRequest = accountSession.trackRequest();
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

const rejectApiResponse = (response: AxiosResponse, code: number) => {
  const fallback = code === 401 ? '请重新登录'
    : code === 403 ? '权限不足'
    : code >= 500 ? '服务器处理请求失败' : '请求失败';
  const message = getResponseErrorMessage(response, fallback);

  if (code === 401) {
    const authState = useAuthStore.getState();
    // 旧请求的迟到响应不能清除刚重新登录的账号。
    if (authState.token && response.config.headers?.access_token === authState.token) {
      void authState.logout();
      window.location.href = '/page/login';
    }
  }

  if (code === 403) {
    const now = Date.now();
    const toastWindow = window as ToastWindow;
    if (now - (toastWindow.__lastToastTime || 0) > 5000) {
      toastWindow.__lastToastTime = now;
      setTimeout(() => {
        if (response.config.accountVersion === accountSession.getVersion() && !accountSession.isSwitching()) {
          toast.error(message);
        }
      }, 0);
    }
  }

  return Promise.reject(new ApiError(code, message));
};

// 同时处理 HTTP 状态码和响应体业务码；只有明确的 401 才清理登录态。
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    checkResponseSession(response.config);

    const code = response.data?.code;
    if (typeof code === 'number' && (code < 200 || code >= 300)) {
      return rejectApiResponse(response, code);
    }
    return response;
  },
  (error) => {
    checkResponseSession(error?.config);

    if (axios.isAxiosError(error) && error.response) {
      return rejectApiResponse(error.response, error.response.status);
    }
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
