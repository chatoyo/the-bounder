<template>
  <div class="relative flex items-center justify-center min-h-screen bg-gray-900">
    <!-- Phaser 画布挂载点 -->
    <div ref="gameContainer" class="relative">
      <!-- Vue HUD 层：叠在 Phaser 画布上方 -->
      <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 pointer-events-none">
        <span class="text-yellow-300 text-lg font-bold">⭐ 分数: {{ score }}</span>
        <button
          class="pointer-events-auto px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-500 transition"
          @click="restartGame"
        >
          重新开始
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as Phaser from 'phaser'
import { BootScene } from './scenes/boot-scene'
import { GameScene } from './scenes/game-scene'
import { GAME_CONFIG, EVENT_KEYS } from './constants'
import { eventBus } from './event-bus'

const gameContainer = ref<HTMLDivElement>()
const score = ref(0)

let game: Phaser.Game | null = null

/** 监听 Phaser 发来的分数更新 */
const onScoreUpdate = (newScore: unknown) => {
  score.value = newScore as number
}

/** Vue 侧触发重启 */
const restartGame = () => {
  score.value = 0
  eventBus.emit(EVENT_KEYS.GAME_RESTART)
}

onMounted(() => {
  if (!gameContainer.value) return

  // 监听事件
  eventBus.on(EVENT_KEYS.SCORE_UPDATE, onScoreUpdate)

  // 创建 Phaser 实例
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_CONFIG.WIDTH,
    height: GAME_CONFIG.HEIGHT,
    parent: gameContainer.value,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // 重力在玩家 body 上单独设置
        debug: false,
      },
    },
    scene: [BootScene, GameScene],
    // 让 canvas 不抢焦点导致页面滚动
    input: {
      keyboard: true,
    },
  })
})

onUnmounted(() => {
  // 清理：销毁 Phaser 实例 + 事件监听
  eventBus.off(EVENT_KEYS.SCORE_UPDATE, onScoreUpdate)
  eventBus.clear()

  if (game) {
    game.destroy(true)
    game = null
  }
})
</script>

<style scoped>
/* Phaser canvas 自动插入到 gameContainer 内，无需额外样式 */
</style>
