<template>
  <div class="game-page">
    <!--
      过场动画优先：intro_1 + intro_2 播放完之前不挂载 GameDemo。
      这样 Phaser 根本没启动，更不会播 BGM —— 满足"进游戏前播视频，期间不要 BGM"
      的约束。IntroVideoOverlay 自己管播放顺序 / 跳过 / autoplay 兜底。
    -->
    <IntroVideoOverlay
      v-if="!introDone"
      :videos="INTRO_VIDEOS"
      @finished="onIntroFinished"
    />

    <template v-else>
      <!-- 游戏主体，到时候需要改成GameContainer或者是别的 -->
      <GameDemo ref="gameDemoRef" />

      <!-- 暂停遮罩 -->
      <Transition name="fade">
        <div v-if="isPaused" class="game-page__overlay">
          <div class="game-page__pause-panel">
            <h2 class="game-page__pause-title">⏸ 游戏暂停</h2>
            <button class="game-page__resume-btn" @click="resumeGame">
              继续游戏
            </button>
            <RouterLink to="/" class="game-page__exit-btn">
              退出到主页
            </RouterLink>
          </div>
        </div>
      </Transition>

      <!-- 暂停按钮（游戏进行中显示） -->
      <button v-if="!isPaused" class="game-page__pause-trigger" @click="pauseGame">
        ⏸ 暂停
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import GameDemo from './game-demo/index.vue'
import IntroVideoOverlay from '@/components/intro-video-overlay.vue'
import { useEventBus } from '@/runtime'
import { EVENT_KEYS, VIDEO_URLS } from '@/contents'

const eventBus = useEventBus()
const isPaused = ref(false)

/**
 * 过场动画是否已结束。false 时 GameDemo 不挂载（= Phaser 未启动 = 无 BGM）；
 * 仅当 IntroVideoOverlay emit('finished') 后才翻转为 true 让游戏开始。
 */
const introDone = ref(false)

const INTRO_VIDEOS = [VIDEO_URLS.INTRO_1, VIDEO_URLS.INTRO_2] as const

const onIntroFinished = (): void => {
  introDone.value = true
}

const pauseGame = () => {
  isPaused.value = true
  eventBus.emit(EVENT_KEYS.GAME_PAUSE)
}

const resumeGame = () => {
  isPaused.value = false
  eventBus.emit(EVENT_KEYS.GAME_RESUME)
}

/** ESC 键切换暂停 */
const onKeyDown = (e: KeyboardEvent) => {
  // 过场动画期间 Esc 归 IntroVideoOverlay 用（跳过当前段），不参与暂停逻辑
  if (!introDone.value) return
  if (e.key === 'Escape') {
    if (isPaused.value) resumeGame()
    else pauseGame()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style lang="css" scoped>
@reference "@/style.css";

.game-page {
  @apply relative min-h-screen bg-gray-900;
}

.game-page__overlay {
  @apply absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm;
}

.game-page__pause-panel {
  @apply flex flex-col items-center gap-4 rounded-xl bg-gray-800/90 p-8 text-white;
}

.game-page__pause-title {
  @apply text-2xl font-bold;
}

.game-page__resume-btn {
  @apply rounded-lg bg-green-600 px-6 py-2 text-lg transition hover:bg-green-500;
}

.game-page__exit-btn {
  @apply rounded-lg bg-gray-600 px-6 py-2 text-sm transition hover:bg-gray-500;
}

.game-page__pause-trigger {
  @apply absolute top-4 right-4 z-10 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/20 hover:text-white;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
