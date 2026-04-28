/**
 * LevelCompletion —— 关卡通关 / boss 击破 → 结算 → 转场的整段状态机。
 *
 * 拆出来的原因：scene 里这块状态最长（结算锁、boss 击破等待、过场视频监听器、
 * scene.restart 时序），混在 `GameplayScene` 里读起来很难找入口。集中之后：
 *   - 入口 1：`bossPhaseCleared()` —— BossPhase 派发 SCENE_EVENT_BOSS_PHASE_CLEARED 时调
 *   - 入口 2：`completeLevel(nextLevelId?)` —— level-exit 命中 / boss 结算的尾声调
 *   - `inSettlement` 是只读 flag，scene.update 据此决定要不要冻结世界
 *
 * 时序总览（普通 boss 关）：
 *   boss 死 → BossPhase.delayedCall(2000) → SCENE_EVENT_BOSS_PHASE_CLEARED
 *     → bossPhaseCleared() → inSettlement=true + 锁相机 + 暂停物理
 *     → BOSS_VICTORY emit → BossVictoryOverlay 展示 2.5s
 *     → completeLevel(nextLevelId) → LEVEL_COMPLETED emit + 停 BGM + 1.6s 后 scene.restart
 *
 * 时序总览（boss 过场关，nextLevelId === BOSS_TRANSITION_LEVEL_ID）：
 *   completeLevel 等 BOSS_TRANSITION_ENDED（视频播完）再 scene.restart，不走固定 1.6s。
 *
 * 时序总览（终极 boss，nextLevelId 缺失）：
 *   boss 死 → bossPhaseCleared() → 停 BGM + emit BOSS_ENDING_START
 *     → BossEndingOverlay 播放 good_ending.mp4
 *     → BOSS_ENDING_ENDED → showVictoryPanel() → BOSS_VICTORY 常驻（不再 completeLevel）
 */
import * as Phaser from 'phaser'
import {
  ASSET_KEYS,
  AUDIO_TUNING,
  BOSS_TRANSITION_LEVEL_ID,
  EVENT_KEYS,
  SKILL_IDS,
} from '@/contents/constants'
import { LEVEL_REGISTRY } from '@/contents/data/levels'
import { BOSS_REGISTRY } from '@/contents/data/bosses'
import type {
  BossTriggerSegmentDef,
  BossVictoryPayload,
  IGameplaySceneData,
  LevelCompletedPayload,
  LevelDef,
  SkillId,
} from '@/contents/types'
import { LevelRunner } from '@/contents/systems/level-runner'
import { CameraDirector } from '@/contents/systems/camera-director'
import { SkillManager } from '@/contents/systems/skill-manager'
import { Player } from '@/contents/entities/player/player'
import { playSfx } from '@/contents/systems/sfx'
import { useEventBus } from '@/runtime'
import type { BgmController } from './bgm-controller'

const eventBus = useEventBus()

export interface LevelCompletionDeps {
  readonly scene: Phaser.Scene
  readonly player: Player
  readonly levelDef: LevelDef
  readonly levelRunner: LevelRunner
  readonly cameraDirector: CameraDirector
  readonly skillManager: SkillManager
  readonly bgm: BgmController
  /** boss / level-exit 触发时清场 —— 把场上所有非 boss 敌兵清掉 */
  readonly despawnAllEnemies: () => void
}

export class LevelCompletion {
  /**
   * 结算锁：true 时本 scene 处于 "boss 已击破 → 正在展示 BOSS_VICTORY 面板" 的
   * 冻结窗口（camera locked + physics paused）。scene.update 据此跳过世界推进。
   */
  inSettlement = false

  /**
   * world-strip-demo → world-strip-boss 过场视频结束的一次性回调；
   * `completeLevel` 在触发 boss 过场时安装、视频 ended 时触发、destroy 时兜底摘除。
   */
  private pendingBossTransitionListener: (() => void) | null = null
  /**
   * 终极 boss 好结局视频结束的一次性回调；同上，destroy 时兜底摘除避免泄漏。
   */
  private pendingBossEndingListener: (() => void) | null = null

  private readonly deps: LevelCompletionDeps

  constructor(deps: LevelCompletionDeps) {
    this.deps = deps
  }

  /**
   * BossPhase 完成清场后由 GameplayScene 转发进来。负责"结算面板 → 终极结局
   * 或下一关"的分支。
   */
  bossPhaseCleared = (): void => {
    const { scene, levelRunner, cameraDirector, bgm, despawnAllEnemies } = this.deps

    // nextLevelId 解析优先级：
    //   1) 触发本次 boss 的 BossTriggerSegmentDef.nextLevelId（BossPhase 存到 scene.data）
    //   2) 段里任意 level-exit 的 nextLevelId（非 loop 关卡的兜底）
    //   3) 都没有 → 终极 boss：结算面板常驻
    const fromTrigger = scene.data.get('bossPhaseNextLevelId') as string | null | undefined
    const fromExit = (levelRunner.getDef().segments as readonly { type: string }[])
      .find((s) => s.type === 'level-exit') as { nextLevelId?: string } | undefined
    const nextLevelId = fromTrigger ?? fromExit?.nextLevelId

    // ---- 结算阶段 freeze ----
    // 锁相机 + 暂停物理 + 打 inSettlement 标记，让世界冻结在"最后一帧"画面上，
    // Vue 覆盖层（先是 BossEndingOverlay 的视频，再是 BossVictoryOverlay 的面板）
    // 占据全部注意力。两个覆盖层都在这层 freeze 之上播放。
    this.inSettlement = true
    const cam = scene.cameras.main
    cameraDirector.lock(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2)
    // `?.`：scene 处于异步收尾时 physics.world 可能已被置 null，跳过即可。
    scene.physics.world?.pause()
    despawnAllEnemies()

    const bossDef = this.findLastFiredBossDef()
    const bossId = bossDef?.id ?? 'boss'
    const displayName = bossDef?.displayName ?? 'BOSS'

    // 结算面板：终极 boss 等视频结束后再调，普通 boss 立即调；下面两条分支共用。
    const showVictoryPanel = (): void => {
      eventBus.emit(EVENT_KEYS.BOSS_VICTORY, {
        bossId,
        displayName,
        nextLevelId,
      } satisfies BossVictoryPayload)
      if (nextLevelId) {
        scene.time.delayedCall(2500, () => this.completeLevel(nextLevelId))
      }
    }

    if (nextLevelId) {
      // ---- 普通 boss：直接结算 → 2.5s 后 completeLevel ----
      showVictoryPanel()
      return
    }

    // ---- 终极 boss：good_ending.mp4 → 结算面板 ----
    // BGM：没有下一关 = completeLevel 不会跑 = 关卡 BGM 不会被它清掉；这里主动 stop。
    console.log('[LevelCompletion] terminal boss → play good_ending.mp4')
    bgm.stop()
    const onEndingEnded = (): void => {
      console.log('[LevelCompletion] BOSS_ENDING_ENDED → show BossVictoryOverlay')
      eventBus.off(EVENT_KEYS.BOSS_ENDING_ENDED, onEndingEnded)
      this.pendingBossEndingListener = null
      showVictoryPanel()
      playSfx(scene, ASSET_KEYS.AUDIO.SFX_BOSS_DEFEATED, AUDIO_TUNING.SFX_BOSS_DEFEATED_VOLUME)
    }
    this.pendingBossEndingListener = onEndingEnded
    eventBus.on(EVENT_KEYS.BOSS_ENDING_ENDED, onEndingEnded)
    eventBus.emit(EVENT_KEYS.BOSS_ENDING_START)
  }

  /**
   * 关卡完成 —— 来源：level-exit overlap，或 bossPhaseCleared 在结算 2.5s 后回调。
   * 幂等：同一 scene 生命周期内只生效一次。
   */
  completeLevel(nextLevelId?: string): void {
    const { scene, player, levelDef, cameraDirector, skillManager, bgm } = this.deps

    if ((scene.data.get('levelCompleted') as boolean) === true) return
    scene.data.set('levelCompleted', true)

    eventBus.emit(EVENT_KEYS.LEVEL_COMPLETED, {
      levelId: levelDef.id,
      nextLevelId,
    } satisfies LevelCompletedPayload)

    // 停掉相机 + 物理 + BGM
    scene.physics.world?.pause()
    cameraDirector.lock(player.sprite.x, player.sprite.y)
    scene.cameras.main.flash(400, 255, 255, 120)
    bgm.stop()

    if (!nextLevelId || !LEVEL_REGISTRY[nextLevelId]) return

    const carryOver: SkillId[] = []
    if (skillManager.isUnlocked(SKILL_IDS.FLIGHT)) carryOver.push(SKILL_IDS.FLIGHT)

    const doRestart = (): void => {
      console.log(`[LevelCompletion] scene.restart → levelId=${nextLevelId}, carryOver=${JSON.stringify(carryOver)}`)
      // 显式 resume 防止 "paused → restart → 新世界也瞬间 paused" 边角 case
      if (scene.physics?.world?.isPaused) scene.physics.world.resume()
      scene.scene.restart({
        levelId: nextLevelId,
        unlockedSkills: carryOver,
        fromTransition: true,
      } satisfies IGameplaySceneData)
    }

    // 推到下一 tick 执行 —— 调用方可能在 Vue DOM event 栈里（视频 ended 回调），
    // delayedCall(0) 把 restart 交回 Phaser 的干净生命周期。
    const scheduleRestart = (): void => {
      scene.time.delayedCall(0, doRestart)
    }

    if (nextLevelId === BOSS_TRANSITION_LEVEL_ID) {
      // Boss 场景专用：等 BossTransitionOverlay 把 boss_transition.mp4 播完再 scene.restart。
      const onEnded = (): void => {
        console.log(`[LevelCompletion] BOSS_TRANSITION_ENDED → scene.restart → ${nextLevelId}`)
        eventBus.off(EVENT_KEYS.BOSS_TRANSITION_ENDED, onEnded)
        this.pendingBossTransitionListener = null
        scheduleRestart()
      }
      this.pendingBossTransitionListener = onEnded
      eventBus.on(EVENT_KEYS.BOSS_TRANSITION_ENDED, onEnded)
      console.log(`[LevelCompletion] waiting for BOSS_TRANSITION_ENDED before restarting to ${nextLevelId}`)
    } else {
      // 常规过关：1600ms 让 LevelTransitionOverlay 完整淡入。
      scene.time.delayedCall(1600, doRestart)
    }
  }

  /**
   * 反查本次被击破的 BossDef。BossPhase 已经 exit，ctx 拿不到了；从当前关卡
   * 的 boss-trigger segments 里挑第一条 bossId 存在于 BOSS_REGISTRY 的即可。
   * loop 关卡 + 多 trigger 场景下可能不准，但 jam demo 每关最多一个 boss，够用。
   */
  private findLastFiredBossDef() {
    const segs = this.deps.levelRunner.getDef().segments
    for (const s of segs) {
      if (s.type !== 'boss-trigger') continue
      const trig = s as BossTriggerSegmentDef
      const bd = BOSS_REGISTRY[trig.bossId]
      if (bd) return bd
    }
    return null
  }

  /**
   * shutdown 时摘掉所有 pending 一次性监听器，避免泄漏到下一 scene。
   */
  destroy(): void {
    if (this.pendingBossTransitionListener) {
      eventBus.off(EVENT_KEYS.BOSS_TRANSITION_ENDED, this.pendingBossTransitionListener)
      this.pendingBossTransitionListener = null
    }
    if (this.pendingBossEndingListener) {
      eventBus.off(EVENT_KEYS.BOSS_ENDING_ENDED, this.pendingBossEndingListener)
      this.pendingBossEndingListener = null
    }
  }
}
