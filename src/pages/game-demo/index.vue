<template>
  <div class="game-demo">
    <!-- Phaser 画布挂载点 -->
    <div ref="gameContainer" class="game-demo__canvas">
      <!--
        Vue 覆盖层（由低 z 到高 z）：
          - GameHud：HP / 技能槽 / boss 血条（底层）
          - DialogueOverlay：NPC 对话框（中层）
          - DeathOverlay：玩家死亡到复活之间的"失败"提示（较高层）
          - BossVictoryOverlay：BOSS 击破结算面板（较高层；与 DeathOverlay 互斥）
          - LevelTransitionOverlay：过关到下一关的"准备载入"面板（常规关卡过渡，z-40）
          - BossTransitionOverlay：仅当 nextLevelId==='world-strip-boss' 时接管，
            播 boss_transition.mp4 替代常规过渡面板（z-50）
        死亡 / 胜利 / 过关不会同时发生，z 排序按"更强的阻断态更靠前"即可。
      -->
      <GameHud />
      <DialogueOverlay />
      <DeathOverlay />
      <BossVictoryOverlay />
      <LevelTransitionOverlay />
      <BossTransitionOverlay />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { BootScene, GameplayScene } from '@/contents'
import { useGame } from '@/runtime'
import GameHud from '@/components/game-hud.vue'
import DialogueOverlay from '@/components/dialogue-overlay.vue'
import DeathOverlay from '@/components/death-overlay.vue'
import BossVictoryOverlay from '@/components/boss-victory-overlay.vue'
import LevelTransitionOverlay from '@/components/level-transition-overlay.vue'
import BossTransitionOverlay from '@/components/boss-transition-overlay.vue'

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
