/**
 * Capability —— 玩家能力的最小抽象单元。
 *
 * 一个 capability 就是"玩家能做的一件事"：走路、跳、射击、冲刺、二段跳……
 * 之间 **不互相引用**，只通过读写 Player 共享状态 + 监听 InputSystem 的语义
 * Action 做协调。"不能在冲刺中射击" 这类规则，用 Player 上的 flag 体现，
 * 而不是在冲刺 capability 里 import 射击 capability。
 *
 * 为什么要这层抽象：
 *   - 添加新技能 = 新增一个 capability 文件 + 注册 id，**不触碰 Player 本体**。
 *   - Boss 改技能组 = SkillManager.suppress(id)，清理对应 capability。
 *   - 可测试：单文件、输入与输出都是 Player 状态，单测友好。
 */

import type * as Phaser from 'phaser'
import type { ActionId, CapabilityId } from '@/contents/types'
import type { Player } from '../player'

/** capability 拿到的场景上下文；从 Player 构造时传入，避免每个 capability 自己找 scene */
export interface CapabilityContext {
  readonly player: Player
  readonly scene: Phaser.Scene
}

export interface Capability {
  readonly id: CapabilityId

  /** 挂到 Player 时调用，拿到 scene + player 引用 */
  attach(ctx: CapabilityContext): void

  /** 从 Player 拆下时清理（定时器、对象池引用等） */
  detach(): void

  /** 每帧触发（如果该 capability 有连续逻辑：持续按着走路 / 检测 coyote） */
  update?(time: number, delta: number): void

  /**
   * 语义动作事件：按下 / 松开。由 InputSystem 派发，同一帧同一动作最多一次。
   * 离散事件（跳、射击、交互）走这里；连续状态（走路）走 update() 读 input.isDown()。
   */
  onAction?(action: ActionId, phase: 'down' | 'up'): void
}
