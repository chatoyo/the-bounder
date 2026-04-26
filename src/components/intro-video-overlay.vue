<script setup lang="ts">
/**
 * IntroVideoOverlay —— 进入游戏前的过场动画播放器。
 *
 * 行为：
 *   - 按 `videos` 数组顺序播放若干 mp4（目前用于 intro_1 → intro_2）。
 *   - 任意一段播放结束自动切下一段；最后一段结束（或被跳过）后 emit('finished')。
 *   - 支持跳过：点击右下角"跳过 ▶"按钮、按空格 / Enter / Escape / Space 都能跳到下一段；
 *     已是最后一段则直接完成。
 *   - 自动播放可能被浏览器策略拦（mp4 带音轨）。被拦时显示一个大号"点击播放"按钮，
 *     用户一击即恢复；之后剩余视频会继承这次 user-gesture，后续段无缝接续。
 *
 * 设计边界：
 *   - 完全不碰 Phaser / EventBus —— 纯 Vue 组件，通过 props / emit 与外部协作。
 *   - 外部（`game.vue`）在这个组件还挂着时**不挂载** `GameDemo`，确保 Phaser 没启动、
 *     没有 BGM。组件消失等价于"可以开始游戏了"。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  /** 按顺序播放的视频 URL 数组（来自 `VIDEO_URLS.INTRO_*`） */
  videos: readonly string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'finished'): void
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const currentIndex = ref(0)
const needsUserGesture = ref(false)

/**
 * 某些 mp4 编码尾部不会触发 `ended`（坑点 Nr.1）；`timeupdate` 里查一下 currentTime
 * 离 duration 多近即可兜底推进。每段视频有独立的 "本段已完成" 标志避免 advance 被
 * 调多次。
 */
const END_EPSILON_SEC = 0.25
const advancedForIndex = ref(-1)

const currentSrc = computed(() => props.videos[currentIndex.value] ?? null)
const hasMore = computed(() => currentIndex.value < props.videos.length - 1)

/** 推进到下一段；若已是最后一段则 emit finished。 */
const advance = (): void => {
  if (advancedForIndex.value === currentIndex.value) return
  advancedForIndex.value = currentIndex.value
  if (hasMore.value) {
    currentIndex.value += 1
  } else {
    emit('finished')
  }
}

const onEnded = (): void => {
  advance()
}

/** `ended` 不可靠时的兜底 —— currentTime 快到 duration 就推进。 */
const onTimeUpdate = (): void => {
  const el = videoEl.value
  if (!el) return
  const { duration, currentTime } = el
  if (!Number.isFinite(duration) || duration <= 0) return
  if (currentTime >= duration - END_EPSILON_SEC) advance()
}

/** 视频加载 / 解码出错也要往下走，避免卡在黑屏。 */
const onError = (): void => {
  console.warn('[IntroVideoOverlay] <video> error event —— 跳到下一段')
  advance()
}

/** 用户主动跳过当前段 */
const onSkip = (): void => {
  videoEl.value?.pause()
  advance()
}

/**
 * 用 `await el.play()` 启动播放；失败（autoplay 策略）时打开"点击播放"兜底按钮。
 * 每次 `currentSrc` 变化后（watch）都会自动重新尝试。
 */
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

const onManualPlay = (): void => {
  // user-gesture：此时 play() 一定成功；后续视频段可以静默自动播放
  needsUserGesture.value = false
  void tryPlay()
}

/** 键盘快捷键：空格 / Enter / Esc 都跳过当前段 */
const onKeyDown = (e: KeyboardEvent): void => {
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault()
    onSkip()
  }
}

// 切换 src 时 Vue 的 `:key` 会重建 <video>，onMounted 里的 tryPlay 不会再跑 —— 用
// watch 手动接续播放。
watch(currentSrc, () => {
  needsUserGesture.value = false
  // 下一个 tick 再 play，确保新的 <video> 元素已挂到 DOM
  queueMicrotask(() => void tryPlay())
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="intro-video-overlay">
    <!-- 用 :key 绑定 src 让每次切段都重建 <video>，避免 src 变更被浏览器忽略 -->
    <video
      v-if="currentSrc"
      :key="currentSrc"
      ref="videoEl"
      class="intro-video-overlay__video"
      :src="currentSrc"
      autoplay
      playsinline
      preload="auto"
      @ended="onEnded"
      @timeupdate="onTimeUpdate"
      @error="onError"
      @canplay="tryPlay"
    />

    <!-- autoplay 被拦截时的兜底：一个大按钮吃下用户第一次点击 -->
    <button
      v-if="needsUserGesture"
      class="intro-video-overlay__play-gate"
      @click="onManualPlay"
    >
      <span class="intro-video-overlay__play-icon">▶</span>
      <span class="intro-video-overlay__play-text">点击开始播放</span>
    </button>

    <!-- 跳过按钮：始终可见，但视觉上淡，避免干扰观看 -->
    <button class="intro-video-overlay__skip" @click="onSkip">跳过 ▶</button>
  </div>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.intro-video-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black;
}

.intro-video-overlay__video {
  @apply h-full w-full object-contain;
}

.intro-video-overlay__skip {
  @apply absolute bottom-6 right-6 rounded-lg border border-white/30 bg-black/60 px-4 py-2 text-sm font-medium tracking-wider text-white/80 transition hover:bg-black/80 hover:text-white;
}

.intro-video-overlay__play-gate {
  @apply absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-white transition hover:bg-black/85;
}

.intro-video-overlay__play-icon {
  @apply flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/60 text-4xl;
}

.intro-video-overlay__play-text {
  @apply text-lg tracking-widest text-white/80;
}
</style>
