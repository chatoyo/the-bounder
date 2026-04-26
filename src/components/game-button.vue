<script setup lang="ts">
interface Props {
  label: string
  variant?: 'primary' | 'secondary'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
})
</script>

<template>
  <button
    class="game-button"
    :class="[variant === 'primary' ? 'game-button--primary' : 'game-button--secondary']"
  >
    {{ label }}
  </button>
</template>

<style lang="css" scoped>
@reference "@/style.css";

/* ---------- Cyberpunk neon palette (shared with home-page) ---------- */
.game-button {
  --neon-pink: #ff2d95;
  --neon-magenta: #ff00e5;
  --neon-cyan: #00eaff;
  --neon-purple: #8a2be2;

  @apply relative min-w-48 cursor-pointer rounded-lg border px-8 py-3 text-lg font-semibold uppercase transition-all duration-200;
  letter-spacing: 0.18em;
  backdrop-filter: blur(2px);
}

.game-button--primary {
  background: linear-gradient(135deg, var(--neon-pink) 0%, var(--neon-magenta) 100%);
  border-color: rgba(255, 255, 255, 0.35);
  color: #0a0420;
  box-shadow:
    0 0 12px var(--neon-pink),
    0 0 28px rgba(255, 45, 149, 0.55),
    inset 0 0 10px rgba(255, 255, 255, 0.35);
  text-shadow: 0 0 6px rgba(255, 255, 255, 0.65);
}

.game-button--primary:hover {
  background: linear-gradient(135deg, #ff55a8 0%, #ff3ef0 100%);
  box-shadow:
    0 0 16px var(--neon-pink),
    0 0 42px var(--neon-magenta),
    inset 0 0 14px rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}

.game-button--primary:active {
  transform: translateY(1px);
  box-shadow:
    0 0 10px var(--neon-pink),
    inset 0 0 18px rgba(0, 0, 0, 0.35);
}

.game-button--secondary {
  background: rgba(5, 2, 13, 0.55);
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
  box-shadow:
    0 0 10px rgba(0, 234, 255, 0.55),
    inset 0 0 10px rgba(0, 234, 255, 0.12);
  text-shadow: 0 0 8px rgba(0, 234, 255, 0.8);
}

.game-button--secondary:hover {
  background: rgba(0, 234, 255, 0.1);
  color: #ffffff;
  border-color: #ffffff;
  box-shadow:
    0 0 16px var(--neon-cyan),
    0 0 32px rgba(0, 234, 255, 0.45),
    inset 0 0 14px rgba(0, 234, 255, 0.25);
  transform: translateY(-1px);
}

.game-button--secondary:active {
  background: rgba(0, 234, 255, 0.18);
  transform: translateY(1px);
}
</style>
