<script setup lang="ts">
import { useRouter } from 'vue-router'
import GameButton from '@/components/game-button.vue'

interface TeamMember {
  name: string
  roles: string[]
}

const team: TeamMember[] = [
  { name: 'Sasha', roles: ['策划', '程序', '框架', '音乐'] },
  { name: 'Archie', roles: ['策划', '程序', '关卡设计'] },
  { name: '小笼', roles: ['策划', '美术', '世界观'] },
]

const router = useRouter()

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="about-us">
    <div class="about-us__grid" aria-hidden="true" />
    <div class="about-us__scanlines" aria-hidden="true" />

    <h2 class="about-us__title" data-text="关于我们">关于我们</h2>

    <div class="about-us__content">
      <p class="about-us__brand" data-text="Momakoding">Momakoding</p>
      <p class="about-us__tagline">一个有活力的团队</p>
    </div>

    <ul class="about-us__team" aria-label="团队成员">
      <li v-for="member in team" :key="member.name" class="about-us__member">
        <span class="about-us__member-name">{{ member.name }}</span>
        <span class="about-us__member-sep" aria-hidden="true">//</span>
        <span class="about-us__member-roles">
          <span v-for="role in member.roles" :key="role" class="about-us__role">
            {{ role }}
          </span>
        </span>
      </li>
    </ul>

    <footer class="about-us__footer">
      <blockquote class="about-us__quote">
        使用 <span class="about-us__accent">Momakoding GameJam Starter Web</span> 构建
      </blockquote>
      <GameButton label="返回主页" variant="secondary" @click="goHome" />
    </footer>
  </div>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.about-us {
  --neon-pink: #ff2d95;
  --neon-magenta: #ff00e5;
  --neon-cyan: #00eaff;
  --neon-purple: #8a2be2;
  --neon-bg-0: #05020d;

  @apply relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-6 py-10;
  background-color: var(--neon-bg-0);
  color: #e8f6ff;
}

.about-us::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse at 80% 15%, rgba(255, 45, 149, 0.22), transparent 55%),
    radial-gradient(ellipse at 15% 85%, rgba(0, 234, 255, 0.2), transparent 55%),
    linear-gradient(180deg, rgba(5, 2, 13, 0.6) 0%, rgba(10, 4, 32, 0.4) 50%, rgba(26, 7, 53, 0.6) 100%);
}

.about-us__grid {
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

.about-us__scanlines {
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

.about-us__title {
  @apply relative text-5xl font-black tracking-[0.35em];
  z-index: 3;
  color: #fff;
  text-shadow:
    0 0 8px rgba(255, 255, 255, 0.85),
    0 0 18px var(--neon-pink),
    0 0 38px var(--neon-magenta),
    0 0 78px var(--neon-purple);
}

.about-us__title::before,
.about-us__title::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.75;
  mix-blend-mode: screen;
}

.about-us__title::before {
  color: var(--neon-cyan);
  text-shadow: 0 0 12px var(--neon-cyan);
  transform: translate(-2px, 0);
  clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
}

.about-us__title::after {
  color: var(--neon-pink);
  text-shadow: 0 0 12px var(--neon-pink);
  transform: translate(2px, 0);
  clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
}

.about-us__content {
  @apply relative flex max-w-lg flex-col items-center gap-3 text-center;
  z-index: 3;
}

.about-us__brand {
  @apply relative text-4xl font-black tracking-[0.2em];
  color: #fff;
  text-shadow:
    0 0 6px rgba(255, 255, 255, 0.8),
    0 0 14px var(--neon-cyan),
    0 0 28px var(--neon-cyan);
}

.about-us__brand::before,
.about-us__brand::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.7;
  mix-blend-mode: screen;
}

.about-us__brand::before {
  color: var(--neon-pink);
  text-shadow: 0 0 10px var(--neon-pink);
  transform: translate(-2px, 0);
  clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
}

.about-us__brand::after {
  color: var(--neon-cyan);
  text-shadow: 0 0 10px var(--neon-cyan);
  transform: translate(2px, 0);
  clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
}

.about-us__tagline {
  @apply text-xl leading-relaxed;
  color: #e8f6ff;
  letter-spacing: 0.12em;
  text-shadow: 0 0 8px rgba(0, 234, 255, 0.5);
}

.about-us__team {
  @apply relative flex flex-col items-stretch gap-3 rounded-lg border px-6 py-5;
  z-index: 3;
  min-width: min(28rem, 90vw);
  border-color: rgba(0, 234, 255, 0.45);
  background: rgba(5, 2, 13, 0.55);
  box-shadow:
    0 0 12px rgba(0, 234, 255, 0.35),
    inset 0 0 12px rgba(255, 45, 149, 0.12);
  backdrop-filter: blur(2px);
  list-style: none;
}

.about-us__member {
  @apply flex flex-wrap items-center gap-x-3 gap-y-1;
  letter-spacing: 0.08em;
}

.about-us__member+.about-us__member {
  @apply border-t pt-3;
  border-color: rgba(0, 234, 255, 0.18);
}

.about-us__member-name {
  @apply text-lg font-bold;
  min-width: 4.5rem;
  color: var(--neon-pink);
  text-shadow:
    0 0 8px var(--neon-pink),
    0 0 16px rgba(255, 45, 149, 0.55);
}

.about-us__member-sep {
  color: rgba(0, 234, 255, 0.55);
  font-weight: 700;
  text-shadow: 0 0 6px rgba(0, 234, 255, 0.6);
}

.about-us__member-roles {
  @apply flex flex-wrap items-center gap-2;
}

.about-us__role {
  @apply rounded-md border px-2 py-0.5 text-sm font-semibold;
  border-color: rgba(0, 234, 255, 0.6);
  color: var(--neon-cyan);
  background: rgba(0, 234, 255, 0.08);
  box-shadow: inset 0 0 6px rgba(0, 234, 255, 0.15);
  text-shadow: 0 0 6px rgba(0, 234, 255, 0.8);
  letter-spacing: 0.1em;
}

.about-us__footer {
  @apply relative flex flex-col items-center gap-4;
  z-index: 3;
}

.about-us__quote {
  @apply text-sm italic;
  color: rgba(232, 246, 255, 0.65);
  letter-spacing: 0.06em;
}

.about-us__accent {
  color: var(--neon-cyan);
  text-shadow: 0 0 8px rgba(0, 234, 255, 0.8);
  font-style: normal;
  font-weight: 600;
}
</style>
