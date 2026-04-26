/**
 * Level：world-strip 线性演示 —— 用 `public/pics/1.png` / `2.png` / `3.png` / `4.jpg`
 * 拼接；跑完 7 张图后把玩家扔进 boss 专用场景（world-strip-boss）。
 *
 * 数据模型：
 *   - `WorldStripLoopDef.images`：一串变宽定高的底图。
 *   - `WorldStripImageDef.overlapNext`：本图右边缘被下一张图覆盖的像素数（显示空间）；
 *     chunk 空间中 `image_{i+1}.leftX = image_i.leftX + image_i.width - image_i.overlapNext`。
 *   - `WorldStripImageDef.sections`：本图内的地面轮廓段（显示坐标系内的局部 x + 厚度）。
 *   - `WorldStripImageDef.url`：真实素材的相对 URL（有值时 BootScene 走 load.image）。
 *   - `WorldStripLoopDef.loop=false`（本关）：整条 strip 只跑一次，跑到底后相机被
 *     camera.bounds clamp 在 `chunkWidth - cam.width`，世界"停下来"。玩家继续向前漂
 *     （MoveCapability 的 BASE_FORWARD_RATIO × cruise 始终 > 0），被 screen-bounds
 *     夹到视口右缘 → 触碰下方那个 `to-boss` level-exit → 载入 world-strip-boss。
 *
 * 编译到 LevelDef：
 *   - `buildWorldStripLevel` 把每段 section 翻译成一个 `invisible: true` 的
 *     `PlatformSegmentDef`，放在对应 chunk 位置；`y` = `height - groundHeight`，
 *     `height` = `groundHeight`（矩形从地面上沿一直延伸到图片底边）。
 *   - 落在后一张图 overlap 范围内的 section 会被裁剪 / 丢弃 —— 视觉上也被后图覆盖了，
 *     让后图的 sections 接管那段地面。
 *   - `chunkWidth = 所有 (width - overlapNext) 的和`；loop=false 下 chunkWidth 也就是
 *     `LevelDef.width`（相机 / 物理世界的真实右边界）。
 *   - 每张图的起点各放一个 checkpoint，玩家死后重生到最近触达的那一个。
 *
 * 本关卡数据（真实素材；总 chunkWidth = 8992 像素）：
 *   - img-0 (1.png, 1569×672, overlapNext=460, 3 段阶梯 h=170/150/126)
 *   - img-1 (2.png, 1569×672, overlapNext=550, 平地 h=126)
 *   - img-2 (3.png, 3136×1344→1584×672, overlapNext=0, 平地 h=126)
 *   - img-3 (1.png 重复)
 *   - img-4 (2.png 重复)
 *   - img-5 (3.png 重复)
 *   - img-6 (4.jpg, 3018×1280→1568×672, overlapNext=0, 平地 h=126) ← "最后一张图"
 *
 * Level-exit "to-boss"：放在 chunk x=8950（world-strip-final 境内，最右端附近）。
 * 相机 clamp 后玩家被 screen-bounds 夹到 x≈8971，|8971-8950|=21 < 40（查找半径），
 * findLevelExitAt 命中 → completeLevel('world-strip-boss') → scene.restart 进入 boss 场景。
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
// 循环依赖注意：boss 场景 (world-strip-boss.ts) 反向 import 本文件的 `buildWorldStripLevel`，
// 而且**在它自己的顶层 const 里立即调用**（`export const WORLD_STRIP_BOSS_BUILD = buildWorldStripLevel(...)`）。
// 因此模块初始化顺序是：
//   1. 本文件顶部执行到下面这行 `import { WORLD_STRIP_BOSS_BUILD } from './world-strip-boss'`
//   2. 暂停本文件，去执行 world-strip-boss.ts
//   3. boss.ts 执行 `buildWorldStripLevel(WORLD_STRIP_BOSS)` —— **此时本文件还没跑完，任何
//      在此行下方的模块级 `const`（SPAWN_PAD_X 曾在这里、以及本文件底部那几个 export const）
//      都还在 TDZ**
//   4. boss.ts 执行完，本文件从 import 后继续跑
// 规则：builder 函数体只能读**函数参数**或**闭包内定义的局部 const**，绝不能读模块级 const；
// 否则立即踩 "Cannot access X before initialization"。下面 `buildWorldStripLevel` 的开头把
// SPAWN_PAD_X 作为函数局部变量定义，就是这个约束的体现。
import { WORLD_STRIP_BOSS_BUILD } from './world-strip-boss'

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
  // 非循环：跑完 7 张图就让相机 clamp，level-exit 接管去 boss 场景。
  loop: false,
  scroll: { mode: 'auto-right', speed: 270 },
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
    // 终点：跑完最后一张图 (world-strip-final, x∈[7424, 8992)) 后，相机 clamp 在
    // x=8192，screen-bounds 把玩家夹到 x≈8971。此 level-exit 在 x=8950, y=540 处，
    // findLevelExitAt(player.x, player.y, 40) 会命中 → completeLevel('world-strip-boss')。
    // 视觉上玩家"被世界停下，但自己继续漂到最右侧，然后场景切到 boss 场景"。
    {
      type: 'level-exit',
      id: 'to-boss',
      x: 8950,
      y: 540,
      nextLevelId: 'world-strip-boss',
    },
  ],
}

// =============================================================================
// Builder：WorldStripLoopDef → LevelDef + placement meta
// =============================================================================

/**
 * 把 WorldStripLoopDef 编译成 LevelDef。
 * 产出的 LevelDef 的 `loop` 跟随 `strip.loop`（缺省 true）：
 *   - loop=true（默认）：segments 里的 platforms/checkpoints 被当作周期模板，
 *     LevelRunner 每 chunk 复制一份；WorldStripSystem 同步滑窗铺图。
 *   - loop=false：整条 strip 只播放一遍，相机到达世界右端即 clamp；适合
 *     "跑到终点 → level-exit → 下一关" 的线性关卡。
 * pickups / NPCs / bosses 可以由调用方另行 merge 进去。
 */
export function buildWorldStripLevel(strip: WorldStripLoopDef): BuiltWorldStripLevel {
  // 每张图片中 checkpoint（= 出生点）相对图片左缘的距离。
  //
  // 取 400 是因为主相机视口是 800×600（GAME_CONFIG.WIDTH）。GameplayScene 的
  // 自动滚动模式会把相机初始化在 `spawn.x - camera.width/2 = 0`，使玩家刚好
  // 落在视口横向正中央；每圈 chunk 的 `strip-img-*@k` checkpoint 也都会位于
  // 本图起点向右 400px 处，给玩家充分的反应距离。
  //
  // **故意放在函数内**而非模块顶层：world-strip-boss.ts 顶层会 import 本模块的
  // `buildWorldStripLevel` 并立即调用（`export const WORLD_STRIP_BOSS_BUILD =
  // buildWorldStripLevel(...)`）；这会在 demo 模块还卡在 boss 的 import（即
  // 本文件顶部 56 行左右）时就执行函数体。若 `SPAWN_PAD_X` 是模块级 const，此
  // 刻它还在 TDZ → `Cannot access 'SPAWN_PAD_X' before initialization`。做成
  // 函数局部变量后每次调用各自初始化，彻底绕开模块初始化顺序。
  const SPAWN_PAD_X = 400

  const height = strip.height
  // default true for backward-compat (demo 原先无 loop 字段也必须 = true)
  const loop = strip.loop !== false

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
    loop,
    chunkWidth,
    scroll: strip.scroll ?? { mode: 'auto-right' },
    spawn: strip.spawn ?? defaultSpawn,
    // 无 parallax：整条世界由 WorldStripSystem 的 image 自己构成。
    background: [],
    foreground: [],
    segments,
  }

  return { level, strip, placements, chunkWidth, loop }
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
  [WORLD_STRIP_BOSS_BUILD.level.id]: WORLD_STRIP_BOSS_BUILD,
}
