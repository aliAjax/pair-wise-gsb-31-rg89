<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <small v-if="exchange.status === ExchangeStatus.PENDING">{{ remainingText }}</small>
      <small v-else>{{ formatDate(exchange.updated_at) }}</small>
    </header>
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
    <p v-if="exchange.status === ExchangeStatus.EXPIRED" class="exchange-card__expire">
      {{ formatStatusMessage(exchange.status) }}
    </p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate || canResend" class="exchange-card__actions">
        <button v-if="exchange.status === ExchangeStatus.PENDING" type="button" @click="$emit('accept', exchange.id)">
          同意
        </button>
        <button v-if="exchange.status === ExchangeStatus.PENDING" type="button" @click="$emit('reject', exchange.id)">
          拒绝
        </button>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED" type="button" @click="$emit('complete', exchange.id)">
          完成
        </button>
        <button v-if="canResend" type="button" @click="$emit('resend', exchange.id)">
          重新发起
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import { useNow } from '@/hooks/useNow';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import {
  formatDate,
  formatExchangeRemaining,
  formatExchangeStatus,
  formatStatusMessage,
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
const now = useNow();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));
const isOwner = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
const isInitiator = computed(() => authStore.currentUser?.id === props.exchange.from_user_id);
const canOperate = computed(() => {
  const status = props.exchange.status;
  if (status !== ExchangeStatus.PENDING && status !== ExchangeStatus.ACCEPTED) return false;
  return isOwner.value || (isInitiator.value && status === ExchangeStatus.ACCEPTED);
});
const canResend = computed(() => isInitiator.value && props.exchange.status === ExchangeStatus.EXPIRED);
const remainingText = computed(() => formatExchangeRemaining(props.exchange, now.value));
</script>
