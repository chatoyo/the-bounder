/**
 * SFX 播放小工具 —— 给 scene 侧的任意调用点一条"有就响、没有就静默"的共享通道。
 *
 * 为什么不走 `sound.add`：
 *   - BGM 那种长音乐每场景一把手 `sound.add` 保留引用（暂停 / 恢复 / 淡出都要）；
 *     SFX 是"fire and forget"，同一瞬可能叠 3 颗子弹的开枪声 —— 每次都
 *     `sound.add` 会把 SoundManager 撑大，而 `sound.play(key, opts)` 是 Phaser
 *     推荐的短音效 API，内部自己管池化和重叠播放。
 *
 * 为什么要 cache 护栏：
 *   - 作者有时还没补上 mp3；BootScene 的 `this.load.audio(...)` 遇到 404 会 warn
 *     但不会崩，Phaser 只是没把 key 放进 cache。直接 `sound.play(key)` 此时会
 *     一路吐错到控制台。这里统一用 `cache.audio.exists` 检一下，没就静默跳过，
 *     真实素材到位那一刻自然开始响。
 *
 * 调用方：GameplayScene（受击 / checkpoint），ShootCapability（开枪）。所有调用
 * 点保持"拿得到 scene ref + 直接调本函数"这一种姿势，不引入 Sfx 类 / 单例，
 * 避免又多一个 scene-level 系统要去 register / destroy。
 */

import type * as Phaser from 'phaser'

/**
 * 播放一个短音效。key 不存在 → 静默跳过（不 warn，避免开发早期刷屏）。
 * `volume` 建议走 `AUDIO_TUNING.SFX_*_VOLUME`，不要每次调用现编。
 */
export function playSfx(scene: Phaser.Scene, key: string, volume: number): void {
  if (!scene.cache.audio.exists(key)) return
  scene.sound.play(key, { volume })
}
