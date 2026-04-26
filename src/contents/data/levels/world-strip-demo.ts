/**
 * Level：world-strip 循环演示 —— 用 `public/pics/1.png` / `2.png` / `3.jpg` 拼接。
 *
 * 数据模型：
 *   - `WorldStripLoopDef.images`：一串变宽定高的底图。
 *   - `WorldStripImageDef.overlapNext`：本图右边缘被下一张图覆盖的像素数（显示空间）；
 *     chunk 空间中 `image_{i+1}.leftX = image_i.leftX + image_i.width - image_i.overlapNext`。
 *   - `WorldStripImageDef.sections`：本图内的地面轮廓段（显示坐标系内的局部 x + 厚度）。
 *   - `WorldStripImageDef.url`：真实素材的相对 URL（有值时 BootScene 走 load.image）。
 *
 * 编译到 LevelDef：
 *   - `buildWorldStripLevel` 把每段 section 翻译成一个 `invisible: true` 的
 *     `PlatformSegmentDef`，放在对应 chunk 位置；`y` = `height - groundHeight`，
 *     `height` = `groundHeight`（矩形从地面上沿一直延伸到图片底边）。
 *   - 落在后一张图 overlap 范围内的 section 会被裁剪 / 丢弃 —— 视觉上也被后图覆盖了，
 *     让后图的 sections 接管那段地面。
 *   - 关卡 `loop: true` + `chunkWidth = 所有 (width - overlapNext) 的和`；
 *     LevelRunner 的周期 spawner 会让 platforms / checkpoints 跟随相机无限循环。
 *   - 每张图的起点各放一个 checkpoint，loop 模式下获得 `@${k}` 后缀永久保留，
 *     玩家死后重生到最近触达的那一个。
 *
 * 本关卡数据（真实素材）：
 *   height = 672（与 1.png / 2.png 原生分辨率一致；3.jpg 原生 3018×1280，
 *                WorldStripSystem 按显示宽度 setDisplaySize 缩放到 ~1584×672）。
 *
 *   image-1（1.png，1569×672）：overlapNext=120，地面剖面：
 *     [0..876] h=209 / [876..1046] h=190 / [1046..1569] h=165。
 *     → 前 1449px 可见；最后 120px 被 image-2 盖住。
 *
 *   image-2（2.png，1569×672）：overlapNext=200，地面剖面：
 *     [0..1569] h=165 整段平地。→ 前 1369px 可见；最后 200px 被 image-3 盖住。
 *
 *   image-3（3.jpg，原生 3018×1280，缩放到 1584×672 显示）：
 *     overlapNext=0（回到 image-1 的接缝无 overlap）；地面剖面：
 *     [0..1584] h=165 整段平地。显示尺寸下原 400px overlap 约对应 ~210px，
 *     这里按用户声明取 200px 在 image-2 端体现。
 *
 *   chunkWidth = (1569-120) + (1569-200) + (1584-0) = 1449 + 1369 + 1584 = 4402。
 *
 * 循环接缝：image-3 末端（h=165 → 地面顶 y=507）→ image-1 起点（h=209 → 地面顶 y=463）
 * 有 44px 的"台阶"。玩家跳跃峰高 ≈143px（JUMP_VELOCITY=-560 / GRAVITY=1100），
 * 单跳即可越过；不想要接缝台阶可以把 image-3 末端加一段 h=209 的 section。
 *
 * Boss（影之使徒）：boss-trigger 放在 chunk x=3500（image-3 境内，接缝之前）。
 * `LevelRunner.firedBossTriggers` 保证首圈触发一次 —— 之后玩家继续跑圈就不会
 * 再次遇到；想做"循环 boss"需要在 LevelRunner 里重置触发状态（后话）。
 */

import { BIOME_IDS } from '@/contents/constants'
import type {
  BuiltWorldStripLevel,
  CheckpointSegmentDef,
  LevelDef,
  PlatformSegmentDef,
  SegmentDef,
  WorldStripImageDef,
  WorldStripLoopDef,
  WorldStripPlacement,
} from '@/contents/types'

/**
 * 每张图片中 checkpoint（= 出生点）相对图片左缘的距离。
 *
 * 取 400 是因为主相机视口是 800×600（GAME_CONFIG.WIDTH）。GameplayScene 的
 * 自动滚动模式会把相机初始化在 `spawn.x - camera.width/2 = 0`，使玩家刚好
 * 落在视口横向正中央 —— 用户要求的"更居中 spawn"就落地在这一个常量上。
 *
 * 副作用：每圈（chunk）的 `strip-img-*@k` checkpoint 也都会位于本图起点向
 * 右 400px 处，而不是贴边；auto-scroll 追上来之前玩家有充分的反应距离。
 */
const SPAWN_PAD_X = 400

// =============================================================================
// 演示数据
// =============================================================================

/**
 * 注意：sections 只声明"视觉可见且由本图管辖"的范围。被后一张图 overlap 的
 * 区段也可以写（builder 会帮你裁掉），但作者自己显式停在 `width - overlapNext`
 * 更清晰。本 demo 的 image-1 故意在 1680（= 1980-300）处终止最后一个 section，
 * 即便 image-1 的贴图本身画到 1980。
 */
const WORLD_STRIP_DEMO: WorldStripLoopDef = {
  id: 'world-strip-demo',
  height: 672,
  biome: BIOME_IDS.GRASS,
  scroll: { mode: 'auto-right', speed: 180 },
  images: [
    // 1.png：1569×672 原生；三段阶梯下降 209 → 190 → 165
    {
      textureKey: 'world-strip-1',
      url: '/pics/1.png',
      width: 1569,
      overlapNext: 460,
      sections: [
        { startX: 0, endX: 826, groundHeight: 170 },
        { startX: 826, endX: 1055, groundHeight: 150 },
        { startX: 1055, endX: 1569, groundHeight: 126 },
      ],
    },
    // 2.png：1569×672 原生；平地 h=165
    {
      textureKey: 'world-strip-2',
      url: '/pics/2.png',
      width: 1569,
      overlapNext: 550,
      sections: [{ startX: 0, endX: 1569, groundHeight: 126 }],
    },
    // 3.png：3018×1280 原生，按 672 高度等比缩放到 1584 × 672 显示；平地 h=165
    {
      textureKey: 'world-strip-3',
      url: '/pics/3.png',
      width: 1584,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1584, groundHeight: 126 }],
    },
    // loop
    // 1.png：1569×672 原生；三段阶梯下降 209 → 190 → 165
    {
      textureKey: 'world-strip-4',
      url: '/pics/1.png',
      width: 1569,
      overlapNext: 460,
      sections: [
        { startX: 0, endX: 826, groundHeight: 170 },
        { startX: 826, endX: 1055, groundHeight: 150 },
        { startX: 1055, endX: 1569, groundHeight: 126 },
      ],
    },
    // 2.png：1569×672 原生；平地 h=165
    {
      textureKey: 'world-strip-5',
      url: '/pics/2.png',
      width: 1569,
      overlapNext: 550,
      sections: [{ startX: 0, endX: 1569, groundHeight: 126 }],
    },
    // 3.jpg：3018×1280 原生，按 672 高度等比缩放到 1584 × 672 显示；平地 h=165
    {
      textureKey: 'world-strip-6',
      url: '/pics/3.png',
      width: 1584,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1584, groundHeight: 126 }],
    },
    // final: 
    {
      textureKey: 'world-strip-final',
      url: '/pics/4.jpg',
      width: 1568,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1568, groundHeight: 126 }],
    },
  ],
  extraSegments: [
    // Boss："影之使徒"（boss-shadow）在第一圈 x=3500 登场；BossPhase 不锁相机，
    // auto-scroll 继续推进，boss 从屏幕右侧滑入并跟随视口。nextLevelId 留空 →
    // 击破后走 loop 关卡的"不结算"分支（GameplayScene.onBossPhaseCleared 恢复
    // auto-scroll），玩家继续跑圈，不会被转场打断。
    {
      type: 'boss-trigger',
      id: 'shadow-trigger',
      x: 3500,
      bossId: 'boss-shadow',
    },
  ],
}

// =============================================================================
// Builder：WorldStripLoopDef → LevelDef + placement meta
// =============================================================================

/**
 * 把 WorldStripLoopDef 编译成 LevelDef。
 * 产出的 LevelDef 永远是 `loop: true`，其 segments 仅包含不可见 platform +
 * 起点 checkpoint；pickups / NPCs / bosses 可以由调用方另行 merge 进去。
 */
export function buildWorldStripLevel(strip: WorldStripLoopDef): BuiltWorldStripLevel {
  const height = strip.height

  // ---- 1. 计算每张图在 chunk 空间的摆放 ----
  // 先算 leftX / rightX / chunkWidth，再回填 ownedEndX（= 下一张图的 leftX）。
  type MutablePlacement = { -readonly [K in keyof WorldStripPlacement]: WorldStripPlacement[K] }
  const placements: MutablePlacement[] = []
  let cursor = 0
  for (let i = 0; i < strip.images.length; i++) {
    const img = strip.images[i]
    const leftX = cursor
    placements.push({
      imageIdx: i,
      textureKey: img.textureKey,
      width: img.width,
      leftX,
      rightX: leftX + img.width,
      ownedStartX: leftX,
      ownedEndX: 0, // 回填
    })
    cursor += img.width - img.overlapNext
  }
  const chunkWidth = cursor
  for (let i = 0; i < placements.length; i++) {
    placements[i].ownedEndX = i + 1 < placements.length ? placements[i + 1].leftX : chunkWidth
  }

  // ---- 2. 地面段 → invisible platform segments ----
  const platformSegments: PlatformSegmentDef[] = []
  for (let i = 0; i < strip.images.length; i++) {
    const img = strip.images[i]
    const p = placements[i]

    for (const sec of img.sections) {
      if (sec.endX <= sec.startX) continue
      if (sec.groundHeight <= 0) continue

      // section 在本图局部坐标 → chunk 坐标
      const secStart = p.leftX + sec.startX
      const secEnd = p.leftX + sec.endX

      // 裁剪到本图所有权区间（落在下一张图覆盖区域内的部分视觉上也不归本图管）
      const startX = Math.max(secStart, p.ownedStartX)
      const endX = Math.min(secEnd, p.ownedEndX)
      if (endX <= startX) continue

      const width = endX - startX
      const topY = height - sec.groundHeight
      platformSegments.push({
        type: 'platform',
        x: startX,
        y: topY,
        width,
        height: sec.groundHeight,
        invisible: true,
      })
    }
  }

  // ---- 3. 每张图起点放一个 checkpoint（loop 模式下每 chunk 复制 → 永久保留） ----
  const checkpoints: CheckpointSegmentDef[] = []
  for (let i = 0; i < strip.images.length; i++) {
    const img = strip.images[i]
    const p = placements[i]
    const groundH = findGroundHeightAt(img, SPAWN_PAD_X) ?? fallbackGroundHeight(img) ?? 80
    const topY = height - groundH
    checkpoints.push({
      type: 'checkpoint',
      id: `strip-img-${i}`,
      // 往图内偏移一点，避开接缝；y 是 checkpoint 自身中心位置（略高于地面上沿）
      x: p.leftX + SPAWN_PAD_X,
      y: topY - 24,
      // spawnY 让玩家脚底落在地面上沿附近（Player sprite 高 48，origin 0.5 → 中心往上抬 24）
      spawnY: topY - 24,
    })
  }

  // ---- 4. 玩家初始 spawn ----
  const firstImg = strip.images[0]
  const firstGroundH = findGroundHeightAt(firstImg, SPAWN_PAD_X) ?? fallbackGroundHeight(firstImg) ?? 80
  const defaultSpawn = {
    x: SPAWN_PAD_X,
    // 脚底略高于地面上沿 → 让 gravity 把玩家压稳到静态体上
    y: height - firstGroundH - 50,
  }

  const segments: SegmentDef[] = [
    ...platformSegments,
    ...checkpoints,
    // 作者写的额外 segments（boss-trigger / pickup / NPC / level-exit…）。
    // 坐标是 chunk 空间；loop 语义由 LevelRunner 的 segment-type 分派负责：
    //   - boss-trigger / pickup / npc / level-exit 都是一次性（firedBossTriggers /
    //     pickup disable / seenNpcs），loop 时不重复触发，符合预期。
    //   - 额外 checkpoint 会被当作 template，每 chunk 复制一份。
    ...(strip.extraSegments ?? []),
  ]

  const level: LevelDef = {
    id: strip.id,
    width: chunkWidth,
    height,
    biome: strip.biome ?? BIOME_IDS.GRASS,
    loop: true,
    chunkWidth,
    scroll: strip.scroll ?? { mode: 'auto-right' },
    spawn: strip.spawn ?? defaultSpawn,
    // 无 parallax：整条世界由 WorldStripSystem 的 image 自己构成。
    background: [],
    foreground: [],
    segments,
  }

  return { level, strip, placements, chunkWidth }
}

function findGroundHeightAt(img: WorldStripImageDef, localX: number): number | null {
  for (const sec of img.sections) {
    if (localX >= sec.startX && localX < sec.endX) return sec.groundHeight
  }
  return null
}

/** 找不到覆盖 localX 的 section 时，用第一个 section 的高度兜底 */
function fallbackGroundHeight(img: WorldStripImageDef): number | null {
  return img.sections[0]?.groundHeight ?? null
}

// =============================================================================
// Exports
// =============================================================================

/** 演示用的 world-strip loop（原始描述数据，builder 输入）。 */
export const WORLD_STRIP_DEMO_DEF: WorldStripLoopDef = WORLD_STRIP_DEMO

/** 编译后的演示关卡 + placement 元数据。GameplayScene 查询这个 */
export const WORLD_STRIP_DEMO_BUILD: BuiltWorldStripLevel = buildWorldStripLevel(WORLD_STRIP_DEMO)

/** LevelDef 别名，方便像其它关卡一样 import 进 LEVEL_REGISTRY。 */
export const LEVEL_WORLD_STRIP_DEMO: LevelDef = WORLD_STRIP_DEMO_BUILD.level

/** 按 levelId 索引的 strip 关卡；GameplayScene 据此决定是否挂 WorldStripSystem。 */
export const WORLD_STRIP_LEVELS: Readonly<Record<string, BuiltWorldStripLevel>> = {
  [WORLD_STRIP_DEMO_BUILD.level.id]: WORLD_STRIP_DEMO_BUILD,
}
