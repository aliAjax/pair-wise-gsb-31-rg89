<template>
  <section v-if="item" class="page detail-page">
    <RouterLink class="text-link" to="/home">返回首页</RouterLink>
    <div class="detail-layout">
      <ItemImageGallery :images="item.images" :fallback-text="item.category" />
      <article class="detail-panel">
        <div class="item-card__topline">
          <span class="pill">{{ item.category }}</span>
          <span class="status-pill" :class="statusToneClass(item.status)">
            {{ formatItemStatus(item.status) }}
          </span>
        </div>
        <h1>{{ item.title }}</h1>
        <p>{{ item.description }}</p>
        <dl class="detail-list">
          <div>
            <dt>成色</dt>
            <dd>{{ formatCondition(item.condition) }}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{{ item.location }}</dd>
          </div>
          <div>
            <dt>发布时间</dt>
            <dd>{{ formatDate(item.created_at) }}</dd>
          </div>
        </dl>
        <UserBrief v-if="owner" :user="owner" />

        <div v-if="relatedExchanges.length" class="exchange-progress">
          <p class="exchange-progress__title">交换进度</p>
          <ul>
            <li v-for="entry in relatedExchanges" :key="entry.id">
              <span class="status-pill" :class="statusToneClass(entry.status)">
                {{ formatExchangeStatus(entry.status) }}
              </span>
              <span class="exchange-progress__hint">{{ relatedHint(entry) }}</span>
              <button
                v-if="entry.status === ExchangeStatus.EXPIRED && entry.from_user_id === authStore.currentUser?.id"
                type="button"
                @click="resendExchange(entry.id)"
              >
                重新发起
              </button>
            </li>
          </ul>
        </div>

        <div v-if="!isMine" class="exchange-box">
          <label>
            我的交换物
            <select v-model="selectedItemId">
              <option value="">选择一件我发布的可交换物品</option>
              <option v-for="myItem in ownAvailableItems" :key="myItem.id" :value="myItem.id">
                {{ myItem.title }}
              </option>
            </select>
          </label>
          <label>
            留言
            <textarea v-model="messageText" rows="3" />
          </label>
          <button
            class="primary-button"
            type="button"
            :disabled="item.status !== ItemStatus.AVAILABLE || pendingDuplicate"
            @click="requestExchange"
          >
            {{ pendingDuplicate ? '待确认请求已存在' : '发起交换' }}
          </button>
          <p v-if="pendingDuplicate" class="form-note">{{ FORM_MESSAGES.exchangeDuplicated }}</p>
        </div>
        <button v-else-if="item.status === ItemStatus.AVAILABLE" class="secondary-button" type="button" @click="offlineItem">
          下架这件物品
        </button>
      </article>
    </div>
  </section>
  <EmptyState v-else title="物品不存在" description="可能已被清理或链接无效" mark="404" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import EmptyState from '@/components/common/EmptyState.vue';
import ItemImageGallery from '@/components/common/ItemImageGallery.vue';
import UserBrief from '@/components/common/UserBrief.vue';
import { ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import { useNow } from '@/hooks/useNow';
import type { Exchange } from '@/models/exchange';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useItemStore } from '@/stores/itemStore';
import {
  formatCondition,
  formatDate,
  formatExchangeRemaining,
  formatExchangeStatus,
  formatItemStatus,
  formatStatusMessage,
  statusToneClass,
} from '@/utils/formatters';
import { message } from '@/utils/message';

const route = useRoute();
const itemStore = useItemStore();
const authStore = useAuthStore();
const exchangeStore = useExchangeStore();
const now = useNow();

const item = computed(() => itemStore.items.find((entry) => entry.id === route.params.id));
const owner = computed(() => authStore.users.find((user) => user.id === item.value?.user_id));
const isMine = computed(() => authStore.currentUser?.id === item.value?.user_id);
const ownAvailableItems = computed(() =>
  authStore.currentUser ? itemStore.availableMyItems(authStore.currentUser.id) : [],
);
const selectedItemId = ref('');
const messageText = ref('我想用这件闲置与你交换，可以沟通时间和地点。');

const relatedExchanges = computed(() => {
  if (!item.value || !authStore.currentUser) return [];
  const me = authStore.currentUser.id;
  return exchangeStore.exchanges
    .filter(
      (entry) =>
        entry.to_item_id === item.value!.id && (entry.from_user_id === me || entry.to_user_id === me),
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 3);
});

const relatedHint = (entry: Exchange) => {
  if (entry.status === ExchangeStatus.PENDING) return formatExchangeRemaining(entry, now.value);
  return formatStatusMessage(entry.status);
};

const pendingDuplicate = computed(() => {
  if (!item.value || !selectedItemId.value) return false;
  return exchangeStore.exchanges.some(
    (entry) =>
      entry.status === ExchangeStatus.PENDING &&
      entry.from_item_id === selectedItemId.value &&
      entry.to_item_id === item.value!.id,
  );
});

const requestExchange = async () => {
  if (!authStore.currentUser || !item.value || !owner.value) return;
  if (!itemStore.assertCanExchange(authStore.currentUser.id)) return;
  if (!selectedItemId.value) {
    message('请选择一件自己的物品', 'error');
    return;
  }
  await exchangeStore.create({
    from_user_id: authStore.currentUser.id,
    to_user_id: owner.value.id,
    from_item_id: selectedItemId.value,
    to_item_id: item.value.id,
    status: ExchangeStatus.PENDING,
    message: messageText.value,
  });
};

const resendExchange = async (id: string) => {
  await exchangeStore.resend(id);
};

const offlineItem = async () => {
  if (!item.value) return;
  await itemStore.offline(item.value.id);
};
</script>
