import { ApiService } from './api';
import type { GoodsDTO, OrderInfoResponse, LTWxpayResponseDTO } from '../types';

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

  /**
   * 创建订单
   * @param goodsId 商品ID
   * @returns 订单号
   */
  static async createOrder(goodsId: number): Promise<string> {
    const response = await ApiService.post<string>(`/createOrder?goodsId=${goodsId}`);
    return response.data;
  }

  /**
   * 生成微信支付二维码
   * @param orderNo 订单号
   * @returns 微信支付响应数据
   */
  static async generateWxpayQrCode(orderNo: string): Promise<LTWxpayResponseDTO> {
    const response = await ApiService.post<LTWxpayResponseDTO>(`/wxpayQrcode?orderNo=${orderNo}`);
    return response.data;
  }

  /**
   * 获取订单状态
   * @param orderNo 订单号
   * @returns 订单状态 (1: 超时未支付, 2: 已支付, 3: 进行中, 4: 已完成)
   */
  static async getOrderState(orderNo: string): Promise<number> {
    const response = await ApiService.get<number>(`/orderState?orderNo=${orderNo}`);
    return response.data;
  }
}

export default VipService;