/**
 * "Shadow" —— world-strip-boss / level-02 的终章 boss。Lovecraftian 机械章鱼外观
 * （真素材 `public/sprites/boss/boss.png`；缺失时 BootScene 兜底深红椭圆）。
 *
 * HP 分配：maxHp = 30，BossEntity 按 HP 比例切三阶段（≤2/3 → 阶段 2，≤1/3 → 阶段 3）。
 *   - 阶段 1 (30→20)：基础 3 发散射，节奏宽松
 *   - 阶段 2 (20→10)：散射 + 瞄准射
 *   - 阶段 3 (10→0) ：散射 + 瞄准射 + 环形爆发
 * 玩家在 world-strip-boss 关卡强制飞行 + 持续射击（FIRE_COOLDOWN_MS=220），
 * 纯输出约 30/4.5 ≈ 6.6s 能打完，实际因躲弹会更久；刚好让三阶段都被玩家
 * 体验到一次，又不至于拖沓。
 *
 * sprite 变体：`colossus`
 *   - BossEntity 按 VISUALS_BY_VARIANT['colossus'] 应用 setScale(0.6) + 55%×60%
 *     hitbox，让外围触须只是视觉吓人、实际命中区只盖中央机械身体。
 *   - 悬停 sin 波振幅 32px / 频率 1.3 rad/s（BossEntity.HOVER_* 常量）—— 缓慢、
 *     连续、不跟阶段变化；视觉上"庞然大物缓缓浮沉"。
 */

import type { BossDef } from '@/contents/types'

export const BOSS_SHADOW: BossDef = {
  id: 'boss-shadow',
  displayName: '边界清理程序',
  maxHp: 30,
  spawnX: 3000,
  spawnY: 300,
  sprite: 'colossus',
}
