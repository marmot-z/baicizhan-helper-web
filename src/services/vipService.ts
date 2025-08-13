import { ApiService } from './api';
import type { GoodsDTO } from '../types';

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
}

export default VipService;