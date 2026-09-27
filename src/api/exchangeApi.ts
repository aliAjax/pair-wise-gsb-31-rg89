import {
  EXCHANGE_ACTION_FLOW,
  EXPIRED_REASON_OWNER_TIMEOUT,
  PENDING_EXCHANGE_TTL,
  ExchangeStatus,
} from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import type { Exchange, ExchangeDraft } from '@/models/exchange';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    expires_at: new Date(Date.now() + PENDING_EXCHANGE_TTL - 1000 * 60 * 60).toISOString(),
    expire_reason: '',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'exchange_seed_expired',
    from_user_id: 'user_chen',
    to_user_id: 'user_lin',
    from_item_id: 'item_books',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '设计书换拍立得，我可以补相纸。',
    expires_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    expire_reason: '',
    created_at: new Date(Date.now() - PENDING_EXCHANGE_TTL - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - PENDING_EXCHANGE_TTL - 1000 * 60 * 30).toISOString(),
  },
];

/** 兼容旧数据：缺少 expires_at 时按创建时间 + 48 小时回推 */
const getDeadline = (exchange: Exchange): number => {
  const raw = exchange.expires_at ? Date.parse(exchange.expires_at) : NaN;
  if (Number.isFinite(raw)) return raw;
  return Date.parse(exchange.created_at) + PENDING_EXCHANGE_TTL;
};

/** 读取数据时把超过 48 小时仍待确认的记录标记为已过期，并落盘 */
const sweepPendingExchanges = (exchanges: Exchange[]): Exchange[] => {
  const at = Date.now();
  let changed = false;
  const next = exchanges.map((exchange) => {
    if (exchange.status !== ExchangeStatus.PENDING || getDeadline(exchange) > at) return exchange;
    changed = true;
    return {
      ...exchange,
      status: ExchangeStatus.EXPIRED,
      expire_reason: EXPIRED_REASON_OWNER_TIMEOUT,
      updated_at: new Date(at).toISOString(),
    };
  });
  return changed ? next : exchanges;
};

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const stored = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (!stored.length) {
      await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
      return sweepPendingExchanges(seedExchanges);
    }
    const exchanges = sweepPendingExchanges(stored);
    if (exchanges !== stored) {
      await storage.set(STORAGE_KEYS.exchanges, exchanges);
    }
    return exchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const duplicated = exchanges.some(
      (item) =>
        item.status === ExchangeStatus.PENDING &&
        item.from_user_id === draft.from_user_id &&
        item.to_user_id === draft.to_user_id &&
        item.from_item_id === draft.from_item_id &&
        item.to_item_id === draft.to_item_id,
    );
    if (duplicated) {
      throw new Error('相同两件物品已有一条待确认请求，请等待对方处理或超时后再发起');
    }
    const now = new Date();
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      expires_at: new Date(now.getTime() + PENDING_EXCHANGE_TTL).toISOString(),
      expire_reason: '',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  /** 从过期记录重新发一单：沿用物品和留言，旧记录保持不变继续可查 */
  async resend(expiredId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const previous = exchanges.find((item) => item.id === expiredId);
    if (!previous) throw new Error('交换请求不存在');
    if (previous.status !== ExchangeStatus.EXPIRED) {
      throw new Error('只有已过期的请求才能重新发起');
    }
    return this.create({
      from_user_id: previous.from_user_id,
      to_user_id: previous.to_user_id,
      from_item_id: previous.from_item_id,
      to_item_id: previous.to_item_id,
      message: previous.message,
    });
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.status === ExchangeStatus.EXPIRED) {
      throw new Error('该请求已超过 48 小时处理时限，物主无法再处理');
    }
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    if (status === ExchangeStatus.COMPLETED) {
      await itemApi.setStatus(current.from_item_id, ItemStatus.EXCHANGED);
      await itemApi.setStatus(current.to_item_id, ItemStatus.EXCHANGED);
    }
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },
};
