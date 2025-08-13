import React, { useState, useEffect } from 'react';
import { VipService } from '../services/vipService';
import type { GoodsDTO } from '../types';

const VipCenter: React.FC = () => {
  const [goods, setGoods] = useState<GoodsDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGoods = async () => {
      try {
        const goodsList = await VipService.getGoods();
        setGoods(goodsList);
      } catch (error) {
        console.error('获取套餐数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGoods();
  }, []);

  const calculateDiscount = (price: number, realPrice: number) => {
    if (realPrice >= price) return null;
    const discount = Math.round(((price - realPrice) / price) * 100);
    return discount;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', lineHeight: '1.6' }}>
      <div className="mx-auto p-5" style={{ maxWidth: '1100px' }}>
        {/* 公告横幅 */}
        <div className="text-white text-center font-bold" style={{ backgroundColor: '#007bff', padding: '0.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <p className="m-0">🎉 限时优惠！年度会员享超值折扣，立即升级！</p>
        </div>

        {/* 会员购买 */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {loading ? (
            <div className="text-center" style={{ gridColumn: '1 / -1', padding: '2rem' }}>
              <p>加载中...</p>
            </div>
          ) : goods.length === 0 ? (
            <div className="text-center" style={{ gridColumn: '1 / -1', padding: '2rem' }}>
              <p>暂无套餐数据</p>
            </div>
          ) : (
            goods.map((item) => {
              const discount = calculateDiscount(item.price, item.realPrice);
              return (
                <div key={item.id} className="bg-white text-center transition-all duration-300" style={{ border: '1px solid #e7e7e7', borderRadius: '8px', padding: '2rem', transform: 'translateY(0)', boxShadow: 'none', transition: 'transform 0.3s, box-shadow 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <h3 className="m-0" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.name}</h3>
                  <p className="text-gray-500" style={{ marginBottom: '1.5rem' }}>{item.effectDays}天有效</p>
                  <div className="" style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>
                     <span className="font-bold mr-2" style={{ fontSize: '2rem', color: '#007bff' }}>￥{(item.realPrice / 100).toFixed(0)}</span>
                     {item.price > item.realPrice && (
                       <>
                         <span className="line-through text-gray-500 mr-2">￥{(item.price / 100).toFixed(0)}</span>
                         {discount && (
                           <span className="text-gray-800 rounded font-bold" style={{ backgroundColor: '#ff6b6b', color: 'white', borderRadius: '4px', marginLeft: '4px', padding: '4px 8px', fontSize: '0.8rem' }}>{discount}% OFF</span>
                         )}
                       </>
                     )}
                  </div>
                  <button className="text-white w-full border-none rounded font-bold cursor-pointer transition-colors duration-300" style={{ backgroundColor: '#007bff', padding: '12px 0', fontSize: '1.1rem', borderRadius: '5px', color: 'white', fontWeight: 'bolder' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0056b3'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#007bff'}>
                    立即购买
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* 购买记录 */}
        <section className="">
          <h2 style={{ marginBottom: '1rem' }}>我的购买记录</h2>
          <div className="md:overflow-visible overflow-x-auto">
            <table className="w-full bg-white overflow-hidden" style={{ borderCollapse: 'collapse', borderRadius: '8px' }}>
              <thead style={{ backgroundColor: '#f8f9fa' }}>
                <tr>
                  <th className="text-left" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>订单号</th>
                  <th className="text-left" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>会员类型</th>
                  <th className="text-left" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>支付金额</th>
                  <th className="text-left" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>付款时间</th>
                  <th className="text-left" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>生效时间</th>
                  <th className="text-left" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>123456789</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>季度会员</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>￥25.00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>2024-08-01 10:30</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>2024-08-01 10:31</td>
                  <td className="font-bold" style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7', color: '#28a745' }}>已完成</td>
                </tr>
                <tr>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>987654321</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>月度会员</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>￥10.00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>2024-07-01 15:00</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}>2024-07-01 15:01</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7', color: '#6c757d' }}>已过期</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 售后群悬浮图标 */}
      <a 
        href="#" 
        className="fixed flex justify-center items-center rounded-full no-underline transition-colors duration-300"
        style={{ 
          bottom: '30px', 
          right: '30px', 
          backgroundColor: '#28a745', 
          color: 'white', 
          width: '60px', 
          height: '60px', 
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          textDecoration: 'none'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
      >
        <div 
          className="bg-white" 
          style={{ width: '32px', height: '32px' }}
        ></div>
      </a>
    </div>
  );
};

export default VipCenter;