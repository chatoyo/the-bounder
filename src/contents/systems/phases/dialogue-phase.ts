/**
 * DialoguePhase —— 对话中冻结世界 / 屏蔽战斗输入 / 监听 DIALOGUE_END 自动切回。
 *
 * 行为：
 *   - enter(def): 暂停 physics、屏蔽战斗 action（只放 advance / choice-1 / choice-2 / interact）。
 *   - exit(): 由下一个 phase (running) 负责物理恢复 / 输入恢复；此处只做内部清理。
 *   - 监听 DIALOGUE_END：自动 transition 回 running。
 */

import { ACTION_IDS, EVENT_KEYS, PHASE_IDS } from '@/contents/constants'
import type { ActionId, DialogueDef, PhaseId } from '@/contents/types'
import { useEventBus } from '@/runtime'
import type { Phase, PhaseContext } from '../phase-controller'
import type { DialogueRunner } from '../dialogue-runner'

const eventBus = useEventBus()

const DIALOGUE_MASK: Set<ActionId> = new Set<ActionId>([
  ACTION_IDS.ADVANCE,
  ACTION_IDS.CHOICE_1,
  ACTION_IDS.CHOICE_2,
  ACTION_IDS.INTERACT, // 复用 E 键做 advance 也 OK
])

export class DialoguePhase implements Phase {
  readonly id: PhaseId = PHASE_IDS.DIALOGUE

  private ctx: PhaseContext
  private runner: DialogueRunner

  constructor(ctx: PhaseContext, runner: DialogueRunner) {
    this.ctx = ctx
    this.runner = runner
  }

  enter(data?: unknown): void {
    const def = data as DialogueDef | undefined
    this.ctx.scene.physics.world.pause()
    this.ctx.inputSystem.setMask(DIALOGUE_MASK)

    if (def) {
      this.runner.start(def)
    }

    // 当 runner 结束（玩家看完或主动关掉），自动切回 running
    eventBus.on(EVENT_KEYS.DIALOGUE_END, this.onDialogueEnd)

    // 输入转译：在 mask 范围内把 CHOICE_1/2 / ADVANCE 推给 eventBus（UI 也监听，
    // 双路径都发无害 —— DialogueRunner 会按 id + nodeId 过滤）
    this.ctx.inputSystem.on(this.onInput)
  }

  exit(): void {
    eventBus.off(EVENT_KEYS.DIALOGUE_END, this.onDialogueEnd)
    this.ctx.inputSystem.off(this.onInput)
    // 主动兜底：若 runner 还在跑（罕见：外部强切 phase），关掉它
    if (this.runner.isActive()) this.runner.end()
  }

  private onDialogueEnd = (): void => {
    // runner 发了 DIALOGUE_END → 我们自己切回 running
    if (this.ctx.controller.getCurrentId() === PHASE_IDS.DIALOGUE) {
      this.ctx.controller.transition(PHASE_IDS.RUNNING)
    }
  }

  private onInput = (action: ActionId, phase: 'down' | 'up'): void => {
    if (phase !== 'down') return
    switch (action) {
      case ACTION_IDS.ADVANCE:
      case ACTION_IDS.INTERACT:
        eventBus.emit(EVENT_KEYS.DIALOGUE_ADVANCE)
        break
      case ACTION_IDS.CHOICE_1:
      case ACTION_IDS.CHOICE_2:
        // UI 已经监听了 1/2 键盘直接发 DIALOGUE_CHOICE_SELECTED；
        // 这里不重复派发以避免重复处理（InputSystem 边沿 + 键盘事件同时触发时 runner
        // 会按 nodeId 过滤，但少发一路更清晰）
        break
    }
  }
}
