<script setup lang="ts">
/**
 * LevelTransitionOverlay —— 过关 → 下一关之间的"准备载入"面板。
 *
 * 数据流（Phaser → Vue 单向）：
 *   - LEVEL_COMPLETED → 展开面板，展示"关卡 X 已完成 + 准备 Y"；
 *     期间 Phaser 侧暂停物理并延迟 1600ms 后 scene.restart（见 gameplay-scene.ts
 *     `completeLevel`）。
 *   - LEVEL_STARTED (fromTransition=true) → 面板淡出；新关卡无缝接上。
 *   - 若 LEVEL_COMPLETED.nextLevelId 缺失，说明是游戏结局（demo 中 level-02 → level-01
 *     会循环，所以不会走到这条），展示 "游戏完成" 文案，不自动关闭。
 *
 * 设计边界：
 *   - 完全靠事件驱动；不读 router / 不访问 Phaser 实例。
 *   - 关卡 id → 显示名的映射就地维护（demo 阶段够用，正式游戏再抽成数据）。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { BOSS_TRANSITION_LEVEL_ID, EVENT_KEYS } from '@/contents/constants'
import type {
  LevelCompletedPayload,
  LevelStartedPayload,
} from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

/** 关卡 id → 人类友好显示名。若未登记则 fallback 到 id 本身。 */
const LEVEL_DISPLAY_NAME: Readonly<Record<string, string>> = {
  'level-01': '草原晨跑',
  'level-02': '影之洞窟',
}

const visible = ref(false)
const currentLevelId = ref('')
const nextLevelId = ref<string | undefined>(undefined)

const currentName = computed(() => LEVEL_DISPLAY_NAME[currentLevelId.value] ?? currentLevelId.value)
const nextName = computed(() =>
  nextLevelId.value ? LEVEL_DISPLAY_NAME[nextLevelId.value] ?? nextLevelId.value : null,
)
const isEnding = computed(() => !nextLevelId.value)

const onLevelCompleted = (payload: unknown) => {
  const p = payload as LevelCompletedPayload
  // Boss 场景过场由 `BossTransitionOverlay` 独占处理（mp4 过场动画）；这里主动让位，
  // 避免"先弹常规过关面板再被视频覆盖"的闪烁。
  if (p.nextLevelId === BOSS_TRANSITION_LEVEL_ID) {
    visible.value = false
    return
  }
  currentLevelId.value = p.levelId
  nextLevelId.value = p.nextLevelId
  visible.value = true
}

const onLevelStarted = (payload: unknown) => {
  const p = payload as LevelStartedPayload
  // 仅当"从过关转场过来"才关面板；首次进入游戏走的也是 LEVEL_STARTED，
  // 但 fromTransition=false，那时面板本来就没开，这里是 no-op。
  if (p.fromTransition) visible.value = false
}

onMounted(() => {
  eventBus.on(EVENT_KEYS.LEVEL_COMPLETED, onLevelCompleted)
  eventBus.on(EVENT_KEYS.LEVEL_STARTED, onLevelStarted)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.LEVEL_COMPLETED, onLevelCompleted)
  eventBus.off(EVENT_KEYS.LEVEL_STARTED, onLevelStarted)
})
</script>

<template>
  <Transition name="level-transition">
    <div v-if="visible" class="level-transition-overlay" aria-live="polite">
      <div class="level-transition-overlay__panel">
        <div class="level-transition-overlay__badge">关卡完成</div>
        <div class="level-transition-overlay__current">{{ currentName }}</div>

        <div v-if="!isEnding" class="level-transition-overlay__next-block">
          <div class="level-transition-overlay__arrow" aria-hidden="true">↓</div>
          <div class="level-transition-overlay__next-label">准备进入</div>
          <div class="level-transition-overlay__next-name">{{ nextName }}</div>
          <div class="level-transition-overlay__loader" aria-hidden="true">
            <span class="level-transition-overlay__dot" />
            <span class="level-transition-overlay__dot" />
            <span class="level-transition-overlay__dot" />
          </div>
        </div>

        <div v-else class="level-transition-overlay__ending">游戏完成 · 感谢游玩</div>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.level-transition-overlay {
  @apply pointer-events-none absolute inset-0 z-40 flex items-center justify-center;
  background: radial-gradient(
    ellipse at center,
    rgba(10, 20, 60, 0.7) 0%,
    rgba(0, 0, 10, 0.92) 100%
  );
}

.level-transition-overlay__panel {
  @apply flex flex-col items-center gap-2 rounded-2xl border border-sky-400/40 bg-slate-950/90 px-12 py-8 text-center shadow-[0_0_40px_rgba(56,189,248,0.35)];
}

.level-transition-overlay__badge {
  @apply rounded-full border border-sky-300/50 bg-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-200;
}

.level-transition-overlay__current {
  @apply mt-2 text-4xl font-black tracking-wider text-white drop-shadow-[0_0_12px_rgba(56,189,248,0.6)];
}

.level-transition-overlay__next-block {
  @apply mt-4 flex flex-col items-center gap-1;
}

.level-transition-overlay__arrow {
  @apply text-2xl text-sky-300/70;
  animation: level-arrow 1.2s ease-in-out infinite;
}

.level-transition-overlay__next-label {
  @apply text-xs uppercase tracking-widest text-slate-400;
}

.level-transition-overlay__next-name {
  @apply text-2xl font-bold text-sky-200;
}

.level-transition-overlay__loader {
  @apply mt-3 flex items-center gap-1.5;
}

.level-transition-overlay__dot {
  @apply h-2 w-2 rounded-full bg-sky-300/80;
  animation: level-dot 0.9s ease-in-out infinite;
}

.level-transition-overlay__dot:nth-child(2) {
  animation-delay: 0.15s;
}
.level-transition-overlay__dot:nth-child(3) {
  animation-delay: 0.3s;
}

.level-transition-overlay__ending {
  @apply mt-3 text-base font-medium tracking-widest text-amber-200;
}

@keyframes level-arrow {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.6;
  }
  50% {
    transform: translateY(6px);
    opacity: 1;
  }
}

@keyframes level-dot {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.level-transition-enter-active,
.level-transition-leave-active {
  transition: opacity 0.32s ease;
}
.level-transition-enter-active .level-transition-overlay__panel {
  animation: level-panel-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.level-transition-enter-from,
.level-transition-leave-to {
  opacity: 0;
}

@keyframes level-panel-in {
  from {
    transform: scale(0.85) translateY(12px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
</style>
