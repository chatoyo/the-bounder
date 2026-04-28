/**
 * BootScene 的占位纹理生成 —— 用 Phaser.Graphics 画出"美术暂未到位"时的兜底贴图。
 *
 * 真素材接入流程：在 `asset-loader.ts` 用 `load.image(key, url)` 加载；
 * 这里的 `generate*Textures` 全部用 `if (!textures.exists(key))` 自检，
 * 真贴图加载成功后占位通道会自动跳过。所以"换素材"只需要改 asset-loader，
 * 不必动本文件。
 *
 * 纹理命名约定：
 *   - 玩家 / 子弹：`player` / `bullet`
 *   - 危险物 / 检查点：`hazard` / `checkpoint`
 *   - Biome 瓦片：`tile-{biome}` (grass / stone / ice / space) —— TileSprite 铺砖用
 *   - 视差：`px-sky-*` / `px-mountains-*` / `px-trees` / `px-fg-grass` / `px-fg-clouds`
 *   - NPC：`npc-sage` / `npc-merchant` / `npc-warrior`
 *   - 拾取：`pickup-flight` / `pickup-hp`
 *   - Boss：`boss-hulk` / `boss-wisp` / `boss-serpent` / `boss-colossus`
 *   - 敌人子弹 / 飞兵：`enemy-bullet` / `enemy-flyer`
 *   - World-strip 背景：每张图按 strip def 的 textureKey
 */
import * as Phaser from 'phaser'
import { ALL_WORLD_STRIP_DEFS } from '@/contents/data/levels'
import type { WorldStripImageDef } from '@/contents/types'

/**
 * 顺序生成所有占位纹理。BootScene.create 调一次即可。
 * 对应真素材已经存在的 key 会跳过，不会覆盖。
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  generateCoreTextures(scene)
  generateBiomeTiles(scene)
  generateParallaxTextures(scene)
  generateNpcTextures(scene)
  generatePickupTextures(scene)
  generateBossTextures(scene)
  generateEnemyTextures(scene)
  generateWorldStripTextures(scene)
}

// =============================================================================
// Core：通用平台 / 危险物 / 检查点 / 子弹
// =============================================================================

function generateCoreTextures(scene: Phaser.Scene): void {
  // 通用平台兜底（没 biome 时用）
  const pf = scene.make.graphics({ x: 0, y: 0 })
  pf.fillStyle(0x44aa44, 1)
  pf.fillRect(0, 0, 64, 16)
  pf.fillStyle(0x88ee88, 1)
  pf.fillRect(0, 0, 64, 2)
  pf.generateTexture('platform', 64, 16)
  pf.destroy()

  // 危险物
  const hz = scene.make.graphics({ x: 0, y: 0 })
  hz.fillStyle(0x882222, 1)
  hz.fillRect(0, 8, 32, 8)
  hz.fillStyle(0xdd3333, 1)
  hz.fillTriangle(2, 8, 8, 0, 14, 8)
  hz.fillTriangle(18, 8, 24, 0, 30, 8)
  hz.generateTexture('hazard', 32, 16)
  hz.destroy()

  // 检查点
  const cp = scene.make.graphics({ x: 0, y: 0 })
  cp.fillStyle(0x88ddee, 1)
  cp.fillRect(7, 0, 2, 48)
  cp.fillStyle(0x22aaff, 1)
  cp.fillRect(9, 4, 7, 12)
  cp.generateTexture('checkpoint', 16, 48)
  cp.destroy()

  // 玩家子弹 —— 青绿色光线
  // 三层叠色模拟光晕：外层深青绿 → 中层亮青绿 → 核心近白色高光
  const b = scene.make.graphics({ x: 0, y: 0 })
  b.fillStyle(0x00b894, 1)
  b.fillRect(0, 0, 8, 4)
  b.fillStyle(0x33ffc8, 1)
  b.fillRect(1, 1, 6, 2)
  b.fillStyle(0xe6fff5, 1)
  b.fillRect(2, 1, 4, 2)
  b.generateTexture('bullet', 8, 4)
  b.destroy()
}

// =============================================================================
// Biome tiles —— 32×16 方砖，TileSprite 铺开即可形成"地图"
// =============================================================================

function generateBiomeTiles(scene: Phaser.Scene): void {
  // grass: 顶部亮绿一条 + 下方深棕土层
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x6b4a22, 1)
    g.fillRect(0, 0, 32, 16)
    g.fillStyle(0x3fa63f, 1)
    g.fillRect(0, 0, 32, 4)
    g.fillStyle(0x6adb6a, 1)
    g.fillRect(0, 0, 32, 1)
    g.fillStyle(0x8d5a2b, 1)
    g.fillRect(6, 9, 2, 2)
    g.fillRect(22, 11, 2, 2)
    g.generateTexture('tile-grass', 32, 16)
    g.destroy()
  }
  // stone: 灰色方砖 + 竖向接缝
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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
    const g = scene.make.graphics({ x: 0, y: 0 })
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
    const g = scene.make.graphics({ x: 0, y: 0 })
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

// =============================================================================
// Parallax layers —— 宽度 512（足以让 TileSprite 重复时看不出缝）
// =============================================================================

function generateParallaxTextures(scene: Phaser.Scene): void {
  const W = 512
  const H = 200

  // 天空渐变（grass biome 用）
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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
    const g = scene.make.graphics({ x: 0, y: 0 })
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
    const g = scene.make.graphics({ x: 0, y: 0 })
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
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x5b6e92, 1)
    const peaks = [20, 60, 90, 40, 100, 70]
    for (let x = 0; x < W; x += 80) {
      const h = 40 + peaks[(x / 80) % peaks.length]
      g.fillTriangle(x - 20, 120, x + 40, 120 - h, x + 100, 120)
    }
    g.generateTexture('px-mountains-near', W, 120)
    g.destroy()
  }
  // 树木 / 灌木
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x2a5a2a, 1)
    for (let x = 0; x < W; x += 48) {
      const h = 28 + ((x * 13) % 20)
      g.fillRect(x, 60 - h, 6, h)
      g.fillTriangle(x - 10, 60 - h + 8, x + 3, 60 - h - 20, x + 16, 60 - h + 8)
    }
    g.generateTexture('px-trees', W, 80)
    g.destroy()
  }
  // 前景草叶
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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
  // 前景云雾
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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

// =============================================================================
// NPC / Pickup / Boss / Enemy 贴图
// =============================================================================

function generateNpcTextures(scene: Phaser.Scene): void {
  // sage: 紫色长袍 + 白胡子
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x7744aa, 1)
    g.fillRect(4, 16, 24, 32)
    g.fillStyle(0xffd1a3, 1)
    g.fillRect(8, 4, 16, 14)
    g.fillStyle(0xffffff, 1)
    g.fillRect(8, 14, 16, 6)
    g.fillStyle(0x000000, 1)
    g.fillRect(12, 9, 2, 2)
    g.fillRect(18, 9, 2, 2)
    g.generateTexture('npc-sage', 32, 48)
    g.destroy()
  }
  // merchant: 绿衣 + 金色 "$"
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xaa3a3a, 1)
    g.fillRect(4, 16, 24, 32)
    g.fillStyle(0x888888, 1)
    g.fillRect(8, 4, 16, 14)
    g.fillStyle(0x222222, 1)
    g.fillRect(10, 9, 12, 3)
    g.fillStyle(0xcccccc, 1)
    g.fillRect(26, 20, 4, 20)
    g.generateTexture('npc-warrior', 32, 48)
    g.destroy()
  }
}

function generatePickupTextures(scene: Phaser.Scene): void {
  // flight-orb: 金色圆环 + 翅膀符号
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffdd33, 1)
    g.fillCircle(12, 12, 10)
    g.fillStyle(0xfff5a0, 1)
    g.fillCircle(12, 12, 6)
    g.fillStyle(0xffffff, 1)
    g.fillTriangle(4, 12, 10, 8, 10, 14)
    g.fillTriangle(20, 12, 14, 8, 14, 14)
    g.generateTexture('pickup-flight', 24, 24)
    g.destroy()
  }
  // hp-crystal: 红色心形
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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

function generateBossTextures(scene: Phaser.Scene): void {
  // hulk
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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
  // wisp
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
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
  // serpent
  {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x226688, 1)
    g.fillRect(0, 24, 128, 48)
    g.fillStyle(0x44aadd, 1)
    g.fillRect(0, 28, 128, 8)
    g.fillStyle(0xffff00, 1)
    g.fillRect(110, 40, 6, 6)
    g.generateTexture('boss-serpent', 128, 96)
    g.destroy()
  }
  // colossus: 真素材兜底（asset-loader 加载失败时才走这条路）
  if (!scene.textures.exists('boss-colossus')) {
    const g = scene.make.graphics({ x: 0, y: 0 })
    const W = 580
    const H = 420
    g.fillStyle(0x3a0808, 0.4)
    g.fillEllipse(W / 2, H / 2, W * 0.95, H * 0.75)
    g.fillStyle(0x5a1010, 1)
    g.fillEllipse(W / 2, H / 2, W * 0.7, H * 0.55)
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

function generateEnemyTextures(scene: Phaser.Scene): void {
  // enemy-bullet: 紫色圆点
  const g = scene.make.graphics({ x: 0, y: 0 })
  g.fillStyle(0xaa44ff, 1)
  g.fillCircle(5, 5, 5)
  g.fillStyle(0xff88ff, 1)
  g.fillCircle(5, 5, 2)
  g.generateTexture('enemy-bullet', 10, 10)
  g.destroy()

  // enemy-flyer: 28×20 的小飞兵
  const f = scene.make.graphics({ x: 0, y: 0 })
  f.fillStyle(0x2a1b45, 1)
  f.fillEllipse(14, 10, 14, 10)
  f.fillStyle(0x6a4fbf, 1)
  f.fillTriangle(6, 10, 0, 2, 2, 12)
  f.fillTriangle(22, 10, 28, 2, 26, 12)
  f.fillStyle(0xb299ff, 1)
  f.fillTriangle(6, 10, 2, 4, 3, 11)
  f.fillTriangle(22, 10, 26, 4, 25, 11)
  f.fillStyle(0xe8d8ff, 1)
  f.fillTriangle(12, 4, 14, 0, 16, 4)
  f.fillStyle(0xff3355, 1)
  f.fillRect(11, 9, 2, 2)
  f.fillRect(15, 9, 2, 2)
  f.generateTexture('enemy-flyer', 28, 20)
  f.destroy()
}

// =============================================================================
// World-strip 占位图 —— 按 ALL_WORLD_STRIP_DEFS 生成所有未真实加载的底图
// =============================================================================
//
// 真素材接入时不必删本函数：textures.exists(textureKey) 为 true 时会直接跳过。

function generateWorldStripTextures(scene: Phaser.Scene): void {
  const palettes = [
    { skyTop: 0x2a3a66, skyBottom: 0xf0c48a, groundBody: 0x4a3220, groundTop: 0x66b43d, accent: 0x88dd66, label: '1' },
    { skyTop: 0x4a78b8, skyBottom: 0xb7d7f0, groundBody: 0x5a6070, groundTop: 0x9cbfd7, accent: 0xc0d8ea, label: '2' },
    { skyTop: 0x3a1a50, skyBottom: 0xe07a3a, groundBody: 0x3a2010, groundTop: 0xf4a460, accent: 0xffd38a, label: '3' },
  ] as const

  for (const def of ALL_WORLD_STRIP_DEFS) {
    def.images.forEach((imgDef, idx) => {
      if (scene.textures.exists(imgDef.textureKey)) return
      const palette = palettes[idx % palettes.length]
      generateWorldStripImage(scene, imgDef, def.height, palette)
    })
  }
}

function generateWorldStripImage(
  scene: Phaser.Scene,
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
  const g = scene.make.graphics({ x: 0, y: 0 })
  const W = def.width
  const H = imageHeight

  // 1. 天空渐变
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

  // 2. 地面
  const fallbackH = def.sections[0]?.groundHeight ?? 0
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

  // 3. 参考线
  g.lineStyle(1, palette.accent, 0.4)
  for (let x = 0; x < W; x += 200) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.strokePath()
  }

  // 4. 标签数字
  g.fillStyle(palette.accent, 0.9)
  g.fillRect(20, 20, 80, 80)
  g.fillStyle(0x000000, 0.8)
  g.fillRect(24, 24, 72, 72)
  g.fillStyle(palette.accent, 1)
  drawBigDigit(g, palette.label, 40, 34, 32, 52)

  // 5. overlap 提示
  if (def.overlapNext > 0) {
    const overlapStart = W - def.overlapNext
    g.fillStyle(0xff4040, 0.15)
    g.fillRect(overlapStart, 0, def.overlapNext, H)
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

/**
 * 7-段数字（占位图里区分是第几张 strip 图片）。
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
  if (s[0]) g.fillRect(x + thick, y, w - 2 * thick, thick)
  if (s[1]) g.fillRect(x + w - thick, y + thick, thick, halfH - thick)
  if (s[2]) g.fillRect(x + w - thick, y + halfH, thick, halfH - thick)
  if (s[3]) g.fillRect(x + thick, y + h - thick, w - 2 * thick, thick)
  if (s[4]) g.fillRect(x, y + halfH, thick, halfH - thick)
  if (s[5]) g.fillRect(x, y + thick, thick, halfH - thick)
  if (s[6]) g.fillRect(x + thick, y + halfH - thick / 2, w - 2 * thick, thick)
}
