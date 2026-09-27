import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_item_id: string;
  to_item_id: string;
  status: ExchangeStatus;
  message: string;
  created_at: string;
  updated_at: string;
  /** 待确认请求的处理截止时间（创建后 48 小时），旧数据可能缺失，读取时按 created_at 兜底 */
  expires_at?: string;
}

export type ExchangeDraft = Omit<Exchange, 'id' | 'status' | 'created_at' | 'updated_at' | 'expires_at'> & {
  status?: ExchangeStatus;
};
