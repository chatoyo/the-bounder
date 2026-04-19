<script setup lang="ts">
import { useRouter } from 'vue-router'
import GameButton from '@/components/game-button.vue'

const router = useRouter()

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-10">
    <h2 class="text-4xl font-bold text-amber-400">关于我们</h2>

    <div class="max-w-lg text-center leading-relaxed text-slate-300 flex-1">
      <p>Momakoding</p>
      <p class="mt-4">这里是团队介绍和项目信息的占位文本。</p>


    </div>
    <footer class="flex flex-col items-center">
      <blockquote>使用Mamokoding GameJam Starter Web构建</blockquote>

      <GameButton label="返回主页" @click="goHome" />
    </footer>
  </div>
</template>
