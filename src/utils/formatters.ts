import dayjs from 'dayjs';

import { EXCHANGE_PENDING_TTL_MS, ExchangeStatus } from '@/constants/exchange';
import { ItemCondition, ItemStatus } from '@/constants/item';
import { STATUS_MESSAGE_MAP } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';

export const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');

export const formatItemStatus = (status: ItemStatus) => {
  const map: Record<ItemStatus, string> = {
    [ItemStatus.AVAILABLE]: '可交换',
    [ItemStatus.EXCHANGED]: '已交换',
    [ItemStatus.OFFLINE]: '已下架',
  };
  return map[status];
};

export const formatExchangeStatus = (status: ExchangeStatus) => {
  const map: Record<ExchangeStatus, string> = {
    [ExchangeStatus.PENDING]: '待确认',
    [ExchangeStatus.ACCEPTED]: '已同意',
    [ExchangeStatus.REJECTED]: '已拒绝',
    [ExchangeStatus.COMPLETED]: '已完成',
    [ExchangeStatus.EXPIRED]: '已过期',
  };
  return map[status];
};

export const formatCondition = (condition: ItemCondition) => {
  const map: Record<ItemCondition, string> = {
    [ItemCondition.NEW]: '全新',
    [ItemCondition.LIKE_NEW]: '九成新',
    [ItemCondition.GOOD]: '八成新',
    [ItemCondition.WORN]: '战损',
  };
  return map[condition];
};

export const formatCreditLevel = (score: number) => {
  if (score >= 90) return '守约达人';
  if (score >= 75) return '稳定交换';
  if (score >= 60) return '新晋用户';
  return '需谨慎';
};

export const statusToneClass = (status: ItemStatus | ExchangeStatus) => {
  if (status === ItemStatus.AVAILABLE || status === ExchangeStatus.ACCEPTED) return 'status-good';
  if (
    status === ItemStatus.OFFLINE ||
    status === ExchangeStatus.REJECTED ||
    status === ExchangeStatus.EXPIRED
  ) {
    return 'status-muted';
  }
  if (status === ItemStatus.EXCHANGED || status === ExchangeStatus.COMPLETED) return 'status-done';
  return 'status-wait';
};

export const formatStatusMessage = (status: ItemStatus | ExchangeStatus) => STATUS_MESSAGE_MAP[status];

/** 待确认请求的处理截止时间，旧数据缺失 expires_at 时按创建时间 + 48 小时兜底 */
export const exchangePendingDeadline = (exchange: Exchange) => {
  if (exchange.expires_at) return dayjs(exchange.expires_at).valueOf();
  return dayjs(exchange.created_at).valueOf() + EXCHANGE_PENDING_TTL_MS;
};

export const formatExchangeRemaining = (exchange: Exchange, now: number = Date.now()) => {
  const diff = exchangePendingDeadline(exchange) - now;
  if (diff <= 0) return '已到期，刷新后标记为已过期';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) return `剩余 ${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
  if (hours > 0) return `剩余 ${hours} 小时 ${minutes} 分`;
  return `剩余 ${Math.max(minutes, 1)} 分钟`;
};
