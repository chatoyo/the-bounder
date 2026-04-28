/**
 * DialogueBridge —— NPC 实例化 + 玩家邻近探测 + 对话自动 / 显式触发 +
 * dialogue-command 的回调路由（grant-skill / equip-skill / heal / set-flag）。
 *
 * 拆出来的原因：scene 里这块状态独立（npcs Map、currentNpcInRange、seenNpcs）
 * 但散在 create / update / inputAction / handleDialogueCommand 四个地方。
 *
 * 职责边界：
 *   - 不管 phase 切换的具体动作 —— 调用方传一个 transition 函数进来。
 *   - 不管 dialogue-command 里 'set-flag' 的具体语义 —— 直接 set 到 scene.data，
 *     和原实现一致。
 */
import * as Phaser from 'phaser'
import { ACTION_IDS, PHASE_IDS } from '@/contents/constants'
import { DIALOGUE_REGISTRY } from '@/contents/data/dialogues'
import { NpcEntity } from '@/contents/entities/npc/npc-entity'
import { Player } from '@/contents/entities/player/player'
import { LevelRunner } from '@/contents/systems/level-runner'
import { PhaseController } from '@/contents/systems/phase-controller'
import { SkillManager } from '@/contents/systems/skill-manager'
import type { ActionId, DialogueCommand, DialogueDef } from '@/contents/types'

export interface DialogueBridgeDeps {
  readonly scene: Phaser.Scene
  readonly player: Player
  readonly levelRunner: LevelRunner
  readonly phaseController: PhaseController
  readonly skillManager: SkillManager
}

export class DialogueBridge {
  /** 已物化的 NPC 实体（按 id 反查） */
  private readonly npcs = new Map<string, NpcEntity>()
  /** 玩家当前站在哪个 NPC 的交互区内 */
  private currentNpcInRange: NpcEntity | null = null
  /**
   * 本次 scene 生命周期内已触发过对话的 NPC id 集合。auto-scroll 关卡里玩家
   * 停不下来，按 E 的窗口极短；进 zone 即开讲，本集合保证一次 scene 只触发一次。
   */
  private readonly seenNpcs = new Set<string>()

  private readonly deps: DialogueBridgeDeps

  constructor(deps: DialogueBridgeDeps) {
    this.deps = deps
    // 物化所有 NPC + 挂玩家进入 zone 的 overlap
    deps.levelRunner.forEachNpc((def) => {
      const npc = new NpcEntity(deps.scene, def)
      this.npcs.set(def.id, npc)
      deps.scene.physics.add.overlap(deps.player.sprite, npc.zone, () => {
        if (this.currentNpcInRange !== npc) {
          this.currentNpcInRange?.setHighlighted(false)
          this.currentNpcInRange = npc
          npc.setHighlighted(true)
        }
        this.maybeAutoStart(npc)
      })
    })
  }

  /**
   * 每帧调用：玩家离开 NPC zone 后清掉 currentNpcInRange（zone exit 自身不可靠，
   * 这里手动距离判定兜底）。
   */
  tick(): void {
    const npc = this.currentNpcInRange
    if (!npc) return
    const dx = Math.abs(this.deps.player.sprite.x - npc.sprite.x)
    const dy = Math.abs(this.deps.player.sprite.y - npc.sprite.y)
    if (dx > 48 || dy > 60) {
      npc.setHighlighted(false)
      this.currentNpcInRange = null
    }
  }

  /** 玩家按 E（INTERACT）—— 仅 running phase 下尝试开口 */
  onInputAction = (action: ActionId, phase: 'down' | 'up'): void => {
    if (phase !== 'down') return
    if (action !== ACTION_IDS.INTERACT) return
    if (this.deps.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return
    const npc = this.currentNpcInRange
    if (!npc) return
    this.startFor(npc)
  }

  /** Dialogue 节点 commands → 副作用（grant/equip skill, set-flag, heal） */
  handleCommand = (cmd: DialogueCommand): void => {
    const { skillManager, scene } = this.deps
    switch (cmd.type) {
      case 'grant-skill':
        skillManager.unlock(cmd.id)
        break
      case 'equip-skill':
        skillManager.unlock(cmd.id)
        skillManager.equip(cmd.id)
        break
      case 'heal':
        // Player 暂未暴露 heal；jam 里先忽略，避免改 API 影响架构层。
        break
      case 'set-flag':
        scene.data.set(`flag:${cmd.key}`, cmd.value)
        break
    }
  }

  destroy(): void {
    for (const npc of this.npcs.values()) npc.destroy()
    this.npcs.clear()
    this.currentNpcInRange = null
    this.seenNpcs.clear()
  }

  // ---------------------------------------------------------------------------
  // 内部
  // ---------------------------------------------------------------------------

  /** Zone overlap 自动入话 —— 只在 running phase + 没触发过的 NPC 生效 */
  private maybeAutoStart(npc: NpcEntity): void {
    if (this.deps.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return
    if (this.seenNpcs.has(npc.id)) return
    this.startFor(npc)
  }

  private startFor(npc: NpcEntity): void {
    const def: DialogueDef | undefined = DIALOGUE_REGISTRY[npc.dialogueId]
    if (!def) {
      console.warn(`[DialogueBridge] NPC ${npc.id} 指向未知对话 ${npc.dialogueId}`)
      return
    }
    this.seenNpcs.add(npc.id)
    this.deps.phaseController.transition(PHASE_IDS.DIALOGUE, def)
  }
}
