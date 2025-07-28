// Token管理工具
export class TokenManager {
  private static readonly TOKEN_KEY = 'baicizhan-helper-web.token';
  private static readonly REFRESH_TOKEN_KEY = 'baicizhan-helper-web.refresh_token';
  private static readonly TOKEN_EXPIRY_KEY = 'baicizhan-helper-web.token_expiry';

  // 存储访问令牌
  static setToken(token: string, expiresIn?: number): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    
    if (expiresIn) {
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
    }
  }

  // 获取访问令牌
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // 存储刷新令牌
  static setRefreshToken(refreshToken: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  // 获取刷新令牌
  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  // 检查token是否过期
  static isTokenExpired(): boolean {
    const expiryTime = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryTime) {
      return false; // 如果没有过期时间，假设未过期
    }
    
    return Date.now() > parseInt(expiryTime);
  }

  // 清除所有token
  static clearTokens(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  // 获取Authorization header
  static getAuthHeader(): string | null {
    const token = this.getToken();
    return token ? `Bearer ${token}` : null;
  }

  // 检查是否有有效的token
  static hasValidToken(): boolean {
    const token = this.getToken();
    return token !== null && !this.isTokenExpired();
  }
}

// 导出便捷函数
export const {
  setToken,
  getToken,
  setRefreshToken,
  getRefreshToken,
  isTokenExpired,
  clearTokens,
  getAuthHeader,
  hasValidToken
} = TokenManager;