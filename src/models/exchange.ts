import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_item_id: string;
  to_item_id: string;
  status: ExchangeStatus;
  message: string;
  /** 待确认处理截止时间（创建时间 + 48 小时） */
  expires_at: string;
  /** 记录变为已过期时写入的原因，其余状态为空字符串 */
  expire_reason: string;
  created_at: string;
  updated_at: string;
}

export type ExchangeDraft = Omit<
  Exchange,
  'id' | 'status' | 'expires_at' | 'expire_reason' | 'created_at' | 'updated_at'
> & {
  status?: ExchangeStatus;
};
