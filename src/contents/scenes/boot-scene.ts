import * as Phaser from 'phaser'
import { ASSET_KEYS, BGM_URLS, GAME_CONFIG, SCENE_KEYS } from '../constants'
import { WORLD_STRIP_DEMO_DEF } from '../data/levels/world-strip-demo'
import { WORLD_STRIP_BOSS_DEF } from '../data/levels/world-strip-boss'
import type { WorldStripImageDef, WorldStripLoopDef } from '../types'
import { useGame } from '@/runtime'

/**
 * 所有需要 preload 图片素材的 world-strip 关卡定义集合。
 * 加新的 world-strip 关卡时：① 在 `src/contents/data/levels/` 加文件；
 * ② 在 `WORLD_STRIP_LEVELS` 收录；③ 在这个数组里追加 def，BootScene 自动
 * 迭代 load.image；④ 按需在 `generateWorldStripTextures` 的 palettes 里
 * 补占位色（有 url 的图片不会走占位通道，所以其实可以不补）。
 */
const ALL_WORLD_STRIP_DEFS: readonly WorldStripLoopDef[] = [
  WORLD_STRIP_DEMO_DEF,
  WORLD_STRIP_BOSS_DEF,
]

/**
 * 用 Graphics 画一个 7-段数字（占位图里用来区分是第几张 strip 图片）。
 * (x, y) = 左上角；w / h = 数字外接框。
 */
function drawBigDigit(
  g: Phaser.GameObjects.Graphics,
  digit: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const thick = Math.max(2, Math.floor(h / 10))
  // 段落顺序：a(顶) b(右上) c(右下) d(底) e(左下) f(左上) g(中)
  const segs: Record<string, boolean[]> = {
    '0': [true, true, true, true, true, true, false],
    '1': [false, true, true, false, false, false, false],
    '2': [true, true, false, true, true, false, true],
    '3': [true, true, true, true, false, false, true],
    '4': [false, true, true, false, false, true, true],
    '5': [true, false, true, true, false, true, true],
    '6': [true, false, true, true, true, true, true],
    '7': [true, true, true, false, false, false, false],
    '8': [true, true, true, true, true, true, true],
    '9': [true, true, true, true, false, true, true],
  }
  const s = segs[digit] ?? segs['0']
  const halfH = h / 2
  // a
  if (s[0]) g.fillRect(x + thick, y, w - 2 * thick, thick)
  // b
  if (s[1]) g.fillRect(x + w - thick, y + thick, thick, halfH - thick)
  // c
  if (s[2]) g.fillRect(x + w - thick, y + halfH, thick, halfH - thick)
  // d
  if (s[3]) g.fillRect(x + thick, y + h - thick, w - 2 * thick, thick)
  // e
  if (s[4]) g.fillRect(x, y + halfH, thick, halfH - thick)
  // f
  if (s[5]) g.fillRect(x, y + thick, thick, halfH - thick)
  // g
  if (s[6]) g.fillRect(x + thick, y + halfH - thick / 2, w - 2 * thick, thick)
}

const game = useGame()

/**
 * 启动场景 —— 用 Graphics 生成占位纹理，完成后切到主玩法场景。
 *
 * 纹理命名约定：
 *   - 玩家 / 子弹：`player` / `bullet`
 *   - 危险物 / 检查点：`hazard` / `checkpoint`
 *   - Biome 瓦片：`tile-{biome}` (grass / stone / ice / space) —— TileSprite 铺砖用
 *   - 视差：`px-sky-*` / `px-mountains-*` / `px-trees` / `px-fg-grass` / `px-fg-clouds`
 *   - NPC：`npc-sage` / `npc-merchant` / `npc-warrior`
 *   - 拾取：`pickup-flight` / `pickup-hp`
 *   - Boss：`boss-hulk` / `boss-wisp` / `boss-serpent`
 *   - 敌人子弹：`enemy-bullet`
 *   - 小飞兵（空中敌人）：`enemy-flyer`
 *
 * 真素材接入时，把 generateTexture 换成 `this.load.image(key, url)` 即可，key 不变。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT })
  }

  preload(): void {
    const { WIDTH: width, HEIGHT: height } = GAME_CONFIG

    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0x00ff88, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 10, 300 * value, 20)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
    })

    // ---- 音频：真实文件走 Phaser loader（占位纹理仍在 create() 里 generateTexture） ----
    this.load.audio(ASSET_KEYS.AUDIO.BGM_LEVEL_01, BGM_URLS.LEVEL_01)
    this.load.audio(ASSET_KEYS.AUDIO.BGM_BOSS, BGM_URLS.BOSS)

    // ---- World-strip 真实素材：迭代所有 strip 关卡（demo + boss），凡是声明了 url 的都 preload ----
    // 未声明 url 的仍由 create() 里的 generateWorldStripTextures 生成占位纹理。
    // 重复 textureKey 的图片（例如 demo 里 1.png 被 world-strip-1 / world-strip-4 两次引用）
    // 由第一次 load 决定；set 去重避免 Phaser 收到同 key 重复 load 报 warn。
    const loadedStripKeys = new Set<string>()
    for (const def of ALL_WORLD_STRIP_DEFS) {
      for (const img of def.images) {
        if (!img.url) continue
        if (loadedStripKeys.has(img.textureKey)) continue
        this.load.image(img.textureKey, img.url)
        loadedStripKeys.add(img.textureKey)
      }
    }

    // ---- 玩家 sprite：真实素材（跑步 5 帧 + 静态跳跃）----
    // 没有 idle 状态 —— 玩家始终在跑；跳跃用单帧静态图。
    // Key 约定：player-run-1..5 对应 public/sprites/player/1.png..5.png；
    // player-jump 对应 jump.png。动画在 create() 里注册为 'player-run'。
    for (let i = 1; i <= 5; i++) {
      this.load.image(`player-run-${i}`, `/sprites/player/${i}.png`)
    }
    this.load.image('player-jump', '/sprites/player/jump.png')

    // ---- 玩家 boss-场景专属 sprite：站在浮空平台上 ----
    // Boss 关卡里玩家被强制装备飞行能力，视觉上应当"漂在平台上向前飞"。
    // 该贴图只在 world-strip-boss 关卡通过 Player.useStaticSprite 切入，
    // 其它场景不使用；走 `load.image` 让 Phaser 预缓存。
    this.load.image('player-floating-platform', '/pics/floating-platform.png')

    // ---- Boss 真素材：`colossus` 变体（终章 Lovecraftian 机械章鱼）----
    // 只要文件存在，就把它注册成 'boss-colossus'；create() 里的
    // generateBossTextures 会检查 textures.exists('boss-colossus') 跳过占位生成，
    // 文件缺失时 create() 会退回到一个深红色椭圆占位图保证关卡可跑。
    this.load.image('boss-colossus', '/sprites/boss/boss.png')
  }

  create(): void {
    this.generateCoreTextures()
    this.generateBiomeTiles()
    this.generateParallaxTextures()
    this.generateNpcTextures()
    this.generatePickupTextures()
    this.generateBossTextures()
    this.generateEnemyTextures()
    this.generateWorldStripTextures()
    this.registerPlayerAnimations()
    game.switchToScene(SCENE_KEYS.GAMEPLAY)
  }

  // =========================================================================
  // Player animations —— 真素材一次性注册到全局 AnimationManager
  // =========================================================================
  //
  // Phaser 的 anims 注册到 scene.anims 后会被 AnimationManager 全局持有，
  // 后续所有 scene 都能直接 anims.play('player-run')。所以在 BootScene 注册一次
  // 即可，不用每次进 GameplayScene 重新 create。
  //
  // 手感参数：
  //   - frameRate ：每秒多少帧（12 = 典型 2D 跑步节奏；觉得跑太"快"就往下调到 10，
  //                 跑太"慢"就往上调到 14）
  //   - repeat -1：无限循环
  //
  // 跳跃没有动画 —— Player 空中时 setTexture('player-jump') 贴静态图。
  private registerPlayerAnimations(): void {
    if (this.anims.exists('player-run')) return // 幂等：scene.restart 不会重复注册
    this.anims.create({
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

  // =========================================================================
  // Core：玩家 / 子弹 / hazard / checkpoint / 兼容旧 'platform' key
  // =========================================================================

  private generateCoreTextures(): void {
    // 玩家纹理由 preload() 中的 this.load.image('player-run-1' / ... / 'player-jump')
    // 直接提供真实 sprite —— 不再生成占位方块。
    // 跑步动画在 registerPlayerAnimations() 里注册为 'player-run'。

    // 通用平台兜底（没 biome 时用）
    const pf = this.make.graphics({ x: 0, y: 0 })
    pf.fillStyle(0x44aa44, 1)
    pf.fillRect(0, 0, 64, 16)
    pf.fillStyle(0x88ee88, 1)
    pf.fillRect(0, 0, 64, 2)
    pf.generateTexture('platform', 64, 16)
    pf.destroy()

    // 危险物
    const hz = this.make.graphics({ x: 0, y: 0 })
    hz.fillStyle(0x882222, 1)
    hz.fillRect(0, 8, 32, 8)
    hz.fillStyle(0xdd3333, 1)
    hz.fillTriangle(2, 8, 8, 0, 14, 8)
    hz.fillTriangle(18, 8, 24, 0, 30, 8)
    hz.generateTexture('hazard', 32, 16)
    hz.destroy()

    // 检查点
    const cp = this.make.graphics({ x: 0, y: 0 })
    cp.fillStyle(0x88ddee, 1)
    cp.fillRect(7, 0, 2, 48)
    cp.fillStyle(0x22aaff, 1)
    cp.fillRect(9, 4, 7, 12)
    cp.generateTexture('checkpoint', 16, 48)
    cp.destroy()

    // 玩家子弹
    const b = this.make.graphics({ x: 0, y: 0 })
    b.fillStyle(0xffee33, 1)
    b.fillRect(0, 0, 8, 4)
    b.fillStyle(0xffffcc, 1)
    b.fillRect(4, 1, 4, 2)
    b.generateTexture('bullet', 8, 4)
    b.destroy()
  }

  // =========================================================================
  // Biome tiles —— 32×16 方砖，TileSprite 铺开即可形成"地图"
  // =========================================================================

  private generateBiomeTiles(): void {
    // grass: 顶部亮绿一条 + 下方深棕土层
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x6b4a22, 1)
      g.fillRect(0, 0, 32, 16)
      g.fillStyle(0x3fa63f, 1)
      g.fillRect(0, 0, 32, 4)
      g.fillStyle(0x6adb6a, 1)
      g.fillRect(0, 0, 32, 1)
      // 一粒小石子
      g.fillStyle(0x8d5a2b, 1)
      g.fillRect(6, 9, 2, 2)
      g.fillRect(22, 11, 2, 2)
      g.generateTexture('tile-grass', 32, 16)
      g.destroy()
    }
    // stone: 灰色方砖 + 竖向接缝
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x535968, 1)
      g.fillRect(0, 0, 32, 16)
      g.fillStyle(0x6f7583, 1)
      g.fillRect(0, 0, 32, 2)
      g.fillStyle(0x3a4051, 1)
      g.fillRect(15, 0, 1, 16)
      g.fillRect(0, 15, 32, 1)
      g.generateTexture('tile-stone', 32, 16)
      g.destroy()
    }
    // ice: 蓝白闪烁
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x9cd6ff, 1)
      g.fillRect(0, 0, 32, 16)
      g.fillStyle(0xe0f3ff, 1)
      g.fillRect(0, 0, 32, 3)
      g.fillStyle(0x71b9e3, 1)
      g.fillRect(0, 15, 32, 1)
      g.generateTexture('tile-ice', 32, 16)
      g.destroy()
    }
    // space: 深紫 + 电路高光
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x1a1438, 1)
      g.fillRect(0, 0, 32, 16)
      g.fillStyle(0x5a3fb0, 1)
      g.fillRect(0, 0, 32, 2)
      g.fillStyle(0xb0a0ff, 1)
      g.fillRect(4, 6, 4, 1)
      g.fillRect(20, 10, 4, 1)
      g.generateTexture('tile-space', 32, 16)
      g.destroy()
    }
  }

  // =========================================================================
  // Parallax layers —— 宽度 512（足以让 TileSprite 重复时看不出缝）
  // =========================================================================

  private generateParallaxTextures(): void {
    const W = 512
    const H = 200

    // 天空渐变（grass biome 用）
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      for (let i = 0; i < H; i++) {
        const t = i / H
        const r = Math.round(0x4a + (0xba - 0x4a) * t)
        const gr = Math.round(0x85 + (0xd9 - 0x85) * t)
        const bl = Math.round(0xd4 + (0xf0 - 0xd4) * t)
        g.fillStyle((r << 16) | (gr << 8) | bl, 1)
        g.fillRect(0, i, W, 1)
      }
      g.generateTexture('px-sky-day', W, H)
      g.destroy()
    }
    // 夜空渐变（space biome 用）+ 几颗星星
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      for (let i = 0; i < H; i++) {
        const t = i / H
        const r = Math.round(0x0a + (0x22 - 0x0a) * t)
        const gr = Math.round(0x05 + (0x10 - 0x05) * t)
        const bl = Math.round(0x20 + (0x40 - 0x20) * t)
        g.fillStyle((r << 16) | (gr << 8) | bl, 1)
        g.fillRect(0, i, W, 1)
      }
      g.fillStyle(0xffffff, 1)
      for (let i = 0; i < 40; i++) {
        const x = (i * 73) % W
        const y = (i * 31) % H
        g.fillRect(x, y, 1, 1)
      }
      g.fillStyle(0xffe8ff, 1)
      for (let i = 0; i < 10; i++) {
        const x = (i * 137) % W
        const y = (i * 47) % H
        g.fillRect(x, y, 2, 2)
      }
      g.generateTexture('px-sky-night', W, H)
      g.destroy()
    }
    // 远山剪影
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x000000, 0)
      g.fillRect(0, 0, W, 160)
      g.fillStyle(0x3b4b6e, 1)
      const peaks = [0, 40, 90, 110, 140, 180, 80, 130, 160]
      for (let x = 0; x < W; x += 60) {
        const h = 60 + peaks[(x / 60) % peaks.length]
        g.fillTriangle(x, 160, x + 40, 160 - h, x + 80, 160)
      }
      g.generateTexture('px-mountains-far', W, 160)
      g.destroy()
    }
    // 近山（颜色更饱和）
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x5b6e92, 1)
      const peaks = [20, 60, 90, 40, 100, 70]
      for (let x = 0; x < W; x += 80) {
        const h = 40 + peaks[(x / 80) % peaks.length]
        g.fillTriangle(x - 20, 120, x + 40, 120 - h, x + 100, 120)
      }
      g.generateTexture('px-mountains-near', W, 120)
      g.destroy()
    }
    // 树木 / 灌木（midground 之后的近景剪影）
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x2a5a2a, 1)
      for (let x = 0; x < W; x += 48) {
        const h = 28 + ((x * 13) % 20)
        g.fillRect(x, 60 - h, 6, h)
        g.fillTriangle(x - 10, 60 - h + 8, x + 3, 60 - h - 20, x + 16, 60 - h + 8)
      }
      g.generateTexture('px-trees', W, 80)
      g.destroy()
    }
    // 前景草叶（飞快划过屏幕底部）
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x000000, 0)
      g.fillRect(0, 0, W, 32)
      g.fillStyle(0x2d7a2d, 1)
      for (let x = 0; x < W; x += 12) {
        const h = 10 + ((x * 7) % 12)
        g.fillTriangle(x, 32, x + 3, 32 - h, x + 6, 32)
      }
      g.generateTexture('px-fg-grass', W, 32)
      g.destroy()
    }
    // 前景云雾（space biome 用的飘带）
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff, 0.25)
      for (let i = 0; i < 6; i++) {
        const cx = (i * 97) % W
        const cy = (i * 23) % 40
        g.fillCircle(cx, cy, 20 + (i % 3) * 6)
      }
      g.generateTexture('px-fg-clouds', W, 60)
      g.destroy()
    }
  }

  // =========================================================================
  // NPC 贴图
  // =========================================================================

  private generateNpcTextures(): void {
    // sage: 紫色长袍 + 白胡子
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x7744aa, 1)
      g.fillRect(4, 16, 24, 32)
      g.fillStyle(0xffd1a3, 1)
      g.fillRect(8, 4, 16, 14) // 脸
      g.fillStyle(0xffffff, 1)
      g.fillRect(8, 14, 16, 6) // 白胡子
      g.fillStyle(0x000000, 1)
      g.fillRect(12, 9, 2, 2)
      g.fillRect(18, 9, 2, 2)
      g.generateTexture('npc-sage', 32, 48)
      g.destroy()
    }
    // merchant: 绿衣 + 金色 "$"
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x3a8a4b, 1)
      g.fillRect(4, 16, 24, 32)
      g.fillStyle(0xffe28a, 1)
      g.fillRect(8, 4, 16, 14)
      g.fillStyle(0xd4a200, 1)
      g.fillRect(14, 24, 4, 12)
      g.fillRect(12, 26, 8, 2)
      g.fillRect(12, 32, 8, 2)
      g.generateTexture('npc-merchant', 32, 48)
      g.destroy()
    }
    // warrior: 红甲胄
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xaa3a3a, 1)
      g.fillRect(4, 16, 24, 32)
      g.fillStyle(0x888888, 1)
      g.fillRect(8, 4, 16, 14)
      g.fillStyle(0x222222, 1)
      g.fillRect(10, 9, 12, 3) // 面甲缝
      g.fillStyle(0xcccccc, 1)
      g.fillRect(26, 20, 4, 20) // 剑鞘
      g.generateTexture('npc-warrior', 32, 48)
      g.destroy()
    }
  }

  // =========================================================================
  // Pickup 贴图
  // =========================================================================

  private generatePickupTextures(): void {
    // flight-orb: 金色圆环 + 翅膀符号
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffdd33, 1)
      g.fillCircle(12, 12, 10)
      g.fillStyle(0xfff5a0, 1)
      g.fillCircle(12, 12, 6)
      g.fillStyle(0xffffff, 1)
      // 小翅膀
      g.fillTriangle(4, 12, 10, 8, 10, 14)
      g.fillTriangle(20, 12, 14, 8, 14, 14)
      g.generateTexture('pickup-flight', 24, 24)
      g.destroy()
    }
    // hp-crystal: 红色心形
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xdd2244, 1)
      g.fillCircle(7, 8, 5)
      g.fillCircle(17, 8, 5)
      g.fillTriangle(2, 9, 22, 9, 12, 22)
      g.fillStyle(0xff8ca0, 1)
      g.fillCircle(8, 7, 2)
      g.generateTexture('pickup-hp', 24, 24)
      g.destroy()
    }
  }

  // =========================================================================
  // Boss 贴图
  // =========================================================================

  private generateBossTextures(): void {
    // hulk: 大绿方块 + 红眼
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x2e5c2e, 1)
      g.fillRect(0, 0, 96, 96)
      g.fillStyle(0x66aa66, 1)
      g.fillRect(6, 6, 84, 16)
      g.fillStyle(0xff2a2a, 1)
      g.fillRect(22, 30, 12, 12)
      g.fillRect(62, 30, 12, 12)
      g.fillStyle(0x000000, 1)
      g.fillRect(20, 60, 56, 6)
      g.generateTexture('boss-hulk', 96, 96)
      g.destroy()
    }
    // wisp: 幽灵紫
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x8844ee, 1)
      g.fillCircle(48, 48, 40)
      g.fillStyle(0xbb88ff, 1)
      g.fillCircle(48, 38, 28)
      g.fillStyle(0xffffff, 1)
      g.fillCircle(38, 40, 5)
      g.fillCircle(58, 40, 5)
      g.generateTexture('boss-wisp', 96, 96)
      g.destroy()
    }
    // serpent: 狭长身体
    {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x226688, 1)
      g.fillRect(0, 24, 128, 48)
      g.fillStyle(0x44aadd, 1)
      g.fillRect(0, 28, 128, 8)
      g.fillStyle(0xffff00, 1)
      g.fillRect(110, 40, 6, 6)
      g.generateTexture('boss-serpent', 128, 96)
      g.destroy()
    }
    // colossus: 真素材兜底（只有 preload 里 `load.image('boss-colossus', ...)` 失败时才会走这条路）
    // 真素材加载成功后 textures.exists('boss-colossus') === true → 直接跳过，不覆盖真图。
    // 占位图尺寸 580×420 与期待的真素材相近，所以 BossEntity 的 scale + hitbox 配置
    // 在占位 / 真图间切换不会产生剧烈视觉跳变。
    if (!this.textures.exists('boss-colossus')) {
      const g = this.make.graphics({ x: 0, y: 0 })
      const W = 580
      const H = 420
      // 外围暗红光晕
      g.fillStyle(0x3a0808, 0.4)
      g.fillEllipse(W / 2, H / 2, W * 0.95, H * 0.75)
      // 主体暗红椭圆
      g.fillStyle(0x5a1010, 1)
      g.fillEllipse(W / 2, H / 2, W * 0.7, H * 0.55)
      // 中心机械核 + 红光
      g.fillStyle(0x222222, 1)
      g.fillRect(W / 2 - 70, H / 2 - 90, 140, 180)
      g.fillStyle(0xcc1020, 1)
      g.fillRect(W / 2 - 18, H / 2 - 70, 36, 140)
      g.fillStyle(0xff4040, 1)
      g.fillRect(W / 2 - 6, H / 2 - 50, 12, 100)
      g.generateTexture('boss-colossus', W, H)
      g.destroy()
    }
  }

  // =========================================================================
  // World-strip 占位图 —— 按 WORLD_STRIP_DEMO_DEF 生成 3 张长条背景图
  // =========================================================================
  //
  // 每张图：
  //   - 顶部到 (height - groundHeight) 画天空渐变（每张图用不同色调便于区分）。
  //   - 下方 groundHeight 像素画实心地面 + 上沿一条草/碎石亮线。
  //   - 每 200px 画一条浅色竖线 + 文字替代（此处用粗竖线），帮助视觉认路。
  //   - 即将被下一张图覆盖的 overlap 区域（右侧 overlapNext 像素）叠一层
  //     半透明红色条纹，让"哪段将被覆盖"一目了然（当第二张图画在其上时
  //     会完全被盖住，看不到；这是给调试视角 / 不加载第二张图时看的）。
  //
  // 真素材接入时把本函数整个删掉，改成 preload 里 this.load.image('world-strip-1', url)。
  private generateWorldStripTextures(): void {
    // 三张图各分一套配色，方便肉眼区分 "我正跑到哪张图"
    const palettes = [
      // image-1：黎明草原
      {
        skyTop: 0x2a3a66,
        skyBottom: 0xf0c48a,
        groundBody: 0x4a3220,
        groundTop: 0x66b43d,
        accent: 0x88dd66,
        label: '1',
      },
      // image-2：正午冷色
      {
        skyTop: 0x4a78b8,
        skyBottom: 0xb7d7f0,
        groundBody: 0x5a6070,
        groundTop: 0x9cbfd7,
        accent: 0xc0d8ea,
        label: '2',
      },
      // image-3：黄昏橙色
      {
        skyTop: 0x3a1a50,
        skyBottom: 0xe07a3a,
        groundBody: 0x3a2010,
        groundTop: 0xf4a460,
        accent: 0xffd38a,
        label: '3',
      },
    ] as const

    // 兼容所有 strip 关卡：对每张没有真实素材的图都生成占位纹理。
    // 占位纹理的 palette 按"本 strip 内第几张图"循环取色，方便肉眼区分相邻图片。
    for (const def of ALL_WORLD_STRIP_DEFS) {
      def.images.forEach((imgDef, idx) => {
        if (this.textures.exists(imgDef.textureKey)) return
        const palette = palettes[idx % palettes.length]
        this.generateWorldStripImage(imgDef, def.height, palette)
      })
    }
  }

  private generateWorldStripImage(
    def: WorldStripImageDef,
    imageHeight: number,
    palette: {
      skyTop: number
      skyBottom: number
      groundBody: number
      groundTop: number
      accent: number
      label: string
    },
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 })
    const W = def.width
    const H = imageHeight

    // ---- 1. 天空渐变（skyTop → skyBottom）----
    const [rTop, gTop, bTop] = [
      (palette.skyTop >> 16) & 0xff,
      (palette.skyTop >> 8) & 0xff,
      palette.skyTop & 0xff,
    ]
    const [rBot, gBot, bBot] = [
      (palette.skyBottom >> 16) & 0xff,
      (palette.skyBottom >> 8) & 0xff,
      palette.skyBottom & 0xff,
    ]
    for (let y = 0; y < H; y++) {
      const t = y / H
      const r = Math.round(rTop + (rBot - rTop) * t)
      const gg = Math.round(gTop + (gBot - gTop) * t)
      const b = Math.round(bTop + (bBot - bTop) * t)
      g.fillStyle((r << 16) | (gg << 8) | b, 1)
      g.fillRect(0, y, W, 1)
    }

    // ---- 2. 每段地面（按 sections 画；没写 section 的区域默认用 section[0] 的厚度兜底）----
    // section 只覆盖作者写到的范围（可能故意不覆盖最后 overlap 部分）；
    // 为了让占位图看起来"整条都有地面"，没写 section 的区域用第一个 section 的厚度。
    const fallbackH = def.sections[0]?.groundHeight ?? 0
    // 画地面：先画一条满幅兜底地面，再在每个 section 上覆盖"本段实际厚度"的地面。
    if (fallbackH > 0) {
      const topY = H - fallbackH
      g.fillStyle(palette.groundBody, 1)
      g.fillRect(0, topY, W, fallbackH)
      g.fillStyle(palette.groundTop, 1)
      g.fillRect(0, topY, W, 4)
    }
    for (const sec of def.sections) {
      const topY = H - sec.groundHeight
      g.fillStyle(palette.groundBody, 1)
      g.fillRect(sec.startX, topY, sec.endX - sec.startX, sec.groundHeight)
      g.fillStyle(palette.groundTop, 1)
      g.fillRect(sec.startX, topY, sec.endX - sec.startX, 5)
    }

    // ---- 3. 参考线：每 200px 一条竖线 + 右端边界线 ----
    g.lineStyle(1, palette.accent, 0.4)
    for (let x = 0; x < W; x += 200) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, H)
      g.strokePath()
    }

    // ---- 4. 图片左上角画一个"标签方块"便于识别是哪张图（纯占位；真素材时删） ----
    g.fillStyle(palette.accent, 0.9)
    g.fillRect(20, 20, 80, 80)
    g.fillStyle(0x000000, 0.8)
    g.fillRect(24, 24, 72, 72)
    g.fillStyle(palette.accent, 1)
    // 用像素块拼一个"1/2/3"：8×12 的粗体数字
    drawBigDigit(g, palette.label, 40, 34, 32, 52)

    // ---- 5. overlap 区域叠红色斜线（只在本图右端最后 overlapNext 像素；提示"将被下一张盖住"） ----
    if (def.overlapNext > 0) {
      const overlapStart = W - def.overlapNext
      // 红色半透明底
      g.fillStyle(0xff4040, 0.15)
      g.fillRect(overlapStart, 0, def.overlapNext, H)
      // 几条斜线
      g.lineStyle(2, 0xff6060, 0.5)
      for (let o = 0; o < def.overlapNext + H; o += 40) {
        g.beginPath()
        g.moveTo(overlapStart + o, 0)
        g.lineTo(overlapStart + o - H, H)
        g.strokePath()
      }
    }

    g.generateTexture(def.textureKey, W, H)
    g.destroy()
  }
  private generateEnemyTextures(): void {
    // enemy-bullet: 紫色圆点
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xaa44ff, 1)
    g.fillCircle(5, 5, 5)
    g.fillStyle(0xff88ff, 1)
    g.fillCircle(5, 5, 2)
    g.generateTexture('enemy-bullet', 10, 10)
    g.destroy()

    // enemy-flyer: 28×20 的小飞兵（尖刺双翼 + 红色眼点 + 深紫身体）
    // 体型故意做得比玩家(32×48)小、比子弹(8×4)大，保证子弹能精准命中但不显杂乱。
    const f = this.make.graphics({ x: 0, y: 0 })
    // 身体：紫黑椭圆
    f.fillStyle(0x2a1b45, 1)
    f.fillEllipse(14, 10, 14, 10)
    // 翅膀：左右三角
    f.fillStyle(0x6a4fbf, 1)
    f.fillTriangle(6, 10, 0, 2, 2, 12)
    f.fillTriangle(22, 10, 28, 2, 26, 12)
    // 翅膀高光
    f.fillStyle(0xb299ff, 1)
    f.fillTriangle(6, 10, 2, 4, 3, 11)
    f.fillTriangle(22, 10, 26, 4, 25, 11)
    // 尖角
    f.fillStyle(0xe8d8ff, 1)
    f.fillTriangle(12, 4, 14, 0, 16, 4)
    // 红色眼点
    f.fillStyle(0xff3355, 1)
    f.fillRect(11, 9, 2, 2)
    f.fillRect(15, 9, 2, 2)
    f.generateTexture('enemy-flyer', 28, 20)
    f.destroy()
  }
}
