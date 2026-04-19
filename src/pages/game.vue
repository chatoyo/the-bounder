<template>
  <div class="relative min-h-screen bg-gray-900">
    <!-- 游戏主体 -->
    <GameDemo ref="gameDemoRef" />

    <!-- 暂停遮罩 -->
    <Transition name="fade">
      <div
        v-if="isPaused"
        class="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div class="flex flex-col items-center gap-4 p-8 rounded-xl bg-gray-800/90 text-white">
          <h2 class="text-2xl font-bold">⏸ 游戏暂停</h2>
          <button
            class="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-500 transition text-lg"
            @click="resumeGame"
          >
            继续游戏
          </button>
          <RouterLink
            to="/"
            class="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition text-sm"
          >
            退出到主页
          </RouterLink>
        </div>
      </div>
    </Transition>

    <!-- 暂停按钮（游戏进行中显示） -->
    <button
      v-if="!isPaused"
      class="absolute top-4 right-4 z-10 px-3 py-1.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition text-sm"
      @click="pauseGame"
    >
      ⏸ 暂停
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import GameDemo from './game-demo/index.vue'
import { eventBus } from './game-demo/event-bus'
import { EVENT_KEYS } from './game-demo/constants'

const isPaused = ref(false)

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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
