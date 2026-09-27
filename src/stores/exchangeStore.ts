import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import { EXCHANGE_TIP_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { isExchangeTimedOut } from '@/utils/formatters';
import { message } from '@/utils/message';

let pendingTicker: ReturnType<typeof setInterval> | null = null;

export const useExchangeStore = defineStore('exchanges', {
  state: () => ({
    exchanges: [] as Exchange[],
    statusFilter: 'all' as ExchangeStatus | 'all',
    loading: false,
    /** 每秒更新的当前时间戳，驱动剩余时间倒计时与超时落盘 */
    nowTick: Date.now(),
  }),
  getters: {
    sent: (state) => (userId: string) => state.exchanges.filter((item) => item.from_user_id === userId),
    received: (state) => (userId: string) => state.exchanges.filter((item) => item.to_user_id === userId),
    filtered: (state) => {
      if (state.statusFilter === 'all') return state.exchanges;
      return state.exchanges.filter((item) => item.status === state.statusFilter);
    },
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
        this.nowTick = Date.now();
      } finally {
        this.loading = false;
      }
    },
    /** 启动全局秒级时钟：到时即把超时的待确认记录落盘为已过期 */
    startTicker() {
      if (pendingTicker) return;
      pendingTicker = setInterval(() => {
        this.nowTick = Date.now();
        if (this.exchanges.some((item) => isExchangeTimedOut(item, this.nowTick))) {
          void this.sweepExpired();
        }
      }, 1000);
    },
    async sweepExpired() {
      this.exchanges = await exchangeApi.list();
    },
    async create(draft: ExchangeDraft) {
      try {
        const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
        this.exchanges = await exchangeApi.list();
        message('交换请求已发出，对方需在 48 小时内处理', 'success');
        return exchange;
      } catch (error) {
        message(error instanceof Error ? error.message : EXCHANGE_TIP_MESSAGES.duplicatePending, 'error');
        return null;
      }
    },
    async resend(id: string) {
      try {
        const exchange = await exchangeApi.resend(id);
        this.exchanges = await exchangeApi.list();
        message('已基于过期记录重新发起一单，旧留言仍可查看', 'success');
        return exchange;
      } catch (error) {
        message(error instanceof Error ? error.message : EXCHANGE_TIP_MESSAGES.resendNotExpired, 'error');
        return null;
      }
    },
    async accept(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      this.exchanges = await exchangeApi.list();
      message('已同意交换', 'success');
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      this.exchanges = await exchangeApi.list();
      message('已拒绝交换', 'success');
    },
    async complete(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.COMPLETED);
      this.exchanges = await exchangeApi.list();
      message('交换已完成，双方物品状态已更新', 'success');
    },
  },
});
