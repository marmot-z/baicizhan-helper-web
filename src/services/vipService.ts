import { ApiService } from './api';
import type { GoodsDTO, OrderInfoResponse } from '../types';

/**
 * VIP服务相关API
 */
export class VipService {
  /**
   * 获取商品列表
   * @returns Promise<GoodsDTO[]> 商品列表
   */
  static async getGoods(): Promise<GoodsDTO[]> {
    const response = await ApiService.get<GoodsDTO[]>('/goodsList');
    return response.data;
  }

  /**
   * 获取订单信息
   * @returns Promise<OrderInfoResponse> 订单信息响应
   */
  static async getOrders(): Promise<OrderInfoResponse> {
    const response = await ApiService.get<OrderInfoResponse>('/orderInfo');
    return response.data;
  }

  /**
   * 申请试用
   * @returns Promise<string> 订单号
   */
  static async applyTrial(): Promise<string> {
    const response = await ApiService.post<string>('/createTrialOrder');
    return response.data;
  }
}

export default VipService;