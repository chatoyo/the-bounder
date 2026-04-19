<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameButton from '@/components/game-button.vue'

const route = useRoute()
const router = useRouter()

const fromStart = computed(() => route.query.from === 'start')

function handleAction() {
  if (fromStart.value) {
    // TODO: 进入游戏场景
    router.push({ name: 'game' }) //后续改进
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
    <h2 class="text-4xl font-bold text-amber-400">玩法介绍</h2>

    <div class="max-w-lg text-center leading-relaxed text-slate-300">
      <p>这里是玩法介绍的占位文本。</p>
      <p class="mt-4">游戏的核心玩法、操作方式和目标将在此处说明。</p>
    </div>

    <GameButton
      :label="fromStart ? '开始游戏' : '返回主页'"
      @click="handleAction"
    />
  </div>
</template>
