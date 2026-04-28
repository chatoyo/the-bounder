/**
 * World-strip 编译器 —— 把作者写的 `WorldStripLoopDef` 编译成 LevelDef + 摆放元数据。
 *
 * 与具体关卡文件解耦：作者在 `world-strip-*.ts` 里只声明数据，统一调用本模块的
 * `buildWorldStripLevel` 得到 `BuiltWorldStripLevel`，再被 `data/levels/index.ts`
 * 收进全局 registry。这样 demo / boss 关卡互不引用，告别旧版 demo↔boss 循环
 * 依赖（旧实现里 `SPAWN_PAD_X` 必须放在函数内躲 TDZ，原因即此）。
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
 * 落在视口横向正中央；每圈 chunk 的 `strip-img-*@k` checkpoint 也都会位于
 * 本图起点向右 400px 处，给玩家充分的反应距离。
 */
const SPAWN_PAD_X = 400

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
  if (strip.loop === false) {
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
