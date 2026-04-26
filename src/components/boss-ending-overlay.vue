<script setup lang="ts">
/**
 * BossEndingOverlay —— 终极 boss 击破后的"好结局"视频播放器。
 *
 * 时序（详见 `contents/scenes/gameplay-scene.ts#onBossPhaseCleared`）：
 *   BOSS_DEFEATED → (BossPhase 延迟 2000ms) → SCENE_EVENT_BOSS_PHASE_CLEARED
 *   → GameplayScene 锁相机 + 暂停物理 + 停 BGM + 发 BOSS_ENDING_START
 *   → 本覆盖层接管 → 播 good_ending.mp4
 *   → 视频 ended / skip / error / 看门狗 → emit BOSS_ENDING_ENDED
 *   → GameplayScene emit BOSS_VICTORY → BossVictoryOverlay 打开常驻结算面板。
 *
 * 与 `BossTransitionOverlay` / `BossVictoryOverlay` 的关系：
 *   - BossTransitionOverlay 是"world-strip-demo → boss 场景"之间的关卡过场，
 *     触发源是 LEVEL_COMPLETED(nextLevelId=world-strip-boss)。本组件是**击破后**
 *     的结局动画，两者生命周期绝不重叠，可以共用 z-50。
 *   - BossVictoryOverlay 是结算面板（z-30）；本视频 z-50 盖在它之上，
 *     视频结束时 BossVictoryOverlay 才 emit 显示，所以实际上也不会并存。
 *
 * 设计边界：
 *   - 纯 Vue，只靠 EventBus 与 Phaser 协同，不读 Phaser 实例 / router。
 *   - 自动播放被拦截时提供"点击开始"兜底（与 IntroVideoOverlay / BossTransitionOverlay 一致）。
 *   - 可跳过：右下角"跳过 ▶" + Space/Enter/Escape。
 */
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { EVENT_KEYS, VIDEO_URLS } from '@/contents/constants'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

const visible = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const needsUserGesture = ref(false)
/**
 * 去重：视频 ended / timeupdate 命中尾部 / skip / error / 看门狗 都会触发结束；
 * 保证 BOSS_ENDING_ENDED 只发一次 —— GameplayScene 那边的监听器是 one-shot 的，
 * 发多次会导致 BOSS_VICTORY 也被 emit 多次（覆盖层重入）。
 */
const finished = ref(false)

/**
 * 某些 mp4 编码（尤其是剪辑后的）在尾部 `ended` 不会触发；这里用
 * `timeupdate` + currentTime ≥ duration - ε 作为兜底。与 BossTransitionOverlay
 * / IntroVideoOverlay 保持同一套解决方案。
 */
const END_EPSILON_SEC = 0.25

/** 视频仍在加载 / 找不到数据时，也不让玩家永远卡在黑屏上的兜底秒数。 */
const WATCHDOG_MS = 15000
let watchdogTimer: number | null = null

const onEndingStart = (): void => {
  console.log('[BossEndingOverlay] BOSS_ENDING_START received → show overlay')
  finished.value = false
  needsUserGesture.value = false
  visible.value = true
  clearWatchdog()
  watchdogTimer = window.setTimeout(() => {
    console.warn('[BossEndingOverlay] watchdog timeout, forcing finish')
    finishOnce('watchdog')
  }, WATCHDOG_MS)
  // <video> ref 在 nextTick 后才可用（Vue 的 DOM 更新是微任务批处理）
  void nextTick(() => void tryPlay())
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
  console.log(`[BossEndingOverlay] finish (${reason}) → emit BOSS_ENDING_ENDED`)
  eventBus.emit(EVENT_KEYS.BOSS_ENDING_ENDED)
  // 视觉上立刻淡出，把舞台让给 BossVictoryOverlay —— GameplayScene 接到
  // BOSS_ENDING_ENDED 后会 emit BOSS_VICTORY，两者淡入淡出可以平滑交接。
  visible.value = false
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
  console.warn('[BossEndingOverlay] <video> error event —— 直接结束转场')
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
  eventBus.on(EVENT_KEYS.BOSS_ENDING_START, onEndingStart)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.BOSS_ENDING_START, onEndingStart)
  window.removeEventListener('keydown', onKeyDown)
  clearWatchdog()
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="boss-ending-overlay">
      <video
        ref="videoEl"
        class="boss-ending-overlay__video"
        :src="VIDEO_URLS.GOOD_ENDING"
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
        class="boss-ending-overlay__play-gate"
        @click="onManualPlay"
      >
        <span class="boss-ending-overlay__play-icon">▶</span>
        <span class="boss-ending-overlay__play-text">点击开始播放</span>
      </button>

      <button class="boss-ending-overlay__skip" @click="onSkip">跳过 ▶</button>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.boss-ending-overlay {
  @apply absolute inset-0 z-50 flex items-center justify-center bg-black;
}

.boss-ending-overlay__video {
  @apply h-full w-full object-contain;
}

.boss-ending-overlay__skip {
  @apply absolute bottom-6 right-6 rounded-lg border border-white/30 bg-black/60 px-4 py-2 text-sm font-medium tracking-wider text-white/80 transition hover:bg-black/80 hover:text-white;
}

.boss-ending-overlay__play-gate {
  @apply absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-white transition hover:bg-black/85;
}

.boss-ending-overlay__play-icon {
  @apply flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/60 text-4xl;
}

.boss-ending-overlay__play-text {
  @apply text-lg tracking-widest text-white/80;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
