import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import { ROUTES } from '../constants';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const INVITE_CODE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000;

  // 如果已经登录，重定向到仪表板
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, navigate]);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 处理登录
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !code) {
      toast.error('请填写手机号码和验证码');
      return;
    }
    
    if (phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请输入正确的11位手机号码');
      return;
    }
    
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      toast.error('请输入6位数字验证码');
      return;
    }

    setLoginLoading(true);
    try {
      // 获取本地存储的邀请码和时间戳，并进行登录
      let inviteCode = localStorage.getItem('invite_code');
      const inviteTimestamp = localStorage.getItem('invite_timestamp');

      if (inviteCode && inviteTimestamp) {
        const isValid = Date.now() - parseInt(inviteTimestamp, 10) < INVITE_CODE_EXPIRE_TIME;
        if (!isValid) {
          inviteCode = null;
        }
      }

      await login({ phoneNum: phone, smsVerifyCode: code }, inviteCode || undefined);
      
      // 清理邀请码相关信息
      localStorage.removeItem('invite_code');
      localStorage.removeItem('invite_timestamp');
      
      toast.success('登录成功');
      
      navigate(ROUTES.DASHBOARD);
    } catch (error) {
      console.error('登录失败:', error);
      toast.error('登录失败，请检查手机号码和验证码');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendCode = async () => {
    // 验证手机号码格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      toast.error('请输入正确的11位手机号码');
      return;
    }

    // 防止重复点击
    if (countdown > 0 || isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      
      // 使用authService的sendSmsVerifyCode方法
      await authService.sendSmsVerifyCode(phone);
      
      // 发送成功，开始倒计时
      toast.success('验证码发送成功');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error('发送验证码错误:', error);
      toast.error('网络错误，请检查网络连接后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${styles.pageContainer} ${isMobile ? styles.pageContainerMobile : styles.pageContainerDesktop}`}>
      <div className={styles.loginModal}>
        <div className={`${styles.loginContainer} ${isMobile ? styles.loginContainerMobile : styles.loginContainerDesktop}`}>
          <h2 className={`${styles.title} ${isMobile ? styles.titleMobile : styles.titleDesktop}`}>登录</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <input 
                type="text" 
                placeholder="手机号码" 
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroupInline}>
              <input 
                type="text" 
                placeholder="短信验证码" 
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={styles.codeInput}
              />
              <button 
                 type="button" 
                 className={styles.btnSendCode}
                 onClick={handleSendCode}
                 disabled={countdown > 0 || isLoading}
               >
                 {isLoading ? '发送中...' : countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
               </button>
            </div>
            <div className={styles.formGroup}>
              <button 
                type="submit" 
                className={styles.btnLogin}
                disabled={loginLoading || !phone || !code || code.length !== 6}
              >
                {loginLoading ? '登录中...' : '登录'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
