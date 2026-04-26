/**
 * DialogueRunner —— 跑 `DialogueDef` 树：发 DIALOGUE_* 事件、处理选项、执行命令。
 *
 * 职责边界：
 *   - 不知道 Vue 的存在；Vue 侧靠订阅 DIALOGUE_* 事件被动渲染。
 *   - 不负责暂停游戏；那是 DialoguePhase 的事（mask input + 在 enter 里 pause 物理）。
 *   - 不内置 "grant-skill" 的具体实现；通过构造器注入的 commandHandler 回调生效。
 *     这样 GameplayScene 依然是唯一"碰 SkillManager / Player"的文件。
 *
 * 状态机：
 *   idle → start(def) → current node → (advance | choose) → next node → ... → end
 *
 * 事件：
 *   DIALOGUE_START       Phaser → Vue    打开 UI
 *   DIALOGUE_NODE        Phaser → Vue    节点切换（speaker + text + choices?）
 *   DIALOGUE_ADVANCE     Vue → Phaser    玩家按推进键
 *   DIALOGUE_CHOICE_SELECTED Vue → Phaser 玩家选了某个 choice
 *   DIALOGUE_END         Phaser → Vue    关闭 UI
 */

import { EVENT_KEYS } from '@/contents/constants'
import type {
  DialogueChoiceSelectedPayload,
  DialogueCommand,
  DialogueDef,
  DialogueEndPayload,
  DialogueNode,
  DialogueNodePayload,
  DialogueStartPayload,
} from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

export type DialogueCommandHandler = (cmd: DialogueCommand) => void

export class DialogueRunner {
  private def: DialogueDef | null = null
  private currentNodeId: string | null = null
  private active = false

  private commandHandler: DialogueCommandHandler

  constructor(commandHandler: DialogueCommandHandler) {
    this.commandHandler = commandHandler
  }

  /** 开始播放一段对话。若已有对话在跑，会直接替换（罕见；一般上层 Phase 会守门） */
  start(def: DialogueDef): void {
    this.def = def
    this.active = true
    const startNode = def.nodes[def.startNodeId]
    if (!startNode) {
      console.warn(`[DialogueRunner] ${def.id} 缺失 startNode ${def.startNodeId}`)
      this.end()
      return
    }
    this.currentNodeId = startNode.id

    eventBus.emit(EVENT_KEYS.DIALOGUE_START, {
      dialogueId: def.id,
      nodeId: startNode.id,
      speaker: startNode.speaker,
      text: startNode.text,
    } satisfies DialogueStartPayload)

    this.runEnterCommands(startNode)
    this.emitNode(startNode)

    // 挂监听（active=true 才处理）
    eventBus.on(EVENT_KEYS.DIALOGUE_ADVANCE, this.onAdvance)
    eventBus.on(EVENT_KEYS.DIALOGUE_CHOICE_SELECTED, this.onChoice)
  }

  /** 主动结束（玩家关掉 / Phase 切走都可能触发） */
  end(): void {
    if (!this.active) return
    const defId = this.def?.id ?? ''
    this.active = false
    this.currentNodeId = null
    this.def = null

    eventBus.off(EVENT_KEYS.DIALOGUE_ADVANCE, this.onAdvance)
    eventBus.off(EVENT_KEYS.DIALOGUE_CHOICE_SELECTED, this.onChoice)

    eventBus.emit(EVENT_KEYS.DIALOGUE_END, {
      dialogueId: defId,
    } satisfies DialogueEndPayload)
  }

  isActive(): boolean {
    return this.active
  }

  destroy(): void {
    if (this.active) this.end()
  }

  // ---- 内部：节点推进 / choice 派发 / 命令执行 ----

  private onAdvance = (): void => {
    if (!this.active || !this.def || !this.currentNodeId) return
    const node = this.def.nodes[this.currentNodeId]
    if (!node) return
    // 有 choices 的节点必须选（忽略 advance）；无 choices 时按 node.next 走
    if (node.choices && node.choices.length > 0) return
    this.gotoOrEnd(node.next ?? null)
  }

  private onChoice = (payload: unknown): void => {
    if (!this.active || !this.def || !this.currentNodeId) return
    const p = payload as DialogueChoiceSelectedPayload
    if (p.dialogueId !== this.def.id) return
    if (p.nodeId !== this.currentNodeId) return
    const node = this.def.nodes[this.currentNodeId]
    const choice = node?.choices?.[p.choiceIndex]
    if (!choice) return

    // 应用 choice.commands 然后跳转
    if (choice.commands) {
      for (const cmd of choice.commands) this.commandHandler(cmd)
    }
    this.gotoOrEnd(choice.next)
  }

  private gotoOrEnd(nextId: string | null): void {
    if (!this.def) return this.end()
    if (nextId == null) return this.end()
    const next = this.def.nodes[nextId]
    if (!next) {
      console.warn(`[DialogueRunner] ${this.def.id} 找不到 node ${nextId}`)
      return this.end()
    }
    this.currentNodeId = next.id
    this.runEnterCommands(next)
    this.emitNode(next)
  }

  private runEnterCommands(node: DialogueNode): void {
    if (!node.onEnter) return
    for (const cmd of node.onEnter) this.commandHandler(cmd)
  }

  private emitNode(node: DialogueNode): void {
    if (!this.def) return
    const payload: DialogueNodePayload = {
      dialogueId: this.def.id,
      nodeId: node.id,
      speaker: node.speaker,
      text: node.text,
      choices: node.choices?.map((c, i) => ({ label: c.label, index: i })),
    }
    eventBus.emit(EVENT_KEYS.DIALOGUE_NODE, payload)
  }
}
