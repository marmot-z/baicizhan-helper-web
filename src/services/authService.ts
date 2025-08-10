import { ApiService } from './api';
import type { LoginRequest, LoginResponse, User, SendSmsRequest, SendSmsResponse } from '../types';

export const authService = {
  // 发送短信验证码
  async sendSmsVerifyCode(phoneNum: string): Promise<SendSmsResponse> {
    const response = await ApiService.post<SendSmsResponse>(`/login/sendSmsVerifyCode/${phoneNum}`);
    return response.data;
  },

  // 用户登录
  async login(data: LoginRequest): Promise<LoginResponse> {
    const { phoneNum, smsVerifyCode } = data;
    const response = await ApiService.post<LoginResponse>(`/login/${phoneNum}/${smsVerifyCode}`);
    return response.data;
  },

  // 获取用户信息
  async getUserInfo(): Promise<User> {
    const response = await ApiService.get<User>('/auth/me');
    return response.data;
  },

  // 用户登出
  async logout(): Promise<void> {
    await ApiService.post('/auth/logout');
  },
};