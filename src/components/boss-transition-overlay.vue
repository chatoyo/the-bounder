<script setup lang="ts">
/**
 * BossTransitionOverlay —— world-strip-demo → world-strip-boss 过场动画播放器。
 *
 * 时序（详见 `contents/scenes/gameplay-scene.ts#completeLevel`）：
 *   LEVEL_COMPLETED (nextLevelId=world-strip-boss) → 本覆盖层接管 → 播 boss_transition.mp4 →
 *   视频 `ended` 或用户跳过 → emit BOSS_TRANSITION_ENDED →
 *   GameplayScene 收到后 scene.restart({ levelId: 'world-strip-boss', ... }) →
 *   新 scene 的 LEVEL_STARTED 触发本组件淡出。
 *
 * 与 `LevelTransitionOverlay` 的关系：
 *   - LevelTransitionOverlay 处理所有**非 boss** 的 `LEVEL_COMPLETED`，在
 *     `nextLevelId === 'world-strip-boss'` 时它会主动忽略，把舞台让给本组件。
 *   - 两者 z-index 错开：LevelTransition = z-40；本组件 = z-50，避免万一顺序错位
 *     时 UI 也不会出现"面板叠面板"的尴尬。
 *
 * 设计边界：
 *   - 仅靠 EventBus 与 Phaser 协同，不读 Phaser 实例 / router。
 *   - 自动播放被拦截时提供"点击开始"兜底（与 IntroVideoOverlay 一致）。
 */
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  BOSS_TRANSITION_LEVEL_ID,
  EVENT_KEYS,
  VIDEO_URLS,
} from '@/contents/constants'
import type { LevelCompletedPayload } from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

const visible = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const needsUserGesture = ref(false)
/** 去重：视频 ended / timeupdate 命中尾部 / skip 都会触发结束；保证 BOSS_TRANSITION_ENDED 只发一次 */
const finished = ref(false)

/**
 * 一些 mp4 编码（尤其是手动拼接 / 剪辑过的）在尾部 `ended` 事件会不触发 ——
 * 视频明明跑到末尾、currentTime === duration，但 `ended` event 就是不发。
 * 这是 "视频播完了但不加载下一关" 的常见 root cause。
 * 下面这个兜底：只要视频离末尾 < 0.25s 就当成结束，和 `@ended` 并行。
 */
const END_EPSILON_SEC = 0.25

/** 视频仍在加载 / 找不到数据时，也不让玩家永远卡在黑屏上的兜底秒数。 */
const WATCHDOG_MS = 15000
let watchdogTimer: number | null = null

const onLevelCompleted = (payload: unknown): void => {
  const p = payload as LevelCompletedPayload
  if (p.nextLevelId !== BOSS_TRANSITION_LEVEL_ID) return
  finished.value = false
  needsUserGesture.value = false
  visible.value = true
  // 启动"兜底定时器"：视频 canplay 后清掉；如果 15s 内都没开始播（例如资源加载失败），
  // 也不让玩家卡住 —— 直接 finish，scene.restart 进 boss 场景兜底。
  clearWatchdog()
  watchdogTimer = window.setTimeout(() => {
    console.warn('[BossTransitionOverlay] watchdog timeout, forcing finish')
    finishOnce('watchdog')
  }, WATCHDOG_MS)
  // <video> ref 在 nextTick 后才可用（Vue 的 DOM 更新是微任务批处理）
  void nextTick(() => void tryPlay())
}

/** 新关卡 create() 末尾 emit 的 LEVEL_STARTED —— 收到后无脑淡出（保险） */
const onLevelStarted = (): void => {
  console.log('[BossTransitionOverlay] LEVEL_STARTED received → hide overlay')
  clearWatchdog()
  visible.value = false
}

const clearWatchdog = (): void => {
  if (watchdogTimer !== null) {
    window.clearTimeout(watchdogTimer)
    watchdogTimer = null
  }
}

const finishOnce = (reason: string): void => {
  if (finished.value) return
  finished.value = true
  clearWatchdog()
  console.log(`[BossTransitionOverlay] finish (${reason}) → emit BOSS_TRANSITION_ENDED`)
  eventBus.emit(EVENT_KEYS.BOSS_TRANSITION_ENDED)
}

const onEnded = (): void => {
  finishOnce('ended')
}

/** `ended` 事件在某些 mp4 编码下不可靠；currentTime 快到 duration 时也算完 */
const onTimeUpdate = (): void => {
  const el = videoEl.value
  if (!el) return
  const { duration, currentTime } = el
  if (!Number.isFinite(duration) || duration <= 0) return
  if (currentTime >= duration - END_EPSILON_SEC) {
    finishOnce('timeupdate-near-end')
  }
}

const onError = (): void => {
  console.warn('[BossTransitionOverlay] <video> error event —— 直接结束转场')
  finishOnce('video-error')
}

const onSkip = (): void => {
  videoEl.value?.pause()
  finishOnce('user-skip')
}

const tryPlay = async (): Promise<void> => {
  const el = videoEl.value
  if (!el) return
  try {
    await el.play()
    needsUserGesture.value = false
  } catch {
    needsUserGesture.value = true
  }
}

const onCanPlay = (): void => {
  // canplay 后第一次能清掉 watchdog：资源就绪 = 视频至少能开始播
  clearWatchdog()
  // 仍然尝试 play() —— 万一 autoplay 被拦，这里会落到 needsUserGesture
  void tryPlay()
}

const onManualPlay = (): void => {
  needsUserGesture.value = false
  void tryPlay()
}

const onKeyDown = (e: KeyboardEvent): void => {
  if (!visible.value) return
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault()
    onSkip()
  }
}

onMounted(() => {
  eventBus.on(EVENT_KEYS.LEVEL_COMPLETED, onLevelCompleted)
  eventBus.on(EVENT_KEYS.LEVEL_STARTED, onLevelStarted)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.LEVEL_COMPLETED, onLevelCompleted)
  eventBus.off(EVENT_KEYS.LEVEL_STARTED, onLevelStarted)
  window.removeEventListener('keydown', onKeyDown)
  clearWatchdog()
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="boss-transition-overlay">
      <video
        ref="videoEl"
        class="boss-transition-overlay__video"
        :src="VIDEO_URLS.BOSS_TRANSITION"
        autoplay
        playsinline
        preload="auto"
        @ended="onEnded"
        @timeupdate="onTimeUpdate"
        @error="onError"
        @canplay="onCanPlay"
      />

      <button
        v-if="needsUserGesture"
        class="boss-transition-overlay__play-gate"
        @click="onManualPlay"
      >
        <span class="boss-transition-overlay__play-icon">▶</span>
        <span class="boss-transition-overlay__play-text">点击开始播放</span>
      </button>

      <button class="boss-transition-overlay__skip" @click="onSkip">跳过 ▶</button>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.boss-transition-overlay {
  @apply absolute inset-0 z-50 flex items-center justify-center bg-black;
}

.boss-transition-overlay__video {
  @apply h-full w-full object-contain;
}

.boss-transition-overlay__skip {
  @apply absolute bottom-6 right-6 rounded-lg border border-white/30 bg-black/60 px-4 py-2 text-sm font-medium tracking-wider text-white/80 transition hover:bg-black/80 hover:text-white;
}

.boss-transition-overlay__play-gate {
  @apply absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-white transition hover:bg-black/85;
}

.boss-transition-overlay__play-icon {
  @apply flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/60 text-4xl;
}

.boss-transition-overlay__play-text {
  @apply text-lg tracking-widest text-white/80;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
