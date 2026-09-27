<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(displayStatus)">
        {{ formatExchangeStatus(displayStatus) }}
      </span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>

    <div v-if="isPending" class="exchange-card__timer" :class="{ 'exchange-card__timer--urgent': isUrgent }">
      <span>剩余处理时间</span>
      <strong>{{ countdownText }}</strong>
      <small>截止 {{ formatDate(exchange.expires_at) }}</small>
    </div>
    <div v-else-if="isExpired" class="exchange-card__reason">
      <span>过期原因</span>
      <strong>{{ exchange.expire_reason || formatStatusMessage(ExchangeStatus.EXPIRED) }}</strong>
      <small>截止时间 {{ formatDate(exchange.expires_at) }}</small>
    </div>

    <div class="exchange-card__items">
      <div>
        <span>拿出</span>
        <strong>{{ fromItem?.title ?? '未知物品' }}</strong>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate" class="exchange-card__actions">
        <template v-if="isPending">
          <template v-if="!timedOut">
            <button type="button" @click="$emit('accept', exchange.id)">同意</button>
            <button type="button" @click="$emit('reject', exchange.id)">拒绝</button>
          </template>
          <small v-else class="exchange-card__closed">已超过 48 小时，处理入口已关闭</small>
        </template>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED" type="button" @click="$emit('complete', exchange.id)">
          完成
        </button>
      </div>
      <div v-if="canResend" class="exchange-card__actions">
        <button type="button" :disabled="targetUnavailable" @click="$emit('resend', exchange.id)">
          {{ targetUnavailable ? '目标物品已不可交换' : '重新发起一单' }}
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import {
  formatDate,
  formatExchangeCountdown,
  formatExchangeStatus,
  formatStatusMessage,
  isExchangeTimedOut,
  statusToneClass,
} from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  complete: [id: string];
  resend: [id: string];
}>();

const authStore = useAuthStore();
const exchangeStore = useExchangeStore();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));

const timedOut = computed(() =>
  props.exchange.status === ExchangeStatus.PENDING ? isExchangeTimedOut(props.exchange, exchangeStore.nowTick) : false,
);
/** 落盘前的瞬间也按已过期呈现，保证物主入口即时关闭 */
const displayStatus = computed(() => (timedOut.value ? ExchangeStatus.EXPIRED : props.exchange.status));
const isPending = computed(() => props.exchange.status === ExchangeStatus.PENDING && !timedOut.value);
const isExpired = computed(() => displayStatus.value === ExchangeStatus.EXPIRED);
const countdownText = computed(() => formatExchangeCountdown(props.exchange, exchangeStore.nowTick));
const isUrgent = computed(() => {
  if (!isPending.value) return false;
  const remain = exchangeStore.nowTick - Date.parse(props.exchange.expires_at);
  return remain > -1000 * 60 * 60;
});

const canOperate = computed(
  () =>
    authStore.currentUser?.id === props.exchange.to_user_id ||
    (authStore.currentUser?.id === props.exchange.from_user_id && props.exchange.status === ExchangeStatus.ACCEPTED),
);
const targetUnavailable = computed(() => Boolean(toItem.value && toItem.value.status !== ItemStatus.AVAILABLE));
const canResend = computed(
  () =>
    props.exchange.status === ExchangeStatus.EXPIRED &&
    authStore.currentUser?.id === props.exchange.from_user_id,
);
</script>
