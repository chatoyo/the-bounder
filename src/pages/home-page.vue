<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import GameButton from '@/components/game-button.vue'
import { AUDIO_TUNING, BGM_URLS } from '@/contents'

interface MenuItem {
	label: string
	variant: 'primary' | 'secondary'
	onClick: () => void
}

const router = useRouter()

const menuItems: MenuItem[] = [
	{
		label: '开始游戏',
		variant: 'primary',
		onClick: () => router.push({ name: 'how-to-play', query: { from: 'start' } }),
	},
	{
		label: '玩法介绍',
		variant: 'secondary',
		onClick: () => router.push({ name: 'how-to-play', query: { from: 'menu' } }),
	},
	{
		label: '关于我们',
		variant: 'secondary',
		onClick: () => router.push({ name: 'about-us' }),
	},
	{
		label: '退出游戏',
		variant: 'secondary',
		onClick: () => {
			window.close()
			window.location.href = 'about:blank'
		},
	},
]

// ---------------------------------------------------------------------------
// 菜单 BGM —— menu.mp3 在页面挂载时循环播放，卸载时停止。
//
// 浏览器自动播放策略：首次访问 `/` 时 `audio.play()` 很可能被拒（需要用户手势）。
// Promise 被 reject 时不抛错；挂一次性监听器（pointerdown / keydown），用户第一次
// 交互即解锁播放。导航离开时 unmount 会清理。
// ---------------------------------------------------------------------------

let menuAudio: HTMLAudioElement | null = null
let unlockAttached = false

const detachUnlock = () => {
	if (!unlockAttached) return
	window.removeEventListener('pointerdown', tryPlayOnInteraction)
	window.removeEventListener('keydown', tryPlayOnInteraction)
	unlockAttached = false
}

const tryPlayOnInteraction = (): void => {
	detachUnlock()
	menuAudio?.play().catch(() => {
		// 用户已交互却还是播不了，可能 audio 已被卸载 —— 静默忽略
	})
}

const attachUnlock = (): void => {
	if (unlockAttached) return
	unlockAttached = true
	window.addEventListener('pointerdown', tryPlayOnInteraction, { once: true })
	window.addEventListener('keydown', tryPlayOnInteraction, { once: true })
}

onMounted(() => {
	menuAudio = new Audio(BGM_URLS.MENU)
	menuAudio.loop = true
	menuAudio.volume = AUDIO_TUNING.MENU_VOLUME
	// `playsInline` 让移动端 Safari 不会把它劫持成全屏播放
	menuAudio.setAttribute('playsinline', '')
	menuAudio.play().catch(() => {
		// 首次访问被 autoplay 策略拦 → 等用户第一次交互再放
		attachUnlock()
	})
})

onBeforeUnmount(() => {
	detachUnlock()
	if (menuAudio) {
		menuAudio.pause()
		menuAudio.src = ''
		menuAudio = null
	}
})
</script>

<template>
	<div class="home-page">
		<video
			class="home-page__video"
			src="/videos/title.mp4"
			autoplay
			loop
			muted
			playsinline
			aria-hidden="true"
		/>
		<div class="home-page__grid" aria-hidden="true" />
		<div class="home-page__scanlines" aria-hidden="true" />

		<h1 class="home-page__title" data-text="THE BOUNDER">
			THE BOUNDER
		</h1>

		<nav class="home-page__nav">
			<GameButton v-for="item in menuItems" :key="item.label" :label="item.label" :variant="item.variant"
				@click="item.onClick" />
		</nav>
	</div>
</template>

<style lang="css" scoped>
@reference "@/style.css";

/* ---------- Cyberpunk neon palette (scoped to this page) ---------- */
.home-page {
	--neon-pink: #ff2d95;
	--neon-magenta: #ff00e5;
	--neon-cyan: #00eaff;
	--neon-purple: #8a2be2;
	--neon-bg-0: #05020d;
	--neon-bg-1: #0a0420;
	--neon-bg-2: #1a0735;

	@apply relative flex min-h-screen flex-col items-center justify-center gap-12 overflow-hidden;
	background-color: var(--neon-bg-0);
	color: #e8f6ff;
	user-select: none;
}

/* Full-bleed background video */
.home-page__video {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	pointer-events: none;
	z-index: 0;
}

/* Cyberpunk color wash on top of the video so the neon palette still reads */
.home-page::before {
	content: "";
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 1;
	background:
		radial-gradient(ellipse at 20% 10%, rgba(255, 45, 149, 0.25), transparent 55%),
		radial-gradient(ellipse at 80% 90%, rgba(0, 234, 255, 0.22), transparent 55%),
		linear-gradient(180deg, rgba(5, 2, 13, 0.55) 0%, rgba(10, 4, 32, 0.35) 50%, rgba(26, 7, 53, 0.55) 100%);
}

/* Perspective cyber-grid floor */
.home-page__grid {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 2;
	background-image:
		linear-gradient(rgba(0, 234, 255, 0.18) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 45, 149, 0.18) 1px, transparent 1px);
	background-size: 48px 48px;
	mask-image: radial-gradient(ellipse at 50% 60%, rgba(0, 0, 0, 0.9) 0%, transparent 75%);
	-webkit-mask-image: radial-gradient(ellipse at 50% 60%, rgba(0, 0, 0, 0.9) 0%, transparent 75%);
	animation: grid-drift 14s linear infinite;
}

/* CRT-style scanlines */
.home-page__scanlines {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 3;
	background: repeating-linear-gradient(to bottom,
			rgba(255, 255, 255, 0.03) 0px,
			rgba(255, 255, 255, 0.03) 1px,
			transparent 1px,
			transparent 3px);
	mix-blend-mode: overlay;
	opacity: 0.6;
}

/* Neon title with chromatic aberration */
.home-page__title {
	@apply relative text-6xl font-black tracking-[0.35em];
	color: #fff;
	text-shadow:
		0 0 8px rgba(255, 255, 255, 0.85),
		0 0 18px var(--neon-pink),
		0 0 38px var(--neon-magenta),
		0 0 78px var(--neon-purple);
	animation: neon-flicker 3.2s infinite;
	z-index: 4;
}

.home-page__title::before,
.home-page__title::after {
	content: attr(data-text);
	position: absolute;
	inset: 0;
	pointer-events: none;
	opacity: 0.75;
	mix-blend-mode: screen;
}

.home-page__title::before {
	color: var(--neon-cyan);
	text-shadow: 0 0 12px var(--neon-cyan);
	transform: translate(-2px, 0);
	clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
}

.home-page__title::after {
	color: var(--neon-pink);
	text-shadow: 0 0 12px var(--neon-pink);
	transform: translate(2px, 0);
	clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
}

.home-page__nav {
	@apply relative flex flex-col items-center gap-4;
	z-index: 4;
}

/* ---------- Animations ---------- */
@keyframes neon-flicker {

	0%,
	19%,
	21%,
	23%,
	25%,
	54%,
	56%,
	100% {
		opacity: 1;
		text-shadow:
			0 0 8px rgba(255, 255, 255, 0.85),
			0 0 18px var(--neon-pink),
			0 0 38px var(--neon-magenta),
			0 0 78px var(--neon-purple);
	}

	20%,
	24%,
	55% {
		opacity: 0.82;
		text-shadow: none;
	}
}

@keyframes grid-drift {
	0% {
		background-position: 0 0, 0 0;
	}

	100% {
		background-position: 48px 48px, 48px -48px;
	}
}
</style>
