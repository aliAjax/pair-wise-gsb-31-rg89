import { EXCHANGE_ACTION_FLOW, EXCHANGE_PENDING_TTL_MS, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { exchangePendingDeadline } from '@/utils/formatters';

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
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'exchange_seed_expired',
    from_user_id: 'user_me',
    to_user_id: 'user_chen',
    from_item_id: 'item_chair',
    to_item_id: 'item_books',
    status: ExchangeStatus.PENDING,
    message: '露营椅换设计书，搬家前想清一清。',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
  },
];

/** 读取时把超过 48 小时仍未处理的待确认请求标记为已过期，记录本身保留可查 */
const sweepExpired = (exchanges: Exchange[]) => {
  const now = Date.now();
  let changed = false;
  const list = exchanges.map((exchange) => {
    if (exchange.status === ExchangeStatus.PENDING && exchangePendingDeadline(exchange) <= now) {
      changed = true;
      return { ...exchange, status: ExchangeStatus.EXPIRED, updated_at: new Date().toISOString() };
    }
    return exchange;
  });
  return { list, changed };
};

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    let exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (!exchanges.length) {
      await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
      exchanges = seedExchanges;
    }
    const { list, changed } = sweepExpired(exchanges);
    if (changed) {
      await storage.set(STORAGE_KEYS.exchanges, list);
    }
    return list;
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
        item.from_item_id === draft.from_item_id &&
        item.to_item_id === draft.to_item_id,
    );
    if (duplicated) {
      throw new Error(FORM_MESSAGES.exchangeDuplicated);
    }
    const now = new Date();
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + EXCHANGE_PENDING_TTL_MS).toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async resend(id: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.status !== ExchangeStatus.EXPIRED) {
      throw new Error('只有已过期的请求可以重新发起');
    }
    return this.create({
      from_user_id: current.from_user_id,
      to_user_id: current.to_user_id,
      from_item_id: current.from_item_id,
      to_item_id: current.to_item_id,
      message: current.message,
    });
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
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
