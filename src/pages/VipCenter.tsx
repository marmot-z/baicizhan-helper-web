import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { VipService } from '../services/vipService';
import apiClient from '../services/api';
import { toast } from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode } from '@fortawesome/free-solid-svg-icons';
import type { GoodsDTO, OrderInfoDTO } from '../types';
import styles from './VipCenter.module.css';

const VipCenter: React.FC = () => {
  const [goods, setGoods] = useState<GoodsDTO[]>([]);
  const [orders, setOrders] = useState<OrderInfoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [trialLoading, setTrialLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<number | null>(null);


  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取套餐数据
        const goodsList = await VipService.getGoods();
        setGoods(goodsList);
      } catch (error) {
        console.error('获取套餐数据失败:', error);
      } finally {
        setLoading(false);
      }

      try {
        // 获取订单数据
        const ordersResponse = await VipService.getOrders();
        setOrders(ordersResponse.rows);
      } catch (error) {
        console.error('获取订单数据失败:', error);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateDiscount = (price: number, realPrice: number) => {
    if (realPrice >= price) return null;
    const discount = Math.round(((price - realPrice) / price) * 100);
    return discount;
  };

  // React Table 列定义
  const columnHelper = createColumnHelper<OrderInfoDTO>();
  
  const columns = useMemo(
    () => [
      columnHelper.accessor('orderNo', {
        header: '订单号',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('goodsName', {
        header: '会员类型',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('amount', {
        header: '支付金额',
        cell: info => `${info.getValue() / 100} 元`,
      }),
      columnHelper.accessor('payTime', {
        header: '付款时间',
        cell: info => {
          const value = info.getValue();
          if (!value) return '-';
          const date = new Date(value);
          return date.getTime() <= 0 ? '-' : date.toLocaleDateString();
        },
      }),
      columnHelper.accessor('effectTime', {
        header: '生效时间',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('state', {
         header: '状态',
         cell: info => {
           const state = info.getValue();
           const row = info.row.original;
           if (state === 0) {
             return (
               <span>
                 待支付{' '}
                 <a 
                   href={`/page/payment?orderNo=${row.orderNo}`} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-blue-600 hover:text-blue-800 underline"
                 >
                   去支付
                 </a>
               </span>
             );
           }
           // 根据状态枚举返回对应文本
           switch (state) {
             case 1:
               return '超时未支付';
             case 2:
               return '已支付';
             case 3:
               return '进行中';
             case 4:
               return '已完成';
             default:
               return '未知状态';
           }
         },
       }),
    ],
    [columnHelper]
  );

  // 处理试用申请
  const handleTrialClick = async () => {
    try {
      setTrialLoading(true);
      await VipService.applyTrial();
      toast.success('申请试用成功');
    } catch (error) {
      console.error('申请试用失败:', error);
      toast.error(error instanceof Error ? error.message : '申请试用失败，请稍后重试');
    } finally {
      setTrialLoading(false);
    }
  };

  // 处理立即购买
  const handlePurchaseClick = async (goodsId: number) => {
    try {
      setPurchaseLoading(goodsId);
      const orderNo = await VipService.createOrder(goodsId);
      // 跳转到支付页面
      window.open(`/page/payment?orderNo=${orderNo}`, '_blank');
    } catch (error) {
      console.error('创建订单失败:', error);
      toast.error('下单失败，请稍候重试');
    } finally {
      setPurchaseLoading(null);
    }
  };



  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className={`${styles.vipContainer} min-h-screen bg-gray-50 text-gray-800`}>
      <div className={`mx-auto p-5 ${styles.inner}`}>
        {/* 公告横幅 */}
        <div className={`text-white text-center font-bold ${styles.banner}`}>
          <p className="m-0">🎁 还不是会员？立即申请 30 天免费试用，先体验再决定! 
            <button 
              onClick={handleTrialClick}
              disabled={trialLoading}
              style={{   
                borderRadius: '5px',
                fontWeight: 'bold',
                border: 'none',
                cursor: trialLoading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: trialLoading ? 0.6 : 1
              }}
            >
              {trialLoading ? '申请中...' : '👋 立即试用 30 天'}
            </button>
        </p>
        </div>

        {/* 会员购买 */}
        <section className={styles.goodsGrid}>
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
                <div
                  key={item.id}
                  className={`bg-white text-center transition-all duration-300 ${styles.card}`}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
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
                  <button 
                    className={styles.purchaseBtn}
                    onClick={() => handlePurchaseClick(item.id)}
                    disabled={purchaseLoading === item.id}
                  >
                    {purchaseLoading === item.id ? '下单中...' : '立即购买'}
                  </button>
                </div>
              );
            })
          )}
        </section>
        
        {/* 订单生效提示 */}
        <div className="text-left" style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.9rem', color: '#6c757d', margin: 0 }}>提示：订单付款后5分钟内生效</p>
        </div>

        {/* 购买记录 */}
        <section className="">
          <h2 style={{ marginBottom: '1rem' }}>我的购买记录</h2>
          {ordersLoading ? (
            <div className="text-center bg-white rounded-lg" style={{ padding: '2rem' }}>
              <p>加载订单数据中...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center bg-white rounded-lg" style={{ padding: '2rem' }}>
              <p>暂无订单数据</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden">
              {/* 表格 */}
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8f9fa' }}>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <th
                            key={header.id}
                            className="text-left cursor-pointer select-none"
                            style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {{
                              asc: ' 🔼',
                              desc: ' 🔽',
                            }[header.column.getIsSorted() as string] ?? null}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map(row => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            style={{ padding: '1rem', borderBottom: '1px solid #e7e7e7' }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 分页控件 */}
              <div className={`${styles.paginationBar} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    {'<<'}
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    {'<'}
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    {'>'}
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    {'>>'}
                  </button>
                </div>
                
                <span className="flex items-center gap-1">
                  <div>第</div>
                  <strong>
                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  </strong>
                  <div>页</div>
                </span>
                
                <span className="flex items-center gap-1">
                  跳转到:
                  <input
                    type="number"
                    defaultValue={table.getState().pagination.pageIndex + 1}
                    onChange={e => {
                      const page = e.target.value ? Number(e.target.value) - 1 : 0
                      table.setPageIndex(page)
                    }}
                    className="border p-1 rounded w-16"
                    style={{ border: '1px solid #ddd' }}
                  />
                </span>
                
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={e => {
                    table.setPageSize(Number(e.target.value))
                  }}
                  className="border p-1 rounded"
                  style={{ border: '1px solid #ddd' }}
                >
                  {[10, 20, 30, 40, 50].map(pageSize => (
                    <option key={pageSize} value={pageSize}>
                      显示 {pageSize} 条
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 售后群悬浮图标 */}
      <a
        href={apiClient.getUri({ url: '/qrcode' })}
        target="_blank"
        rel="noreferrer"
        className={`${styles.floatingBanner} fixed flex justify-center items-center no-underline transition-colors duration-300`}
      >
        <div>
          <div 
            className={`${styles.qrcodeBox} flex items-center justify-center`}>
            <FontAwesomeIcon 
              icon={faQrcode} 
              className={styles.qrcodeIcon}
            />
          </div>
          <span className={`${styles.floatingText} text-xs text-gray-500`}>加入售后群</span>
        </div>
      </a>


    </div>
  );
};

export default VipCenter;
