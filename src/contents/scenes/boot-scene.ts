import * as Phaser from 'phaser'
import { SCENE_KEYS, GAME_CONFIG } from '../constants'
import { useGame } from '@/runtime'

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
  }

  create(): void {
    this.generateCoreTextures()
    this.generateBiomeTiles()
    this.generateParallaxTextures()
    this.generateNpcTextures()
    this.generatePickupTextures()
    this.generateBossTextures()
    this.generateEnemyTextures()
    game.switchToScene(SCENE_KEYS.GAMEPLAY)
  }

  // =========================================================================
  // Core：玩家 / 子弹 / hazard / checkpoint / 兼容旧 'platform' key
  // =========================================================================

  private generateCoreTextures(): void {
    // 玩家：32×48 亮蓝色方块 + 白眉毛显示朝向
    const p = this.make.graphics({ x: 0, y: 0 })
    p.fillStyle(0x4488ff, 1)
    p.fillRect(0, 0, 32, 48)
    p.fillStyle(0xffffff, 1)
    p.fillRect(20, 10, 6, 4)
    p.generateTexture('player', 32, 48)
    p.destroy()

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
  }
}
