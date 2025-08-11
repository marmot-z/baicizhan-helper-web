import { ApiService } from './api';
import type { LoginRequest, SendSmsResponse, UserBindInfo } from '../types';

export const authService = {
  // 发送短信验证码
  async sendSmsVerifyCode(phoneNum: string): Promise<SendSmsResponse> {
    const response = await ApiService.post<SendSmsResponse>(`/login/sendSmsVerifyCode/${phoneNum}`);
    return response.data;
  },

  // 用户登录
  async login(data: LoginRequest): Promise<string> {
    const { phoneNum, smsVerifyCode } = data;
    const response = await ApiService.post<string>(`/login/${phoneNum}/${smsVerifyCode}`);
    return response.data;
  },

  // 获取用户信息
  async getUserInfo(): Promise<UserBindInfo[]> {
    const response = await ApiService.get<UserBindInfo[]>('/userInfo');
    return response.data;
  },
};