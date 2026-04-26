<template>
  <div class="game-demo">
    <!-- Phaser 画布挂载点 -->
    <div ref="gameContainer" class="game-demo__canvas">
      <!-- Vue 覆盖层：HUD（HP / 技能槽 / boss 血条）+ 对话框 -->
      <GameHud />
      <DialogueOverlay />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { BootScene, GameplayScene } from '@/contents'
import { useGame } from '@/runtime'
import GameHud from '@/components/game-hud.vue'
import DialogueOverlay from '@/components/dialogue-overlay.vue'

const gameContainer = ref<HTMLDivElement>()
const game = useGame()

onMounted(() => {
  if (!gameContainer.value) return

  // 创建 Phaser 实例：BootScene 作为初始场景，GameplayScene 后续动态加入
  game.initGame(gameContainer.value, BootScene)
  game.addScene(GameplayScene)
})

onUnmounted(() => {
  game.destroyGame(true)
})
</script>

<style lang="css" scoped>
@reference "@/style.css";

.game-demo {
  @apply relative flex min-h-screen items-center justify-center bg-gray-900;
}

.game-demo__canvas {
  @apply relative;
}
</style>
