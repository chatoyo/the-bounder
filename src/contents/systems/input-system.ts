/**
 * InputSystem —— 原始按键 → 语义 Action 的翻译层。
 *
 * 为什么要这层：capability 不应该知道"玩家按的是空格还是 W"，只知道"按了 JUMP"。
 * 这样键位可重绑、手柄可接入、PhaseController 可一键屏蔽（masking）。
 *
 * 用法：
 *   const input = new InputSystem(scene)
 *   input.bindDefaults()
 *   input.update(time, delta)         // 每帧调
 *   input.isDown('move-left')         // 连续状态查询（Move capability 用）
 *   input.on(listener)                // 离散事件订阅（Jump / Shoot capability 用）
 *   input.setMask(new Set(['interact']))  // 只放 interact 通过，其他被吞
 */

import * as Phaser from 'phaser'
import { ACTION_IDS } from '@/contents/constants'
import type { ActionId } from '@/contents/types'

type Phase = 'down' | 'up'
type ActionHandler = (action: ActionId, phase: Phase) => void

const KeyCodes = Phaser.Input.Keyboard.KeyCodes

/** 默认键位：action → 可触发它的按键码（多个等价键盘键） */
const DEFAULT_BINDINGS: Readonly<Record<ActionId, readonly number[]>> = {
  [ACTION_IDS.MOVE_LEFT]: [KeyCodes.A, KeyCodes.LEFT],
  [ACTION_IDS.MOVE_RIGHT]: [KeyCodes.D, KeyCodes.RIGHT],
  // MOVE_UP / MOVE_DOWN 只在飞行模式下用；平时和 JUMP 共用 W/UP 没问题
  // ——JUMP 是边沿事件，MOVE_UP 是连续查询，互不影响。
  [ACTION_IDS.MOVE_UP]: [KeyCodes.W, KeyCodes.UP],
  [ACTION_IDS.MOVE_DOWN]: [KeyCodes.S, KeyCodes.DOWN],
  [ACTION_IDS.JUMP]: [KeyCodes.SPACE, KeyCodes.W, KeyCodes.UP],
  [ACTION_IDS.SHOOT]: [KeyCodes.J],
  [ACTION_IDS.INTERACT]: [KeyCodes.E],
  [ACTION_IDS.SKILL_2]: [KeyCodes.K],
  [ACTION_IDS.SKILL_3]: [KeyCodes.L],
  // 对话 UI 按键（DialogueRunner 侦听）
  [ACTION_IDS.ADVANCE]: [KeyCodes.E, KeyCodes.ENTER, KeyCodes.SPACE],
  [ACTION_IDS.CHOICE_1]: [KeyCodes.ONE],
  [ACTION_IDS.CHOICE_2]: [KeyCodes.TWO],
}

export class InputSystem {
  private scene: Phaser.Scene

  /** action → 绑定到它的所有 Key 对象 */
  private keysByAction = new Map<ActionId, Phaser.Input.Keyboard.Key[]>()

  /** 上一帧每个 action 的 isDown 状态，用于检测 just-pressed / just-released */
  private prevDown = new Map<ActionId, boolean>()

  private handlers = new Set<ActionHandler>()

  /** 若非 null，则只有 mask 中的 action 会触发事件与 isDown 结果 */
  private mask: Set<ActionId> | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  bindDefaults(): void {
    const kb = this.scene.input.keyboard
    if (!kb) {
      // 非常规运行环境（SSR / 无键盘）—— 直接返回，update() 会变成 no-op
      return
    }

    for (const [actionId, codes] of Object.entries(DEFAULT_BINDINGS) as [
      ActionId,
      readonly number[],
    ][]) {
      const keys = codes.map((code) => kb.addKey(code))
      this.keysByAction.set(actionId, keys)
      this.prevDown.set(actionId, false)
    }
  }

  /** 每帧调用；内部检测边缘触发并派发 onAction 事件 */
  update(_time: number, _delta: number): void {
    for (const [actionId, keys] of this.keysByAction.entries()) {
      const nowDown = this.isBoundDown(keys)
      const wasDown = this.prevDown.get(actionId) ?? false

      // mask 在事件派发层生效；prevDown 仍按真实按键状态更新，避免 mask 切换时抖动
      if (!wasDown && nowDown) this.dispatch(actionId, 'down')
      if (wasDown && !nowDown) this.dispatch(actionId, 'up')

      this.prevDown.set(actionId, nowDown)
    }
  }

  /** 连续查询 —— MoveCapability 用 */
  isDown(action: ActionId): boolean {
    if (this.mask && !this.mask.has(action)) return false
    const keys = this.keysByAction.get(action)
    return keys ? this.isBoundDown(keys) : false
  }

  // -------------------------------------------------------------------------
  // 订阅 & mask
  // -------------------------------------------------------------------------

  on(handler: ActionHandler): void {
    this.handlers.add(handler)
  }

  off(handler: ActionHandler): void {
    this.handlers.delete(handler)
  }

  /**
   * 设置 action 白名单。null = 无 mask（所有 action 正常工作）。
   * 传入空 set = 屏蔽全部 action（如 Cutscene）。
   */
  setMask(mask: Set<ActionId> | null): void {
    this.mask = mask
  }

  // -------------------------------------------------------------------------
  // 内部
  // -------------------------------------------------------------------------

  private dispatch(action: ActionId, phase: Phase): void {
    if (this.mask && !this.mask.has(action)) return
    for (const h of this.handlers) {
      h(action, phase)
    }
  }

  private isBoundDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    for (const k of keys) {
      if (k.isDown) return true
    }
    return false
  }

  destroy(): void {
    // 释放 Phaser 按键对象避免泄漏
    const kb = this.scene.input.keyboard
    if (kb) {
      for (const keys of this.keysByAction.values()) {
        for (const k of keys) kb.removeKey(k)
      }
    }
    this.keysByAction.clear()
    this.prevDown.clear()
    this.handlers.clear()
  }
}
