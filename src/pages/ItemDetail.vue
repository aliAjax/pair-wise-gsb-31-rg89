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

        <div v-if="isMine" class="detail-panel__requests">
          <div v-if="incomingPending.length" class="detail-request detail-request--pending">
            <span class="pill">待物主处理 {{ incomingPending.length }}</span>
            <p>
              最早一条剩余处理时间
              <strong :class="{ 'countdown--urgent': incomingUrgent }">{{ incomingCountdown }}</strong>
              ，逾期请求将自动标记为已过期。
            </p>
            <RouterLink class="text-link" to="/exchanges">前往交换管理处理</RouterLink>
          </div>
          <button v-if="item.status === ItemStatus.AVAILABLE" class="secondary-button" type="button" @click="offlineItem">
            下架这件物品
          </button>
        </div>

        <template v-else>
          <div v-if="myActivePending" class="detail-request detail-request--pending">
            <span class="status-pill status-wait">待确认</span>
            <p>你已用「{{ myActivePendingFromItem?.title ?? '已删除物品' }}」发起交换，等待物主确认。</p>
            <p>
              剩余处理时间 <strong :class="{ 'countdown--urgent': myPendingUrgent }">{{ myPendingCountdown }}</strong>
              ，截止 {{ formatDate(myActivePending.expires_at) }}。时限内相同两件物品只能保留一条待确认请求。
            </p>
          </div>

          <div v-if="myLatestExpired" class="detail-request detail-request--expired">
            <span class="status-pill status-muted">已过期</span>
            <p>{{ myLatestExpired.expire_reason || formatStatusMessage(ExchangeStatus.EXPIRED) }}</p>
            <p class="detail-request__message">上次留言：{{ myLatestExpired.message }}</p>
          </div>

          <div v-if="!myActivePending" class="exchange-box">
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
              v-if="myLatestExpired"
              class="secondary-button"
              type="button"
              :disabled="targetUnavailable"
              @click="resendExchange(myLatestExpired.id)"
            >
              用上次的物品和留言重新发起
            </button>
            <button class="primary-button" type="button" :disabled="item.status !== ItemStatus.AVAILABLE" @click="requestExchange">
              {{ targetUnavailable ? '目标物品当前不可交换' : '发起交换' }}
            </button>
          </div>
        </template>
      </article>
    </div>
  </section>
  <EmptyState v-else title="物品不存在" description="可能已被清理或链接无效" mark="404" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { orderBy } from 'lodash-es';

import EmptyState from '@/components/common/EmptyState.vue';
import ItemImageGallery from '@/components/common/ItemImageGallery.vue';
import UserBrief from '@/components/common/UserBrief.vue';
import { ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useItemStore } from '@/stores/itemStore';
import {
  formatCondition,
  formatDate,
  formatExchangeCountdown,
  formatItemStatus,
  formatStatusMessage,
  getExchangeDeadline,
  statusToneClass,
} from '@/utils/formatters';
import { message } from '@/utils/message';

const route = useRoute();
const itemStore = useItemStore();
const authStore = useAuthStore();
const exchangeStore = useExchangeStore();

const item = computed(() => itemStore.items.find((entry) => entry.id === route.params.id));
const owner = computed(() => authStore.users.find((user) => user.id === item.value?.user_id));
const isMine = computed(() => authStore.currentUser?.id === item.value?.user_id);
const ownAvailableItems = computed(() =>
  authStore.currentUser ? itemStore.availableMyItems(authStore.currentUser.id) : [],
);
const selectedItemId = ref('');
const messageText = ref('我想用这件闲置与你交换，可以沟通时间和地点。');

/** 与当前物品相关的交换记录，最新在前；旧记录与留言继续保留可查 */
const relatedExchanges = computed(() =>
  orderBy(
    exchangeStore.exchanges.filter((exchange) => exchange.to_item_id === route.params.id),
    ['created_at'],
    ['desc'],
  ),
);

/** 我作为发起人，针对这件物品时限内仍待确认的请求（同两件物品只保留一条） */
const myActivePending = computed(() => {
  if (!authStore.currentUser || !item.value) return undefined;
  return relatedExchanges.value.find(
    (exchange) =>
      exchange.from_user_id === authStore.currentUser?.id && exchange.status === ExchangeStatus.PENDING,
  );
});
const myActivePendingFromItem = computed(() =>
  itemStore.items.find((entry) => entry.id === myActivePending.value?.from_item_id),
);
const myLatestExpired = computed(() => {
  if (!authStore.currentUser) return undefined;
  return relatedExchanges.value.find(
    (exchange) =>
      exchange.from_user_id === authStore.currentUser?.id && exchange.status === ExchangeStatus.EXPIRED,
  );
});
const targetUnavailable = computed(() => item.value?.status !== ItemStatus.AVAILABLE);

const myPendingCountdown = computed(() =>
  myActivePending.value ? formatExchangeCountdown(myActivePending.value, exchangeStore.nowTick) : '',
);
const myPendingUrgent = computed(() => {
  if (!myActivePending.value) return false;
  return getExchangeDeadline(myActivePending.value) - exchangeStore.nowTick < 1000 * 60 * 60;
});

const incomingPending = computed(() => {
  if (!item.value || !isMine.value) return [];
  return relatedExchanges.value.filter((exchange) => exchange.status === ExchangeStatus.PENDING);
});
const earliestIncomingPending = computed(() =>
  [...incomingPending.value].sort((a, b) => getExchangeDeadline(a) - getExchangeDeadline(b))[0],
);
const incomingCountdown = computed(() =>
  earliestIncomingPending.value
    ? formatExchangeCountdown(earliestIncomingPending.value, exchangeStore.nowTick)
    : '',
);
const incomingUrgent = computed(() => {
  if (!earliestIncomingPending.value) return false;
  return getExchangeDeadline(earliestIncomingPending.value) - exchangeStore.nowTick < 1000 * 60 * 60;
});

const requestExchange = async () => {
  if (!authStore.currentUser || !item.value || !owner.value) return;
  if (!itemStore.assertCanExchange(authStore.currentUser.id)) return;
  if (!selectedItemId.value) {
    message('请选择一件自己的物品', 'error');
    return;
  }
  const created = await exchangeStore.create({
    from_user_id: authStore.currentUser.id,
    to_user_id: owner.value.id,
    from_item_id: selectedItemId.value,
    to_item_id: item.value.id,
    status: ExchangeStatus.PENDING,
    message: messageText.value,
  });
  if (created) {
    selectedItemId.value = '';
  }
};

/** 从过期记录重新发一单，沿用旧物品与留言，旧记录继续可查 */
const resendExchange = async (expiredId: string) => {
  if (targetUnavailable.value) {
    message('目标物品当前不可交换', 'error');
    return;
  }
  const created = await exchangeStore.resend(expiredId);
  if (created) {
    selectedItemId.value = created.from_item_id;
    messageText.value = created.message;
  }
};

const offlineItem = async () => {
  if (!item.value) return;
  await itemStore.offline(item.value.id);
};
</script>
