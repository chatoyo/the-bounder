<script setup lang="ts">
/**
 * DeathOverlay —— 玩家死亡 → 复活之间的"失败"提示层。
 *
 * 单向数据流（Phaser → Vue）：
 *   - PLAYER_DIED    → 展开面板，记录死亡原因；同时 RespawnPhase 进入 freeze
 *     (见 phase-controller.ts, FREEZE_MS = 1200ms)。
 *   - PLAYER_RESPAWNED → 淡出面板。
 *
 * 不做按键交互：respawn 由 RespawnPhase 在时间窗口后自动触发。若将来需要"手动
 * 按任意键复活"，在 template 里加一个按钮，再 emit 一个 `player:respawn-request`
 * 事件即可（Phase C+）。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { EVENT_KEYS } from '@/contents/constants'
import type { PlayerDiedPayload } from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

const visible = ref(false)
const cause = ref<PlayerDiedPayload['cause']>('fall')

/** 中文化的死亡原因提示，与 PlayerDiedPayload['cause'] 一一对应 */
const CAUSE_TEXT: Readonly<Record<PlayerDiedPayload['cause'], string>> = {
  fall: '坠入深渊',
  hazard: '触碰尖刺',
  enemy: '被敌方击倒',
  crush: '被世界边缘挤压',
}

const onDied = (payload: unknown) => {
  const p = payload as PlayerDiedPayload
  cause.value = p.cause
  visible.value = true
}

const onRespawned = () => {
  visible.value = false
}

onMounted(() => {
  eventBus.on(EVENT_KEYS.PLAYER_DIED, onDied)
  eventBus.on(EVENT_KEYS.PLAYER_RESPAWNED, onRespawned)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.PLAYER_DIED, onDied)
  eventBus.off(EVENT_KEYS.PLAYER_RESPAWNED, onRespawned)
})
</script>

<template>
  <Transition name="death">
    <div v-if="visible" class="death-overlay" aria-live="assertive">
      <div class="death-overlay__panel">
        <div class="death-overlay__title">失败</div>
        <div class="death-overlay__reason">{{ CAUSE_TEXT[cause] }}</div>
        <div class="death-overlay__hint">正在复活…</div>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.death-overlay {
  @apply pointer-events-none absolute inset-0 z-40 flex items-center justify-center;
  background: radial-gradient(
    ellipse at center,
    rgba(90, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0.8) 100%
  );
}

.death-overlay__panel {
  @apply flex flex-col items-center gap-2 rounded-2xl border border-red-500/50 bg-slate-950/85 px-10 py-6 text-center shadow-[0_0_32px_rgba(220,38,38,0.45)];
}

.death-overlay__title {
  @apply text-6xl font-black tracking-[0.3em] text-red-400 drop-shadow-[0_0_12px_rgba(220,38,38,0.8)];
  animation: death-pulse 1.1s ease-in-out infinite;
}

.death-overlay__reason {
  @apply mt-1 text-sm font-medium uppercase tracking-widest text-red-200/90;
}

.death-overlay__hint {
  @apply mt-2 text-xs text-slate-400;
}

@keyframes death-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.85;
  }
}

.death-enter-active,
.death-leave-active {
  transition: opacity 0.28s ease;
}
.death-enter-active .death-overlay__panel {
  animation: death-panel-in 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.death-enter-from,
.death-leave-to {
  opacity: 0;
}

@keyframes death-panel-in {
  from {
    transform: scale(0.7) rotate(-3deg);
    opacity: 0;
  }
  to {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}
</style>
