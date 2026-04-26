/**
 * Level：world-strip boss 场景 —— 单张 `public/pics/boss.png` 背景 + 登场即 boss 战。
 *
 * 职责：
 *   - 作为 world-strip-demo 的"终点站"。demo 关卡跑完 7 张图 → `level-exit (to-boss)` →
 *     scene.restart 进入本关。玩家出生后片刻即触发 BossPhase。
 *   - 单图布局（boss.png，原生 1568×672）；**`loop: true`** → 世界图按 chunk 无限平铺、
 *     相机 auto-scroll 永不 clamp。BossPhase 的设计前提就是"世界继续流动、boss 每帧
 *     跟随相机右缘"（见 boss-phase.ts + boss-entity.ts）；若 loop=false 相机到达世界
 *     右端就停 → `BossEntity.update` 算出的 baseX 停住 → boss 也停 → 视觉上整个战斗
 *     变成静止的"截图"。让底图循环（同一张 boss.png 反复平铺）是目前最轻的修复 ——
 *     视觉上"boss 竞技场一直在延伸"，不需要新美术。
 *   - boss-trigger 的 `nextLevelId` 留空 —— BOSS_DEFEATED → `onBossPhaseCleared` 仍然会
 *     把玩家锁进"结算态" + 发 BOSS_VICTORY；但没有下一关可跳 → 不调 completeLevel，
 *     BossVictoryOverlay 常驻（= 游戏终章）。
 *
 * 复活行为：
 *   - 默认 spawn 由 buildWorldStripLevel 放在第一张图的 (SPAWN_PAD_X=400, ground)；
 *     与 boss-trigger 的 x=520 不冲突（400 < 520），玩家死后能回 checkpoint 重试。
 *   - loop=true 下每 chunk 都会复制一份 `strip-img-0@k` checkpoint。玩家在 boss 战
 *     中被世界推到 chunk 1+ 时会激活后续 checkpoint；但 MoveCapability 的 idle drift
 *     = cruise × 0.8 < cruise 本身 → 默认玩家相对世界是在缓慢后退，不会主动跑进
 *     chunk 1 激活其 checkpoint，实战里活跃 checkpoint 始终 = `strip-img-0@0`（x=400）。
 *   - 为了让死亡重试能再触发 boss，`BossPhase.exit` 里若 `boss?.isAlive()` 会清一次
 *     `firedBossTriggers`，玩家 respawn 后走过 trigger 时 boss 会重新登场。
 *
 * 接入流程（作者视角）：
 *   - `LEVEL_REGISTRY`（gameplay-scene.ts）按 id 收录；
 *   - `WORLD_STRIP_LEVELS`（world-strip-demo.ts）收录同一个 id → BuiltWorldStripLevel；
 *   - `BootScene.preload` 循环所有 strip 图片时会顺带 load 本关的 boss.png。
 */

import { BIOME_IDS } from '@/contents/constants'
import type {
  BuiltWorldStripLevel,
  LevelDef,
  WorldStripLoopDef,
} from '@/contents/types'
import { buildWorldStripLevel } from './world-strip-demo'

/**
 * 数值约定：
 *   - boss.png 原生 1568×672；WorldStripSystem 会 `setDisplaySize(1568, 672)` 铺在
 *     每个 chunk 上（loop=true → 同一张图按 chunkWidth=1568 反复平铺）。
 *   - 地面段厚度取 126（和 demo 里 world-strip-final 一致），玩家脚底 y = 672-126 = 546。
 *   - scroll.speed 略低于 demo（160 vs 180）—— boss 战要更从容的节奏。
 *   - `loop: true`：BossPhase 设计的前提是"世界继续流动、boss 跟随相机右缘"；单图
 *     非 loop 下相机会被世界右边界 clamp（1568-800=768px 行程，约 4.8s 后停止），
 *     导致 `BossEntity.update` 算出的 baseX 冻结，整个战斗变成静止画面。
 *     loop=true 让 boss.png 像 tilemap 一样循环，相机永不 clamp。
 *   - 不自定义 spawn：`buildWorldStripLevel` 会为这张图在本地 x=SPAWN_PAD_X=400 生成
 *     一个 checkpoint（loop 下 id = 'strip-img-0@0'），并把它设成 activeCheckpoint。
 *     `LevelRunner.getActiveSpawn` 优先读 activeCheckpoint → 就算 WorldStripLoopDef.spawn
 *     被覆盖也不会生效，所以这里干脆跟着走，spawn = (400, 522)。
 *   - boss-trigger 在 x=520：与 spawn 相差 120px。玩家 idle-drift (128 px/s) 约 0.9s 走到。
 *     相机推进更快 (160 px/s)，t=0.9s 时 scrollX ≈ 144；player.screen_x = 520 - 144 = 376 —
 *     还在视口中段，远离左缘 crush 区。boss-trigger 本身是单次触发（不按 chunk 复制），
 *     loop 下"走过 x=520 一次"的语义不变。
 *   - boss-trigger.nextLevelId 留空 → 击破后 BossVictoryOverlay 常驻作为终章。
 */
const WORLD_STRIP_BOSS: WorldStripLoopDef = {
  id: 'world-strip-boss',
  height: 672,
  biome: BIOME_IDS.SPACE,
  // 详见上方注释 & 文件顶部 JSDoc：BossPhase 要求世界不停，loop=true 让相机永远能向右推进。
  loop: true,
  scroll: { mode: 'auto-right', speed: 160 },
  images: [
    {
      textureKey: 'world-strip-boss',
      url: '/pics/boss.png',
      width: 1568,
      overlapNext: 0,
      sections: [{ startX: 0, endX: 1568, groundHeight: 126 }],
    },
  ],
  extraSegments: [
    // 终极 boss：无 nextLevelId → GameplayScene.onBossPhaseCleared 发 BOSS_VICTORY 后
    // 不再 schedule completeLevel，BossVictoryOverlay 常驻展示。
    {
      type: 'boss-trigger',
      id: 'final-boss-trigger',
      x: 520,
      bossId: 'boss-shadow',
    },
  ],
}

// =============================================================================
// Exports
// =============================================================================

/** Boss 场景的原始 strip 描述（给 BootScene.preload 迭代 url 用）。 */
export const WORLD_STRIP_BOSS_DEF: WorldStripLoopDef = WORLD_STRIP_BOSS

/** 编译后的 boss 关卡 + placement 元数据。WorldStripSystem 查询这个。 */
export const WORLD_STRIP_BOSS_BUILD: BuiltWorldStripLevel = buildWorldStripLevel(WORLD_STRIP_BOSS)

/** LevelDef 别名，便于像其它关卡一样 import 进 LEVEL_REGISTRY。 */
export const LEVEL_WORLD_STRIP_BOSS: LevelDef = WORLD_STRIP_BOSS_BUILD.level
