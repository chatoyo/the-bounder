/**
 * Level 02 —— "影之洞窟"。
 *
 * 设定：
 *   - biome: space（深紫 + 电路高光地块；搭配夜空 + 飘云的视差）
 *   - auto-right 滚动速度略高（110px/s）
 *   - 玩家进入时已 equip 飞行（由 scene.init.unlockedSkills 携带）
 *   - 中段一位红甲 NPC 警告玩家 boss；过 NPC 后是 boss-trigger → BossPhase
 *   - boss 死后 level-exit 触发 → 循环回 level-01（`nextLevelId: 'level-01'`）
 *
 * 地形思路：因为玩家可以飞，本关可以排更苛刻的竖向障碍（低顶 + 高刺），
 *  强化"没飞行就根本过不去"的体感。
 */

import { BIOME_IDS } from '@/contents/constants'
import type { LevelDef } from '@/contents/types'

export const LEVEL_02: LevelDef = {
  id: 'level-02',
  width: 3800,
  height: 600,
  biome: BIOME_IDS.SPACE,
  scroll: {
    mode: 'auto-right',
    // 比 DEFAULT_SPEED(200) 再快一点，保留 level-02 "更凶险" 的设计意图
    speed: 240,
  },
  background: [
    // 夜空 —— 带星点
    {
      textureKey: 'px-sky-night',
      scrollFactor: 0.1,
      anchor: 'top',
    },
    // 远山
    {
      textureKey: 'px-mountains-far',
      scrollFactor: 0.25,
      y: 240,
      tint: 0x442a6e,
      alpha: 0.85,
    },
    // 近山
    {
      textureKey: 'px-mountains-near',
      scrollFactor: 0.5,
      y: 360,
      tint: 0x5a3fb0,
    },
  ],
  foreground: [
    // 前景飘云 —— 营造"飞在高空"的感觉
    {
      textureKey: 'px-fg-clouds',
      scrollFactor: 1.4,
      y: 480,
      alpha: 0.55,
    },
  ],
  segments: [
    // ----------------- 地面 -----------------
    { type: 'platform', x: 0, y: 560, width: 600, height: 40 },
    { type: 'platform', x: 700, y: 560, width: 500, height: 40 },
    // 中段深沟（没飞行就死）
    { type: 'platform', x: 1300, y: 560, width: 400, height: 40 },
    { type: 'platform', x: 2100, y: 560, width: 600, height: 40 },
    // Boss 竞技场地面
    { type: 'platform', x: 2800, y: 560, width: 1000, height: 40 },

    // ----------------- 低顶（强迫飞行绕过） -----------------
    { type: 'platform', x: 1200, y: 200, width: 400, height: 24 },
    { type: 'platform', x: 1800, y: 180, width: 360, height: 24 },

    // ----------------- 上排悬浮踏板 -----------------
    { type: 'platform', x: 300, y: 420, width: 100, height: 16 },
    { type: 'platform', x: 500, y: 320, width: 100, height: 16 },
    { type: 'platform', x: 800, y: 380, width: 100, height: 16 },
    { type: 'platform', x: 1050, y: 300, width: 100, height: 16 },
    { type: 'platform', x: 1700, y: 340, width: 100, height: 16 },
    { type: 'platform', x: 2000, y: 280, width: 100, height: 16 },
    { type: 'platform', x: 2350, y: 360, width: 100, height: 16 },
    { type: 'platform', x: 2600, y: 260, width: 100, height: 16 },

    // ----------------- 尖刺（飞在顶/底都危险） -----------------
    { type: 'hazard', x: 900, y: 544, width: 80, height: 16 },
    { type: 'hazard', x: 1400, y: 544, width: 180, height: 16 },
    { type: 'hazard', x: 2200, y: 544, width: 120, height: 16 },
    // 天花板尖刺（飞太高也会被扎）
    { type: 'hazard', x: 1250, y: 224, width: 300, height: 16 },
    { type: 'hazard', x: 1830, y: 204, width: 300, height: 16 },

    // ----------------- 检查点 -----------------
    { type: 'checkpoint', id: 'start', x: 100, y: 536 },
    { type: 'checkpoint', id: 'mid', x: 1900, y: 536 },
    { type: 'checkpoint', id: 'boss-gate', x: 2750, y: 536 },

    // ----------------- 中段额外飞行珠（保险：没要 sage 的那枚也能捡到） -----------------
    {
      type: 'pickup',
      id: 'flight-orb-2',
      kind: 'flight-orb',
      x: 800,
      y: 280,
    },
    // 血量补给
    {
      type: 'pickup',
      id: 'hp-crystal-1',
      kind: 'hp-crystal',
      x: 2000,
      y: 220,
    },

    // ----------------- NPC: 红甲战士（boss 战前警告） -----------------
    {
      type: 'npc',
      id: 'warrior-entrance',
      x: 2550,
      y: 528,
      dialogueId: 'npc-warrior',
      sprite: 'warrior',
    },

    // ----------------- Boss trigger -----------------
    {
      type: 'boss-trigger',
      id: 'shadow-trigger',
      x: 2830,
      bossId: 'boss-shadow',
    },

    // ----------------- 关卡终点（boss 死后触发） -----------------
    {
      type: 'level-exit',
      id: 'exit',
      x: 3600,
      y: 300,
      nextLevelId: 'level-01', // 循环回第一关（demo 收尾）
    },
  ],
}
