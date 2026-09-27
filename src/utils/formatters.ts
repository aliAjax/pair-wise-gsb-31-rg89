import dayjs from 'dayjs';

import { ExchangeStatus, PENDING_EXCHANGE_TTL } from '@/constants/exchange';
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
  if (status === ItemStatus.OFFLINE || status === ExchangeStatus.REJECTED) return 'status-muted';
  if (status === ExchangeStatus.EXPIRED) return 'status-expired';
  if (status === ItemStatus.EXCHANGED || status === ExchangeStatus.COMPLETED) return 'status-done';
  return 'status-wait';
};

/** 兼容旧数据：缺少 expires_at 时按创建时间 + 48 小时回推 */
export const getExchangeDeadline = (exchange: Exchange): number => {
  const raw = exchange.expires_at ? Date.parse(exchange.expires_at) : NaN;
  if (Number.isFinite(raw)) return raw;
  return Date.parse(exchange.created_at) + PENDING_EXCHANGE_TTL;
};

/** 待确认记录是否已经超过 48 小时处理时限 */
export const isExchangeTimedOut = (exchange: Exchange, now: number = Date.now()): boolean =>
  exchange.status === ExchangeStatus.PENDING && getExchangeDeadline(exchange) <= now;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 剩余时间倒计时，如「47:12:36」；不足 1 小时高亮紧迫感 */
export const formatExchangeCountdown = (exchange: Exchange, now: number = Date.now()): string => {
  const remain = Math.max(0, getExchangeDeadline(exchange) - now);
  const hours = Math.floor(remain / (1000 * 60 * 60));
  const minutes = Math.floor((remain % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remain % (1000 * 60)) / 1000);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
};

export const formatStatusMessage = (status: ItemStatus | ExchangeStatus) => STATUS_MESSAGE_MAP[status];
