import { onBeforeUnmount, onMounted, ref } from 'vue';

/** 每 30 秒刷新一次的当前时间，驱动待确认请求的剩余时间展示 */
export const useNow = (intervalMs = 30000) => {
  const now = ref(Date.now());
  let timer: number | undefined;

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = Date.now();
    }, intervalMs);
  });

  onBeforeUnmount(() => {
    if (timer) window.clearInterval(timer);
  });

  return now;
};
