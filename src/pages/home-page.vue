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
		<h1 class="home-page__title">
			[请输入文本]
		</h1>

		<nav class="home-page__nav">
			<GameButton v-for="item in menuItems" :key="item.label" :label="item.label" :variant="item.variant"
				@click="item.onClick" />
		</nav>
	</div>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.home-page {
	@apply flex min-h-screen flex-col items-center justify-center gap-12;
}

.home-page__title {
	@apply text-5xl font-bold tracking-widest text-amber-400;
}

.home-page__nav {
	@apply flex flex-col items-center gap-4;
}
</style>
