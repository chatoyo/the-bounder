/**
 * Boot 阶段的资源预加载 —— 把 `this.load.audio / load.image` 调用抽出来，
 * 让 BootScene 只剩下"流程编排"。
 *
 * 真素材文件没传时 Phaser loader 会发 404 warn，但不会崩 scene；播放 / 取贴图侧
 * 用 `cache.audio.exists` / `textures.exists` 自检兜底。所以这里只管声明 url 即可。
 */
import * as Phaser from 'phaser'
import { ASSET_KEYS, BGM_URLS, SFX_URLS } from '@/contents/constants'
import { ALL_WORLD_STRIP_DEFS } from '@/contents/data/levels'

export function preloadAssets(scene: Phaser.Scene): void {
  // ---- BGM ----
  scene.load.audio(ASSET_KEYS.AUDIO.BGM_LEVEL_01, BGM_URLS.LEVEL_01)
  scene.load.audio(ASSET_KEYS.AUDIO.BGM_BOSS, BGM_URLS.BOSS)

  // ---- SFX ----
  // 文件暂未上传时，Phaser loader 会发 404 warn，但不会崩场景；播放侧用
  // `playSfx` 工具函数检 `cache.audio.exists`，不存在就静默跳过。
  // 作者补 mp3 直接丢 public/sfx/ 即可；不需要再改这里。
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_DAMAGE, SFX_URLS.DAMAGE)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_SHOOT, SFX_URLS.SHOOT)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_CHECKPOINT, SFX_URLS.CHECKPOINT)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_ENEMY_HIT, SFX_URLS.ENEMY_HIT)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_JUMP, SFX_URLS.JUMP)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_PLAYER_DIE, SFX_URLS.PLAYER_DIE)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_BOSS_DEFEATED, SFX_URLS.BOSS_DEFEATED)
  scene.load.audio(ASSET_KEYS.AUDIO.SFX_BOSS_PHASE_TRANSITION, SFX_URLS.BOSS_PHASE_TRANSITION)

  // ---- World-strip 真实素材：迭代所有 strip 关卡（demo + boss），凡是声明了 url 的都 preload ----
  // 未声明 url 的仍由 texture-factory 的 generateWorldStripTextures 生成占位纹理。
  // 重复 textureKey 由第一次 load 决定；set 去重避免 Phaser 收到同 key 重复 load 报 warn。
  const loadedStripKeys = new Set<string>()
  for (const def of ALL_WORLD_STRIP_DEFS) {
    for (const img of def.images) {
      if (!img.url) continue
      if (loadedStripKeys.has(img.textureKey)) continue
      scene.load.image(img.textureKey, img.url)
      loadedStripKeys.add(img.textureKey)
    }
  }

  // ---- 玩家 sprite：跑步 5 帧 + 静态跳跃 ----
  // 没有 idle 状态 —— 玩家始终在跑；跳跃用单帧静态图。
  // Key 约定：player-run-1..5 对应 public/sprites/player/1.png..5.png；
  // player-jump 对应 jump.png。动画在 player-anims.ts 注册为 'player-run'。
  for (let i = 1; i <= 5; i++) {
    scene.load.image(`player-run-${i}`, `/sprites/player/${i}.png`)
  }
  scene.load.image('player-jump', '/sprites/player/jump.png')

  // ---- 玩家 boss 关卡专属 sprite：站在浮空平台上 ----
  scene.load.image('player-floating-platform', '/pics/floating-platform.png')

  // ---- Boss 真素材：`colossus` 变体（终章 Lovecraftian 机械章鱼）----
  // 文件缺失时 texture-factory 会退回到深红椭圆占位。
  scene.load.image('boss-colossus', '/sprites/boss/boss.png')
}
