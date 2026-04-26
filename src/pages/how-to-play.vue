<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameButton from '@/components/game-button.vue'

const route = useRoute()
const router = useRouter()

const fromStart = computed(() => route.query.from === 'start')

function handleAction() {
  if (fromStart.value) {
    router.push({ name: 'game' })
  } else {
    router.push({ name: 'home' })
  }
}
</script>

<template>
  <div class="how-to-play">
    <div class="how-to-play__grid" aria-hidden="true" />
    <div class="how-to-play__scanlines" aria-hidden="true" />

    <h2 class="how-to-play__title" data-text="玩法介绍">玩法介绍</h2>

    <div class="how-to-play__content">
      <p class="how-to-play__line">
        使用 <kbd class="how-to-play__key">J</kbd> 攻击。
      </p>
      <p class="how-to-play__line">
        尽力往前跑，击败 <span class="how-to-play__accent--pink">BOSS</span>，
        躲避 <span class="how-to-play__accent--cyan">子弹</span> 和
        <span class="how-to-play__accent--cyan">弹幕虫</span>。
      </p>
    </div>

    <GameButton
      :label="fromStart ? '开始游戏' : '返回主页'"
      :variant="fromStart ? 'primary' : 'secondary'"
      @click="handleAction"
    />
  </div>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.how-to-play {
  --neon-pink: #ff2d95;
  --neon-magenta: #ff00e5;
  --neon-cyan: #00eaff;
  --neon-purple: #8a2be2;
  --neon-bg-0: #05020d;

  @apply relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-6;
  background-color: var(--neon-bg-0);
  color: #e8f6ff;
}

.how-to-play::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(255, 45, 149, 0.22), transparent 55%),
    radial-gradient(ellipse at 80% 90%, rgba(0, 234, 255, 0.2), transparent 55%),
    linear-gradient(180deg, rgba(5, 2, 13, 0.6) 0%, rgba(10, 4, 32, 0.4) 50%, rgba(26, 7, 53, 0.6) 100%);
}

.how-to-play__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background-image:
    linear-gradient(rgba(0, 234, 255, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 45, 149, 0.15) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 50% 60%, rgba(0, 0, 0, 0.9) 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 60%, rgba(0, 0, 0, 0.9) 0%, transparent 75%);
}

.how-to-play__scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background: repeating-linear-gradient(to bottom,
      rgba(255, 255, 255, 0.03) 0px,
      rgba(255, 255, 255, 0.03) 1px,
      transparent 1px,
      transparent 3px);
  mix-blend-mode: overlay;
  opacity: 0.6;
}

.how-to-play__title {
  @apply relative text-5xl font-black tracking-[0.35em];
  z-index: 3;
  color: #fff;
  text-shadow:
    0 0 8px rgba(255, 255, 255, 0.85),
    0 0 18px var(--neon-pink),
    0 0 38px var(--neon-magenta),
    0 0 78px var(--neon-purple);
}

.how-to-play__title::before,
.how-to-play__title::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.75;
  mix-blend-mode: screen;
}

.how-to-play__title::before {
  color: var(--neon-cyan);
  text-shadow: 0 0 12px var(--neon-cyan);
  transform: translate(-2px, 0);
  clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
}

.how-to-play__title::after {
  color: var(--neon-pink);
  text-shadow: 0 0 12px var(--neon-pink);
  transform: translate(2px, 0);
  clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
}

.how-to-play__content {
  @apply relative max-w-lg text-center text-xl leading-loose;
  z-index: 3;
  color: #e8f6ff;
}

.how-to-play__line {
  @apply mt-2;
}

.how-to-play__key {
  @apply inline-flex items-center justify-center rounded-md border px-3 py-0.5 font-mono text-base font-bold;
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
  background: rgba(0, 234, 255, 0.08);
  box-shadow:
    0 0 8px rgba(0, 234, 255, 0.55),
    inset 0 0 6px rgba(0, 234, 255, 0.2);
  text-shadow: 0 0 6px rgba(0, 234, 255, 0.8);
}

.how-to-play__accent--pink {
  color: var(--neon-pink);
  text-shadow: 0 0 10px var(--neon-pink), 0 0 20px var(--neon-magenta);
  font-weight: 700;
}

.how-to-play__accent--cyan {
  color: var(--neon-cyan);
  text-shadow: 0 0 10px var(--neon-cyan);
  font-weight: 600;
}
</style>
