import { ApiService } from './api';
import type { LoginRequest, SendSmsResponse, UserBindInfo } from '../types';

export const authService = {
  // 发送短信验证码
  async sendSmsVerifyCode(phoneNum: string): Promise<SendSmsResponse> {
    const response = await ApiService.post<SendSmsResponse>(`/login/sendSmsVerifyCode/${phoneNum}`);
    return response.data;
  },

  // 用户登录
  async login(data: LoginRequest, inviteCode?: string): Promise<string> {
    const { phoneNum, smsVerifyCode } = data;
    const url = `/login/${phoneNum}/${smsVerifyCode}?inviteCode=${inviteCode??''}`
    const response = await ApiService.post<string>(url);
    return response.data;
  },

  async loginWithWeixin(): Promise<string> {
    const response = await ApiService.post<string>('/login/weixin', undefined, { allowDuringAccountSwitch: true, timeout: 30000 });

    if (response.code !== 200 || typeof response.data !== 'string' || !response.data.trim()) {
      throw new Error('登录微信账号失败');
    }

    return response.data;
  },

  // 获取用户信息
  async getUserInfo(allowDuringAccountSwitch = false): Promise<UserBindInfo[]> {
    const response = await ApiService.get<UserBindInfo[]>('/userInfo', { allowDuringAccountSwitch });

    if (response.code !== 200 || !Array.isArray(response.data)) {
      throw new Error('获取用户信息失败');
    }

    return response.data;
  },

  // 获取用户邀请码
  async getInviteCode(): Promise<string> {
    const response = await ApiService.get<string>('/inviteCode');
    return response.data;
  },
};