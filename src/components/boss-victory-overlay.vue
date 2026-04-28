<script setup lang="ts">
/**
 * BossVictoryOverlay —— BOSS 击破后的结算面板。
 *
 * 触发时序（详见 `contents/scenes/gameplay-scene.ts` 的 `onBossPhaseCleared`）：
 *   BOSS_DEFEATED → (BossPhase 延迟 2000ms) → BOSS_VICTORY → 面板渐入 →
 *   (scene 内部 2500ms) → LEVEL_COMPLETED → LevelTransitionOverlay 接手 →
 *   scene.restart 载入下一关。
 *
 * 设计边界：
 *   - 纯 Vue，只靠 EventBus 事件驱动；不读 Phaser 实例、不碰 router。
 *   - 面板生命周期由 scene 端控制：BOSS_VICTORY 打开，LEVEL_COMPLETED 关闭。
 *     因此**本组件不自带定时器**，也不自行 emit 任何控制事件。
 *   - 视觉：黑色径向遮罩 + 金色"击破"徽章 + boss 名字 + 装饰光束 + 下一关提示。
 *     用 Tailwind v4 atomic + 少量 `@keyframes`，保持在本文件里即可。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { EVENT_KEYS } from '@/contents/constants'
import type { BossVictoryPayload } from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

const visible = ref(false)
const bossName = ref('')
const nextLevelId = ref<string | undefined>(undefined)

const nextName = computed(() => nextLevelId.value ?? null)

/** 12 道装饰光束，用 computed 稳定顺序避免 Transition 抖动 */
const beams = computed(() => Array.from({ length: 12 }, (_, i) => i))

const onVictory = (payload: unknown) => {
  const p = payload as BossVictoryPayload
  bossName.value = p.displayName
  nextLevelId.value = p.nextLevelId
  visible.value = true
}

/**
 * LEVEL_COMPLETED 触发时关面板 —— scene 端在结算 2.5s 后才 emit 这个事件，
 * 紧接着 LevelTransitionOverlay 会弹出，完成"结算 → 过渡"的视觉接力。
 */
const onLevelCompleted = () => {
  visible.value = false
}

onMounted(() => {
  eventBus.on(EVENT_KEYS.BOSS_VICTORY, onVictory)
  eventBus.on(EVENT_KEYS.LEVEL_COMPLETED, onLevelCompleted)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.BOSS_VICTORY, onVictory)
  eventBus.off(EVENT_KEYS.LEVEL_COMPLETED, onLevelCompleted)
})
</script>

<template>
  <Transition name="victory">
    <div v-if="visible" class="boss-victory-overlay" aria-live="polite">
      <!-- 装饰光束（放射状） -->
      <div class="boss-victory-overlay__beams" aria-hidden="true">
        <div
          v-for="b in beams"
          :key="b"
          class="boss-victory-overlay__beam"
          :style="{ transform: `rotate(${(b * 360) / 12}deg)` }"
        />
      </div>

      <div class="boss-victory-overlay__panel">
        <!-- 金色徽章 -->
        <div class="boss-victory-overlay__badge" aria-hidden="true">
          <div class="boss-victory-overlay__badge-glow" />
          <div class="boss-victory-overlay__badge-core">VICTORY</div>
        </div>

        <!-- 主标题 -->
        <div class="boss-victory-overlay__title">BOSS 击破</div>

        <!-- Boss 名 -->
        <div class="boss-victory-overlay__boss-name">{{ bossName }}</div>

        <!-- 装饰分割线 -->
        <div class="boss-victory-overlay__divider">
          <span class="boss-victory-overlay__divider-dot" />
          <span class="boss-victory-overlay__divider-line" />
          <span class="boss-victory-overlay__divider-dot" />
        </div>

        <!-- 战绩栏（占位：后面接真数据时就填这里） -->
        <div class="boss-victory-overlay__stats">
          <div class="boss-victory-overlay__stat">
            <span class="boss-victory-overlay__stat-label">Rank</span>
            <span class="boss-victory-overlay__stat-value">S</span>
          </div>
          <div class="boss-victory-overlay__stat">
            <span class="boss-victory-overlay__stat-label">Bonus</span>
            <span class="boss-victory-overlay__stat-value">+1000</span>
          </div>
          <div class="boss-victory-overlay__stat">
            <span class="boss-victory-overlay__stat-label">Combo</span>
            <span class="boss-victory-overlay__stat-value">MAX</span>
          </div>
        </div>

        <!-- 下一关提示 -->
        <div v-if="nextName" class="boss-victory-overlay__next">
          <span class="boss-victory-overlay__next-label">即将进入</span>
          <span class="boss-victory-overlay__next-name">{{ nextName }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.boss-victory-overlay {
  @apply pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden;
  background: radial-gradient(
    ellipse at center,
    rgba(48, 16, 8, 0.65) 0%,
    rgba(5, 0, 0, 0.94) 100%
  );
}

/* ---- 放射光束 ---- */

.boss-victory-overlay__beams {
  @apply absolute inset-0 flex items-center justify-center;
  animation: victory-beams-spin 14s linear infinite;
}

.boss-victory-overlay__beam {
  @apply absolute left-1/2 top-1/2 h-[140%] w-12 origin-center;
  background: linear-gradient(
    to top,
    rgba(255, 210, 120, 0) 0%,
    rgba(255, 210, 120, 0.18) 40%,
    rgba(255, 180, 60, 0.35) 60%,
    rgba(255, 210, 120, 0.18) 80%,
    rgba(255, 210, 120, 0) 100%
  );
  margin-left: -1.5rem;
  margin-top: -70%;
}

/* ---- 面板 ---- */

.boss-victory-overlay__panel {
  @apply relative flex flex-col items-center gap-4 rounded-3xl border-2 border-amber-300/60 bg-slate-950/92 px-14 py-10 text-center shadow-[0_0_80px_rgba(252,191,73,0.35)] backdrop-blur-sm;
}

/* 徽章 */

.boss-victory-overlay__badge {
  @apply relative -mt-16 flex h-20 w-20 items-center justify-center;
}

.boss-victory-overlay__badge-glow {
  @apply absolute inset-0 rounded-full;
  background: radial-gradient(
    circle,
    rgba(255, 220, 130, 0.95) 0%,
    rgba(240, 170, 50, 0.6) 40%,
    rgba(240, 170, 50, 0) 70%
  );
  animation: victory-pulse 1.8s ease-in-out infinite;
}

.boss-victory-overlay__badge-core {
  @apply relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-200/80 bg-gradient-to-br from-amber-300 to-orange-500 text-[10px] font-black tracking-widest text-amber-900 shadow-inner;
}

/* 标题 */

.boss-victory-overlay__title {
  @apply bg-gradient-to-b from-amber-200 via-amber-100 to-amber-400 bg-clip-text text-6xl font-black tracking-[0.3em] text-transparent drop-shadow-[0_0_18px_rgba(252,191,73,0.5)];
  animation: victory-title-in 0.6s ease-out both;
}

/* boss 名 */

.boss-victory-overlay__boss-name {
  @apply text-2xl font-bold tracking-[0.4em] text-amber-200/90;
}

/* 分割线 */

.boss-victory-overlay__divider {
  @apply mt-1 flex items-center gap-2;
}

.boss-victory-overlay__divider-dot {
  @apply h-1.5 w-1.5 rotate-45 bg-amber-300/80;
}

.boss-victory-overlay__divider-line {
  @apply h-px w-32 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent;
}

/* 战绩 */

.boss-victory-overlay__stats {
  @apply mt-2 flex items-stretch gap-3;
}

.boss-victory-overlay__stat {
  @apply flex flex-col items-center gap-0.5 rounded-lg border border-amber-300/30 bg-amber-500/10 px-5 py-2;
}

.boss-victory-overlay__stat-label {
  @apply text-[10px] font-bold uppercase tracking-widest text-amber-200/70;
}

.boss-victory-overlay__stat-value {
  @apply text-2xl font-black text-amber-100;
}

/* 下一关提示 */

.boss-victory-overlay__next {
  @apply mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-amber-200/60;
}

.boss-victory-overlay__next-name {
  @apply text-sm font-bold tracking-widest text-amber-100;
}

/* ---- 动画 ---- */

@keyframes victory-beams-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes victory-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

@keyframes victory-title-in {
  from {
    transform: scale(0.6) translateY(-12px);
    opacity: 0;
    letter-spacing: 0.6em;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
    letter-spacing: 0.3em;
  }
}

.victory-enter-active,
.victory-leave-active {
  transition: opacity 0.4s ease;
}

.victory-enter-active .boss-victory-overlay__panel {
  animation: victory-panel-in 0.55s cubic-bezier(0.2, 0.85, 0.3, 1.15);
}

.victory-enter-from,
.victory-leave-to {
  opacity: 0;
}

@keyframes victory-panel-in {
  from {
    transform: scale(0.7) translateY(24px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
</style>
