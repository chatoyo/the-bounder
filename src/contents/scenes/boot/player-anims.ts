/**
 * 注册全局 'player-run' 动画。
 *
 * Phaser 的 anims 注册到 scene.anims 后会被 AnimationManager 全局持有，
 * 后续所有 scene 都能直接 anims.play('player-run')。所以在 BootScene 注册一次
 * 即可，不用每次进 GameplayScene 重新 create。
 *
 * 跳跃没有动画 —— Player 空中时 setTexture('player-jump') 贴静态图。
 */
import * as Phaser from 'phaser'

export function registerPlayerAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists('player-run')) return // 幂等：scene.restart 不会重复注册
  scene.anims.create({
    key: 'player-run',
    frames: [
      { key: 'player-run-1' },
      { key: 'player-run-2' },
      { key: 'player-run-3' },
      { key: 'player-run-4' },
      { key: 'player-run-5' },
    ],
    frameRate: 8,
    repeat: -1,
  })
}
