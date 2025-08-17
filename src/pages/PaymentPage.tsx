import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { VipService } from '../services/vipService';
import { toast } from 'react-hot-toast';
import type { LTWxpayResponseDTO } from '../types';

const PaymentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const orderNo = searchParams.get('orderNo');
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const POLLING_INTERVAL = 3000; // 3秒轮询间隔
  const MAX_POLLING_TIME = 10 * 60 * 1000; // 10分钟超时

  useEffect(() => {
    if (!orderNo) {
      setError('订单号不能为空');
      setLoading(false);
      return;
    }

    const generateQrCode = async () => {
      try {
        setLoading(true);
        const response: LTWxpayResponseDTO = await VipService.generateWxpayQrCode(orderNo);
        
        if (response.code === 0) {
          setQrCodeUrl(response.data.QRcode_url);
          // 开始轮询订单状态
          startPolling();
        } else {
          setError(response.msg || '生成支付二维码失败');
        }
      } catch (err) {
        setError('网络错误，请稍后重试');
        console.error('生成支付二维码失败:', err);
      } finally {
        setLoading(false);
      }
    };

    generateQrCode();
  }, [orderNo]);

  // 开始轮询订单状态
  const startPolling = () => {
    startTimeRef.current = Date.now();
    pollingTimerRef.current = setInterval(checkOrderState, POLLING_INTERVAL);
  };

  // 检查订单状态
  const checkOrderState = async () => {
    if (!orderNo) return;
    
    // 检查是否超时
    if (Date.now() - startTimeRef.current >= MAX_POLLING_TIME) {
      clearInterval(pollingTimerRef.current!);
      toast.error('支付超时，页面即将关闭');
      window.close();
      return;
    }

    try {
      const state = await VipService.getOrderState(orderNo);
      
      if (state === 2) {
        // 支付成功
        clearInterval(pollingTimerRef.current!);
        setPaymentSuccess(true);
        toast.success('支付成功！');
        window.close();
      } else if (state === 1) {
        // 超时未支付
        clearInterval(pollingTimerRef.current!);
         toast.error('订单超时未支付，页面即将关闭');
         window.close();
      }
    } catch (err) {
      console.error('获取订单状态失败:', err);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12" style={{ backgroundColor: 'black' }}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-center mb-6 text-gray-800" style={{color: 'white',fontSize: '1.2em',fontWeight: 'bolder'}}>
                  订单支付
                </h3>
                
                <div className="text-center">
                  {loading && (
                    <div className="flex flex-col items-center space-y-4" style={{color: 'white',fontSize: '1.2em',fontWeight: 'bolder'}}>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-gray-600">正在生成支付二维码...</p>
                    </div>
                  )}
                  
                  {error && (
                    <div className="flex flex-col items-center space-y-4" style={{color: 'white',fontSize: '1.2em',fontWeight: 'bolder'}}>
                      <div className="">
                        <p className="font-medium">支付失败</p>
                        <p className="text-sm mt-1">{error}</p>
                      </div>
                    </div>
                  )}
                  
                  {qrCodeUrl && !loading && !error && (
                    <div className="flex flex-col items-center space-y-6">
                      {paymentSuccess ? (
                        <div className="text-center space-y-4">
                          <div className="text-green-600 text-6xl mb-4">✓</div>
                          <p className="text-xl font-semibold text-green-600">支付成功！</p>
                          <p className="text-sm text-gray-600">页面将在3秒后自动关闭</p>
                        </div>
                      ) : (
                        <>
                          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                            <img
                              src={qrCodeUrl}
                              alt="支付二维码"
                              className="w-64 h-64 object-contain"
                            />
                          </div>
                          
                          <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-gray-800" style={{color: 'white',fontWeight: 'bolder',fontSize: '1.2em',}}>
                              请使用微信扫码支付
                            </p>
                            <p className="text-sm text-gray-600">
                              订单号: {orderNo}
                            </p>
                            <p className="text-xs text-gray-500">
                              正在监听支付状态...
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;