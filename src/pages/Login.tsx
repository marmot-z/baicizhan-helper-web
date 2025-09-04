import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import { ROUTES } from '../constants';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

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
      // 使用authStore的login方法
      await login({ phoneNum: phone, smsVerifyCode: code });
      
      toast.success('登录成功');
      
      // 跳转到首页或dashboard
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
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      margin: 0,
      lineHeight: 1.6,
      backgroundColor: '#f8f9fa',
      color: '#333',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      height: '100vh',
      paddingTop: isMobile ? '5%' : '10%'
    }}>
      <div className="login-modal" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '20px'
      }}>
        <div className="login-container" style={{
          backgroundColor: '#fff',
          padding: isMobile ? '2rem 1.5rem' : '2rem 3rem',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center'
        }}>
          <h2 style={{
            marginTop: 0,
            marginBottom: '1.5rem',
            fontSize: isMobile ? '1.5rem' : '1.8rem',
            color: '#333'
          }}>登录</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{
              marginBottom: '1.5rem'
            }}>
              <input 
                type="text" 
                placeholder="手机号码" 
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div className="form-group-inline" style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '1.5rem',
              alignItems: 'center'
            }}>
              <input 
                type="text" 
                placeholder="短信验证码" 
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{
                  flexGrow: 1,
                  padding: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
              <button 
                 type="button" 
                 className="btn btn-send-code"
                 onClick={handleSendCode}
                 disabled={countdown > 0 || isLoading}
                 style={{
                   padding: '12px 15px',
                   borderRadius: '5px',
                   color: '#fff',
                   fontWeight: 'bold',
                   border: 'none',
                   cursor: (countdown > 0 || isLoading) ? 'not-allowed' : 'pointer',
                   fontSize: '0.9rem',
                   width: 'auto',
                   boxSizing: 'border-box',
                   backgroundColor: (countdown > 0 || isLoading) ? '#6c757d' : '#28a745',
                   whiteSpace: 'nowrap',
                   opacity: (countdown > 0 || isLoading) ? 0.6 : 1
                 }}
               >
                 {isLoading ? '发送中...' : countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
               </button>
            </div>
            <div className="form-group" style={{
              marginBottom: '1.5rem'
            }}>
              <button 
                type="submit" 
                className="btn btn-login"
                disabled={loginLoading || !phone || !code || code.length !== 6}
                style={{
                  padding: '12px 20px',
                  borderRadius: '5px',
                  color: '#fff',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: loginLoading || !phone || !code || code.length !== 6 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: loginLoading || !phone || !code || code.length !== 6 ? '#ccc' : '#007bff',
                  opacity: loginLoading || !phone || !code || code.length !== 6 ? 0.6 : 1
                }}
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