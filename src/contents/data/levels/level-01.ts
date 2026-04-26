/**
 * Level 01 —— "草原晨跑"。
 *
 * 玩法意图：
 *   - 滚动模式 auto-right：相机每秒向右 ~200px 推进（SCROLL_TUNING.DEFAULT_SPEED），
 *     视觉上世界从右向左流过屏幕。玩家必须不断右侧/上方跳跃避障。
 *   - **水平无限循环（loop: true）**：3600px 的关卡块随相机推进无限重复；
 *     LevelRunner 把 platforms / hazards / checkpoints 滑动窗口式地前后生成。
 *     checkpoint 在每个 chunk 里得到独立的 `@${k}` id，所以跑得再远也一直有
 *     respawn 点。pickup、NPC 只在原始位置出现一次。
 *   - 二段跳默认开启；关卡前段有一颗 flight-orb，拾取后可以 4 方向自由飞行。
 *   - Mid-boss "影之使徒" 在 x=2950 登场 —— 一次性事件（firedBossTriggers 保证），
 *     打完继续无限跑。没有 level-exit：本关永不转场。
 *   - 三层视差：天空（最慢）→ 远山（慢）→ 近山+树（略慢）；midground 为平台/hazard；
 *     前景草叶（~1.35x）强化速度感。
 *
 * 坐标约定（沿用 Phase A）：
 *   - platform/hazard: (x, y) = 左上角，width/height 描述矩形
 *   - checkpoint/pickup/npc/boss-trigger/level-exit: (x, y) = 中心
 */

import { BIOME_IDS, PICKUP_IDS } from '@/contents/constants'
import type { LevelDef } from '@/contents/types'

export const LEVEL_01: LevelDef = {
  id: 'level-01',
  width: 3600,
  height: 600,
  biome: BIOME_IDS.GRASS,
  loop: true,
  scroll: {
    mode: 'auto-right',
    // speed 省略 → 用 SCROLL_TUNING.DEFAULT_SPEED
  },
  background: [
    // 天空：最慢（近乎静止）
    {
      textureKey: 'px-sky-day',
      scrollFactor: 0.1,
      anchor: 'top',
    },
    // 远山：慢
    {
      textureKey: 'px-mountains-far',
      scrollFactor: 0.25,
      y: 200,
      alpha: 0.9,
    },
    // 近山：稍快
    {
      textureKey: 'px-mountains-near',
      scrollFactor: 0.45,
      y: 320,
    },
    // 树林带：接近世界速度但略慢
    {
      textureKey: 'px-trees',
      scrollFactor: 0.75,
      y: 440,
    },
  ],
  foreground: [
    // 前景草：超过世界速度 → 强化"跑动感"
    {
      textureKey: 'px-fg-grass',
      scrollFactor: 1.35,
      anchor: 'bottom',
    },
  ],
  segments: [
    // ----------------- 地面 -----------------
    // 前段连续地面（玩家不会一开始就摔死）
    { type: 'platform', x: 0, y: 560, width: 800, height: 40 },
    // 一个小坑考察 jump
    { type: 'platform', x: 900, y: 560, width: 500, height: 40 },
    // 大段地面
    { type: 'platform', x: 1500, y: 560, width: 900, height: 40 },
    // 二段跳才过得去的大坑
    { type: 'platform', x: 2600, y: 560, width: 1000, height: 40 },

    // ----------------- 浮空踏板 -----------------
    { type: 'platform', x: 300, y: 460, width: 120, height: 16 },
    { type: 'platform', x: 520, y: 380, width: 120, height: 16 },
    { type: 'platform', x: 780, y: 440, width: 120, height: 16 },

    { type: 'platform', x: 1050, y: 460, width: 90, height: 16 },
    { type: 'platform', x: 1220, y: 400, width: 90, height: 16 },
    { type: 'platform', x: 1400, y: 460, width: 100, height: 16 },

    { type: 'platform', x: 1700, y: 420, width: 140, height: 16 },
    { type: 'platform', x: 1920, y: 340, width: 120, height: 16 },
    { type: 'platform', x: 2150, y: 420, width: 140, height: 16 },

    // 大坑上的两块踏板：飞行前，需要连跳 + 二段跳
    { type: 'platform', x: 2420, y: 380, width: 100, height: 16 },

    // 飞行获得后的"天空走廊"（飞过去更顺）
    { type: 'platform', x: 2850, y: 300, width: 120, height: 16 },
    { type: 'platform', x: 3100, y: 240, width: 120, height: 16 },
    { type: 'platform', x: 3350, y: 300, width: 120, height: 16 },

    // ----------------- 地面尖刺 -----------------
    { type: 'hazard', x: 650, y: 544, width: 80, height: 16 },
    { type: 'hazard', x: 1100, y: 544, width: 80, height: 16 },
    { type: 'hazard', x: 1800, y: 544, width: 80, height: 16 },
    { type: 'hazard', x: 2150, y: 544, width: 60, height: 16 },
    { type: 'hazard', x: 2900, y: 544, width: 120, height: 16 },

    // ----------------- 检查点（稀疏 2 点，每 chunk 各自复制一份） -----------------
    // loop 模式下 LevelRunner 会把它们作为 "周期模板"，在 chunk k 生成 `@${k}` 变体，
    // 所以真正的可用 respawn 是 start@0 / pre-boss@0 / start@1 / pre-boss@1 ...
    // 从纯模板角度，本关卡有 2 个 spawn 点，间隔 2750 像素（~13 秒）。
    { type: 'checkpoint', id: 'start', x: 100, y: 536 },
    { type: 'checkpoint', id: 'pre-boss', x: 2850, y: 536 },

    // ----------------- NPC: 紫袍老人（开场对话 + 可选赠予飞行） -----------------
    {
      type: 'npc',
      id: 'sage-intro',
      x: 220,
      y: 528,
      dialogueId: 'npc-sage',
      sprite: 'sage',
    },

    // ----------------- 飞行道具（保底：不走 sage 选项也能捡到） -----------------
    {
      type: 'pickup',
      id: 'flight-orb-1',
      kind: PICKUP_IDS.FLIGHT_ORB,
      x: 2250,
      y: 360,
    },

    // ----------------- Boss trigger —— "影之使徒"，在 x=2950 触发 -----------------
    // BossPhase 不再锁相机：auto-scroll 继续，boss 从屏幕右侧滑入并跟随视口。
    // 击破后 2s → BOSS_VICTORY 结算面板 → LevelTransitionOverlay → 载入 `nextLevelId`。
    // firedBossTriggers 保证本次关卡生命周期内只触发一次。
    {
      type: 'boss-trigger',
      id: 'shadow-trigger',
      x: 2950,
      bossId: 'boss-shadow',
      nextLevelId: 'level-02',
    },
  ],
}
