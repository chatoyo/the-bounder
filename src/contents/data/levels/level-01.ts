/**
 * Level 01 —— "草原晨跑"。
 *
 * 玩法意图：
 *   - 滚动模式 auto-right：相机每秒向右 ~90px 推进（SCROLL_TUNING.DEFAULT_SPEED），
 *     视觉上世界从右向左流过屏幕。玩家必须不断右侧/上方跳跃避障。
 *   - 二段跳默认开启；关卡中段有一颗 flight-orb，拾取后可以 4 方向自由飞行。
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

    // ----------------- 检查点（按 x 排） -----------------
    { type: 'checkpoint', id: 'start', x: 100, y: 536 },
    { type: 'checkpoint', id: 'mid-1', x: 1600, y: 536 },
    { type: 'checkpoint', id: 'mid-2', x: 2450, y: 536 },

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

    // ----------------- 关卡终点 → 进入 level-02 -----------------
    {
      type: 'level-exit',
      id: 'exit',
      x: 3500,
      y: 300,
      nextLevelId: 'level-02',
    },
  ],
}
