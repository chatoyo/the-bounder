/**
 * PhaseController —— GameplayScene 里的主 FSM。
 *
 * 目标：把"跑酷 → NPC 对话 → 跑酷 → 打 Boss"无缝地表示在**同一个**场景里，
 * 而不是切 Phaser scene。这样玩家、子弹池、关卡状态都活着，过渡像 Hollow Knight。
 *
 * Phase A 只接线两个阶段：
 *   - running   （默认，跑酷 + 射击正常运转）
 *   - respawn   （玩家死亡后短暂冻结 → 送回最近 checkpoint → 回到 running）
 *
 * Phase B+ 在这里加 DialoguePhase / BossPhase / CutscenePhase。
 * 新 phase 实现 Phase 接口即可，controller 代码不变。
 */

import type * as Phaser from 'phaser'
import { EVENT_KEYS } from '@/contents/constants'
import type { PhaseChangedPayload, PhaseId } from '@/contents/types'
import { useEventBus } from '@/runtime'
import type { Player } from '@/contents/entities/player/player'
import type { LevelRunner } from './level-runner'
import type { InputSystem } from './input-system'

const eventBus = useEventBus()

export interface PhaseContext {
  readonly scene: Phaser.Scene
  readonly player: Player
  readonly levelRunner: LevelRunner
  readonly inputSystem: InputSystem
  readonly controller: PhaseController
}

export interface Phase {
  readonly id: PhaseId
  enter(data?: unknown): void
  exit(): void
  update?(time: number, delta: number): void
}

export class PhaseController {
  private phases = new Map<PhaseId, Phase>()
  private currentId: PhaseId | null = null
  private current: Phase | null = null

  register(phase: Phase): void {
    this.phases.set(phase.id, phase)
  }

  transition(id: PhaseId, data?: unknown): void {
    const next = this.phases.get(id)
    if (!next) {
      console.warn(`[PhaseController] 未注册的 phase: ${id}`)
      return
    }
    const from = this.currentId
    this.current?.exit()
    this.current = next
    this.currentId = id
    next.enter(data)
    eventBus.emit(EVENT_KEYS.PHASE_CHANGED, { from, to: id } satisfies PhaseChangedPayload)
  }

  update(time: number, delta: number): void {
    this.current?.update?.(time, delta)
  }

  getCurrentId(): PhaseId | null {
    return this.currentId
  }

  destroy(): void {
    this.current?.exit()
    this.current = null
    this.currentId = null
    this.phases.clear()
  }
}

// ---------------------------------------------------------------------------
// 具体 phase 实现 —— 写在同文件方便读；若以后单 phase 膨胀超过 100 行，再拆。
// ---------------------------------------------------------------------------

/**
 * RunningPhase —— 默认游玩状态。physics 正常跑、input mask 开放。
 * 故意做得"透明"：它不主动做任何事，所有玩法逻辑散在 capability / scene update 里。
 */
export class RunningPhase implements Phase {
  readonly id: PhaseId = 'running'
  private ctx: PhaseContext

  constructor(ctx: PhaseContext) {
    this.ctx = ctx
  }

  enter(): void {
    this.ctx.scene.physics.world.resume()
    this.ctx.inputSystem.setMask(null)
  }

  exit(): void {
    // 交给下一个 phase 决定要不要暂停 physics / 换 mask
  }
}

/**
 * RespawnPhase —— 死亡 → 短暂黑屏 / 冻结 → 送回最近 checkpoint。
 *
 * 关键点：physics.world.pause() 会连子弹一起冻住，起到"死亡定格"的效果；
 * respawn 完才 resume。input 被屏蔽以免玩家按键残影传进新身体。
 */
export class RespawnPhase implements Phase {
  readonly id: PhaseId = 'respawn'

  private elapsed = 0
  /** 冻结时长（毫秒） */
  private static readonly FREEZE_MS = 550

  private ctx: PhaseContext

  constructor(ctx: PhaseContext) {
    this.ctx = ctx
  }

  enter(): void {
    this.elapsed = 0
    this.ctx.scene.physics.world.pause()
    // 彻底屏蔽输入，避免 respawn 瞬间仍在按左右
    this.ctx.inputSystem.setMask(new Set())
    this.ctx.scene.cameras.main.flash(220, 255, 80, 80)
  }

  exit(): void {
    // 解冻 + 放开输入由下个 phase (running) 的 enter 负责
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta
    if (this.elapsed < RespawnPhase.FREEZE_MS) return

    // 把玩家送回最近 checkpoint，重回 running
    const spawn = this.ctx.levelRunner.getActiveSpawn()
    this.ctx.player.respawn(spawn.x, spawn.y, spawn.id)

    // 自动滚动模式下，相机可能已推过 checkpoint；回滚到玩家左侧 200px 防止立即被挤死
    const cam = this.ctx.scene.cameras.main
    const bounds = cam.getBounds()
    const maxScrollX = Math.max(0, bounds.width - cam.width)
    const targetScrollX = Math.min(Math.max(0, spawn.x - 200), maxScrollX)
    cam.setScroll(targetScrollX, cam.scrollY)

    this.ctx.controller.transition('running')
  }
}
