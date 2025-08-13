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
import type { GoodsDTO, OrderInfoDTO } from '../types';

const VipCenter: React.FC = () => {
  const [goods, setGoods] = useState<GoodsDTO[]>([]);
  const [orders, setOrders] = useState<OrderInfoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

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
                   href={`/page/pay?orderNo=${row.orderNo}`} 
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
              <div className="flex items-center justify-between" style={{ padding: '1rem', borderTop: '1px solid #e7e7e7', backgroundColor: '#f8f9fa' }}>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    style={{ backgroundColor: 'white', border: '1px solid #ddd' }}
                  >
                    {'<<'}
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    style={{ backgroundColor: 'white', border: '1px solid #ddd' }}
                  >
                    {'<'}
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    style={{ backgroundColor: 'white', border: '1px solid #ddd' }}
                  >
                    {'>'}
                  </button>
                  <button
                    className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                    style={{ backgroundColor: 'white', border: '1px solid #ddd' }}
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