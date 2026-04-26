/**
 * GameplayScene —— 主场景：Auto-scroll 平台跑酷 + 对话 + Boss 战的粘合层。
 *
 * 场景自身只做三件事：
 *   1) create()：按依赖顺序构造
 *      level → player → bullets → skills → camera → parallax → bounds
 *             → npc/pickup → phases → collisions → events
 *   2) update()：按 tick 顺序驱动
 *      input → player → bullets → camera → bounds → parallax → phase → 摔死 / 过关 / boss-trigger 检测
 *   3) 把 Vue → Phaser 的遥控事件（pause/resume/restart）、玩家死亡 / 过关 / dialogue command 接出去
 *
 * 扩展快捷通道：
 *   - 手感：改 `PLAYER_TUNING` / `SCROLL_TUNING`。
 *   - 关卡：改 `data/levels/*.ts`。
 *   - 技能：加 capability 文件 + 在 `data/skills/skill-registry.ts` 加 SkillDef +
 *     在本文件 registerCapabilityFactory + 合适时机 skillManager.equip()。
 *   - Phase：新 Phase 实现 `Phase` 接口，在 create() 里 register + transition。
 */

import * as Phaser from 'phaser'
import {
  CAPABILITY_IDS,
  EVENT_KEYS,
  GAME_CONFIG,
  PHASE_IDS,
  POOL_SIZES,
  SCENE_KEYS,
  SCROLL_TUNING,
  SKILL_IDS,
} from '../constants'
import type {
  ActionId,
  CheckpointReachedPayload,
  DialogueCommand,
  IGameplaySceneData,
  LevelDef,
  LevelCompletedPayload,
  PhaseId,
  PickupCollectedPayload,
  PlayerHpChangedPayload,
  SkillId,
} from '../types'
import { ACTION_IDS } from '../constants'
import { LEVEL_01 } from '../data/levels/level-01'
import { LEVEL_02 } from '../data/levels/level-02'
import { SKILL_REGISTRY } from '../data/skills/skill-registry'
import { DIALOGUE_REGISTRY } from '../data/dialogues'
import { BOSS_REGISTRY } from '../data/bosses'
import { Player } from '../entities/player/player'
import { BulletPool } from '../entities/projectile/bullet-pool'
import { MoveCapability } from '../entities/player/capabilities/move-capability'
import { JumpCapability } from '../entities/player/capabilities/jump-capability'
import { ShootCapability } from '../entities/player/capabilities/shoot-capability'
import { FlyCapability } from '../entities/player/capabilities/fly-capability'
import { NpcEntity } from '../entities/npc/npc-entity'
import { CameraDirector } from '../systems/camera-director'
import { InputSystem } from '../systems/input-system'
import { LevelRunner, LOOP_WORLD_MAX_X } from '../systems/level-runner'
import { ParallaxSystem } from '../systems/parallax-system'
import { ScreenBoundsSystem } from '../systems/screen-bounds-system'
import { DialogueRunner } from '../systems/dialogue-runner'
import {
  PhaseController,
  RespawnPhase,
  RunningPhase,
  type PhaseContext,
} from '../systems/phase-controller'
import { DialoguePhase } from '../systems/phases/dialogue-phase'
import {
  BossPhase,
  SCENE_EVENT_BOSS_PHASE_CLEARED,
  type BossPhaseEnterData,
} from '../systems/phases/boss-phase'
import { SkillManager } from '../systems/skill-manager'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

/** 关卡表：id → LevelDef。新增关卡只要 import + 加一行。 */
const LEVEL_REGISTRY: Readonly<Record<string, LevelDef>> = {
  [LEVEL_01.id]: LEVEL_01,
  [LEVEL_02.id]: LEVEL_02,
}

export class GameplayScene extends Phaser.Scene {
  private player!: Player
  private levelRunner!: LevelRunner
  private playerBullets!: BulletPool
  private inputSystem!: InputSystem
  private skillManager!: SkillManager
  private cameraDirector!: CameraDirector
  private parallax!: ParallaxSystem
  private screenBounds!: ScreenBoundsSystem
  private phaseController!: PhaseController
  private dialogueRunner!: DialogueRunner

  /** 已物化的 NPC 实体，按 id 可以反查到 */
  private npcs = new Map<string, NpcEntity>()
  /** 当前玩家站在哪个 NPC 的交互区内（可按 E 对话）*/
  private currentNpcInRange: NpcEntity | null = null
  /**
   * 本次 scene 生命周期内已触发过对话的 NPC id 集合。
   * Auto-scroll 关卡里玩家停不下来，按 E 的窗口极短；所以进入 zone 的那一刻
   * 就自动开对话，本集合用来保证同一 NPC 一次 scene 只触发一次（避免重进对话循环）。
   */
  private seenNpcs = new Set<string>()

  /** 初始从上一场景 / 重启带来的启动数据 */
  private initData: IGameplaySceneData = {}

  /** debug 开关；开启时画物理调试形状、打印 phase 切换 */
  private debug = false

  /** 当前关卡 def（缓存一次避免 update 里反复 getDef） */
  private levelDef!: LevelDef

  /** 保存滚动模式；update 里依据它决定 ScreenBoundsSystem 是否启用 */
  private savedScrollMode: 'auto-right' | 'follow' | 'locked' = 'auto-right'

  constructor() {
    super({ key: SCENE_KEYS.GAMEPLAY })
  }

  init(data: IGameplaySceneData): void {
    this.initData = data ?? {}
    this.npcs = new Map()
    this.currentNpcInRange = null
    this.seenNpcs = new Set()
  }

  // =========================================================================
  // create
  // =========================================================================

  create(): void {
    // ---- 1. 选关卡 ----
    const levelId = this.initData.levelId ?? LEVEL_01.id
    const level = LEVEL_REGISTRY[levelId] ?? LEVEL_01
    this.levelDef = level

    this.cameras.main.setBackgroundColor('#1a1a2e')

    // ---- 2. 关卡物化 ----
    this.levelRunner = new LevelRunner(this)
    this.levelRunner.load(level)
    if (this.initData.startCheckpointId) {
      this.levelRunner.setActiveCheckpoint(this.initData.startCheckpointId)
    }

    // ---- 3. 玩家 ----
    const spawn = this.levelRunner.getActiveSpawn()
    this.player = new Player(this, spawn.x, spawn.y)

    // ---- 4. 子弹池 ----
    this.playerBullets = new BulletPool(this, 'bullet', POOL_SIZES.PLAYER_BULLETS)
    // 把玩家子弹 group 塞到 scene.data，BossPhase 需要它建 overlap
    this.data.set('playerBulletsGroup', this.playerBullets.group)

    // ---- 5. Input ----
    this.inputSystem = new InputSystem(this)
    this.inputSystem.bindDefaults()
    this.inputSystem.on((action, phase) => this.player.onAction(action, phase))
    this.inputSystem.on(this.onInputAction)

    // ---- 6. Skill 系统 ----
    this.skillManager = new SkillManager(this.player)
    this.skillManager.registerSkills(Object.values(SKILL_REGISTRY))

    this.player.attachCapability(new MoveCapability(this.inputSystem))
    this.player.attachCapability(new JumpCapability())

    this.skillManager.registerCapabilityFactory(
      CAPABILITY_IDS.SHOOT,
      () => new ShootCapability(this.playerBullets),
    )
    this.skillManager.registerCapabilityFactory(
      CAPABILITY_IDS.FLY,
      () => new FlyCapability(this.inputSystem),
    )

    this.skillManager.unlock(SKILL_IDS.SHOOT)
    this.skillManager.equip(SKILL_IDS.SHOOT)

    for (const skillId of this.initData.unlockedSkills ?? []) {
      this.skillManager.unlock(skillId as SkillId)
      if (skillId === SKILL_IDS.FLIGHT) this.skillManager.equip(SKILL_IDS.FLIGHT)
    }

    // ---- 7. 相机 ----
    this.cameraDirector = new CameraDirector(this)
    // loop 模式：相机 X 边界设成 "事实上无限"（10 亿像素），让 auto-scroll 一直跑下去
    const cameraWorldW = level.loop === true ? LOOP_WORLD_MAX_X : level.width
    this.cameraDirector.setBounds(0, 0, cameraWorldW, level.height)
    const scrollMode = level.scroll?.mode ?? 'auto-right'
    this.savedScrollMode = scrollMode
    if (scrollMode === 'auto-right') {
      const speed: number = level.scroll?.speed ?? SCROLL_TUNING.DEFAULT_SPEED
      this.cameraDirector.autoScrollRight(speed)
      this.cameras.main.setScroll(Math.max(0, spawn.x - 200), 0)
    } else if (scrollMode === 'follow') {
      this.cameraDirector.follow(this.player.sprite)
    } else {
      this.cameraDirector.lock(spawn.x, spawn.y)
    }
    // 把 director 塞到 scene.data 供 phase 按名查
    this.data.set('cameraDirector', this.cameraDirector)

    // ---- 8. 视差背景 / 前景 ----
    this.parallax = new ParallaxSystem(this, this.cameraDirector)
    this.parallax.loadBackground(level.background)
    this.parallax.loadForeground(level.foreground)

    // ---- 9. 屏幕边界 ----
    this.screenBounds = new ScreenBoundsSystem(this.cameraDirector, {
      clampY: this.player.isFlying,
    })
    this.screenBounds.setTarget(this.player.sprite)
    this.screenBounds.setEnabled(scrollMode === 'auto-right')
    this.screenBounds.onCrush(() => {
      if (this.player.alive) this.player.kill('crush')
    })

    // ---- 10. NPC 物化 ----
    this.levelRunner.forEachNpc((def) => {
      const npc = new NpcEntity(this, def)
      this.npcs.set(def.id, npc)
      // 与玩家 zone overlap → 标记 currentNpcInRange + 尝试自动触发对话。
      // 在 auto-scroll 关卡里玩家停不下来，按 E 的窗口极短 —— 所以入 zone
      // 即开讲，按过一次就再也不触发（seenNpcs 里留痕）。E 键仍然保留作为
      // follow / locked 关卡下的显式入口（见 onInputAction）。
      this.physics.add.overlap(this.player.sprite, npc.zone, () => {
        if (this.currentNpcInRange !== npc) {
          this.currentNpcInRange?.setHighlighted(false)
          this.currentNpcInRange = npc
          npc.setHighlighted(true)
        }
        this.maybeAutoStartDialogue(npc)
      })
    })

    // ---- 11. 碰撞 ----
    this.physics.add.collider(this.player.sprite, this.levelRunner.platforms)

    const onBulletHitPlatform: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bullet) => {
      this.playerBullets.kill(bullet as Phaser.Physics.Arcade.Sprite)
    }
    this.physics.add.collider(
      this.playerBullets.group,
      this.levelRunner.platforms,
      onBulletHitPlatform,
    )

    const onPlayerHazardOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      _playerGO,
      hazardGO,
    ) => {
      if (!this.player.alive) return
      const go = hazardGO as Phaser.GameObjects.GameObject
      const dmg = this.levelRunner.getHazardDamage(go)
      this.player.damage(dmg, 'hazard')
    }
    this.physics.add.overlap(
      this.player.sprite,
      this.levelRunner.hazards,
      onPlayerHazardOverlap,
    )

    const onCheckpointOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      _playerGO,
      cpGO,
    ) => {
      const go = cpGO as Phaser.GameObjects.GameObject
      const res = this.levelRunner.handleCheckpointTouched(go)
      if (res && res.changed) {
        const sp = this.levelRunner.getActiveSpawn()
        eventBus.emit(EVENT_KEYS.CHECKPOINT_REACHED, {
          id: res.id,
          x: sp.x,
        } satisfies CheckpointReachedPayload)
      }
    }
    this.physics.add.overlap(
      this.player.sprite,
      this.levelRunner.checkpoints,
      onCheckpointOverlap,
    )

    const onPickupOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      _playerGO,
      pickupGO,
    ) => {
      if (!this.player.alive) return
      this.handlePickup(pickupGO as Phaser.GameObjects.GameObject)
    }
    this.physics.add.overlap(
      this.player.sprite,
      this.levelRunner.pickups,
      onPickupOverlap,
    )

    // ---- 12. DialogueRunner + Phases ----
    this.dialogueRunner = new DialogueRunner((cmd) => this.handleDialogueCommand(cmd))

    this.phaseController = new PhaseController()
    const phaseCtx: PhaseContext = {
      scene: this,
      player: this.player,
      levelRunner: this.levelRunner,
      inputSystem: this.inputSystem,
      controller: this.phaseController,
    }
    this.phaseController.register(new RunningPhase(phaseCtx))
    this.phaseController.register(new RespawnPhase(phaseCtx))
    this.phaseController.register(new DialoguePhase(phaseCtx, this.dialogueRunner))
    this.phaseController.register(new BossPhase(phaseCtx))
    this.phaseController.transition(PHASE_IDS.RUNNING)

    // ---- 13. EventBus 连线 ----
    eventBus.on(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.on(EVENT_KEYS.GAME_RESUME, this.handleResume)
    eventBus.on(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.on(EVENT_KEYS.PLAYER_DIED, this.handlePlayerDied)

    // Boss phase 清场 → 关卡完成
    this.events.on(SCENE_EVENT_BOSS_PHASE_CLEARED, this.onBossPhaseCleared)

    // ---- 14. 初始状态同步给 HUD ----
    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: this.player.hp,
      max: this.player.maxHp,
    } satisfies PlayerHpChangedPayload)

    // ---- 15. shutdown 清理 ----
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown)

    if (this.debug) {
      this.physics.world.createDebugGraphic()
      eventBus.on(EVENT_KEYS.PHASE_CHANGED, (payload: unknown) => {
        console.log('[GameplayScene] phase:', payload)
      })
    }
  }

  // =========================================================================
  // update
  // =========================================================================

  update(time: number, delta: number): void {
    // ---- 始终运行：输入 + 相位控制器 ----
    // 对话 / 重生阶段也要推进 —— 玩家要按键翻页，phase 自己要倒计时切走。
    this.inputSystem.update(time, delta)
    this.phaseController.update(time, delta)

    // 若当前 phase 冻结世界（Dialogue / Respawn / 将来的 Cutscene），
    // 跳过所有"推进世界"的系统。这一层负责把相机 auto-scroll / 视差 /
    // screenBounds / chunk spawner / 玩家 capability / 子弹池 / running 检测 全部静止。
    // physics.world.pause() 仍由各自 phase.enter() 负责物理层面的冻结。
    if (this.phaseController.getCurrent()?.freezesWorld === true) return

    // ---- 世界更新 ----
    this.player.update(time, delta)
    this.playerBullets.cull(time)

    this.cameraDirector.update(time, delta)
    this.parallax.update(time, delta)

    // 飞行态下开启 Y 夹紧
    this.screenBounds.setConfig({ clampY: this.player.isFlying })
    // Boss phase 时关闭自动 crush 判定（对话 phase 已经被 freezesWorld 拦在外面）
    const phaseId = this.phaseController.getCurrentId()
    const inCombat = phaseId === PHASE_IDS.BOSS
    this.screenBounds.setEnabled(this.savedScrollMode === 'auto-right' && !inCombat)
    this.screenBounds.update(time, delta)

    // 水平无限循环：让 LevelRunner 根据相机位置维护 platform / hazard /
    // checkpoint 的前后生成（非 loop 关卡下 tickSpawner 是 no-op）。
    if (this.levelRunner.isLooping()) {
      const cam = this.cameras.main
      this.levelRunner.tickSpawner(cam.scrollX, cam.width)
    }

    // NPC 离开检测：玩家离开 NPC 的 zone 后清 currentNpcInRange
    this.tickNpcProximity()

    // 仅 running phase 才做摔死 / 过关 / boss-trigger 检测
    if (phaseId !== PHASE_IDS.RUNNING) return

    // 摔出世界下沿 → 死
    if (
      this.player.alive &&
      this.player.sprite.y > this.levelDef.height + GAME_CONFIG.FALL_DEATH_MARGIN
    ) {
      this.player.kill('fall')
      return
    }

    // Boss trigger
    if (this.player.alive) {
      const trigger = this.levelRunner.checkBossTrigger(this.player.sprite.x)
      if (trigger) {
        const bossDef = BOSS_REGISTRY[trigger.bossId]
        if (bossDef) {
          this.phaseController.transition(PHASE_IDS.BOSS, {
            bossDef,
            levelId: this.levelDef.id,
          } satisfies BossPhaseEnterData)
          return
        }
      }
    }

    // Level exit
    if (this.player.alive) {
      const exit = this.levelRunner.findLevelExitAt(
        this.player.sprite.x,
        this.player.sprite.y,
        40,
      )
      if (exit) {
        this.completeLevel(exit.nextLevelId)
      }
    }
  }

  // =========================================================================
  // NPC 邻近 / 对话触发
  // =========================================================================

  private tickNpcProximity(): void {
    const npc = this.currentNpcInRange
    if (!npc) return
    // 若玩家已远离（手动距离判定，确保 zone 离开 tick 可靠）
    const dx = Math.abs(this.player.sprite.x - npc.sprite.x)
    const dy = Math.abs(this.player.sprite.y - npc.sprite.y)
    if (dx > 48 || dy > 60) {
      npc.setHighlighted(false)
      this.currentNpcInRange = null
    }
  }

  /** Input 事件转发中枢（独立于 player.onAction；此处用于场景级交互） */
  private onInputAction = (action: ActionId, phase: 'down' | 'up'): void => {
    if (phase !== 'down') return
    if (action !== ACTION_IDS.INTERACT) return
    // 仅 running phase 允许触发对话（dialogue phase 下 E = advance）
    if (this.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return
    const npc = this.currentNpcInRange
    if (!npc) return
    this.startDialogueFor(npc)
  }

  /**
   * Zone overlap 自动入话。仅对本 scene 还没触发过的 NPC 生效，且仅在
   * running phase 下 —— 防止 respawn 落在 NPC 身上 / 对话中再次触发。
   */
  private maybeAutoStartDialogue(npc: NpcEntity): void {
    if (this.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return
    if (this.seenNpcs.has(npc.id)) return
    this.startDialogueFor(npc)
  }

  /** 对话开口的单一入口：验证 dialogue def、打 seenNpcs、transition。 */
  private startDialogueFor(npc: NpcEntity): void {
    const def = DIALOGUE_REGISTRY[npc.dialogueId]
    if (!def) {
      console.warn(`[GameplayScene] NPC ${npc.id} 指向未知对话 ${npc.dialogueId}`)
      return
    }
    this.seenNpcs.add(npc.id)
    this.phaseController.transition(PHASE_IDS.DIALOGUE, def)
  }

  // =========================================================================
  // Dialogue command 回调（grant-skill / equip-skill / heal / set-flag）
  // =========================================================================

  private handleDialogueCommand(cmd: DialogueCommand): void {
    switch (cmd.type) {
      case 'grant-skill':
        this.skillManager.unlock(cmd.id)
        break
      case 'equip-skill':
        this.skillManager.unlock(cmd.id)
        this.skillManager.equip(cmd.id)
        break
      case 'heal':
        // Player 暂未暴露 heal；这里给个最简实现：直接 respawn-style 加血
        // —— jam 里先忽略，避免 Player 改 API 影响架构层
        break
      case 'set-flag':
        this.data.set(`flag:${cmd.key}`, cmd.value)
        break
    }
  }

  // =========================================================================
  // 副逻辑：拾取 / 过关 / boss 后收尾
  // =========================================================================

  private handlePickup(go: Phaser.GameObjects.GameObject): void {
    const meta = this.levelRunner.getPickupMeta(go)
    if (!meta) return
    this.levelRunner.consumePickup(go)

    const sprite = go as Phaser.GameObjects.Sprite
    eventBus.emit(EVENT_KEYS.PICKUP_COLLECTED, {
      id: meta.id,
      kind: meta.kind as PickupCollectedPayload['kind'],
      x: sprite.x,
      y: sprite.y,
    } satisfies PickupCollectedPayload)

    if (meta.kind === 'flight-orb') {
      this.skillManager.unlock(SKILL_IDS.FLIGHT)
      this.skillManager.equip(SKILL_IDS.FLIGHT)
      this.cameraDirector.flash(200, 255, 230, 120)
    } else if (meta.kind === 'hp-crystal') {
      // 简化：补满血（通过 respawn 管道）；真实 heal API 留到后续 Player 扩展
      // 这里发一个直接修正 HP 的小绕路：Player 没 heal → 跳过实际加血，只做视觉
      this.cameraDirector.flash(200, 255, 120, 120)
    }
  }

  private onBossPhaseCleared = (): void => {
    // Loop 关卡：boss 是关卡中的一次性事件，打完之后继续无限跑。重启 auto-scroll
    // 即可 —— firedBossTriggers 保证同一 trigger 不会在后续 chunk 里再发一次。
    if (this.levelRunner.isLooping()) {
      const speed: number = this.levelDef.scroll?.speed ?? SCROLL_TUNING.DEFAULT_SPEED
      this.cameraDirector.autoScrollRight(speed)
      // PhaseController 的 BossPhase.onBossDefeated 已经 transition 到 running。
      return
    }

    // 非 loop：老行为 —— 查找 level-exit 决定转场到哪一关
    const anyExit = Array.from(
      (this.levelRunner.getDef().segments as readonly { type: string }[]).filter(
        (s) => s.type === 'level-exit',
      ),
    )[0] as { nextLevelId?: string } | undefined
    this.completeLevel(anyExit?.nextLevelId)
  }

  private completeLevel(nextLevelId?: string): void {
    if ((this.data.get('levelCompleted') as boolean) === true) return
    this.data.set('levelCompleted', true)

    eventBus.emit(EVENT_KEYS.LEVEL_COMPLETED, {
      levelId: this.levelDef.id,
      nextLevelId,
    } satisfies LevelCompletedPayload)

    // 停掉相机 + 物理
    this.physics.world.pause()
    this.cameraDirector.lock(this.player.sprite.x, this.player.sprite.y)
    this.cameras.main.flash(400, 255, 255, 120)

    if (nextLevelId && LEVEL_REGISTRY[nextLevelId]) {
      const carryOver: SkillId[] = []
      if (this.skillManager.isUnlocked(SKILL_IDS.FLIGHT)) carryOver.push(SKILL_IDS.FLIGHT)

      this.time.delayedCall(900, () => {
        this.scene.restart({
          levelId: nextLevelId,
          unlockedSkills: carryOver,
        } satisfies IGameplaySceneData)
      })
    }
  }

  // =========================================================================
  // 监听器
  // =========================================================================

  private handlePause = (): void => {
    this.scene.pause()
  }

  private handleResume = (): void => {
    this.scene.resume()
  }

  private handleRestart = (): void => {
    this.scene.restart({
      startCheckpointId: undefined,
      levelId: this.levelDef?.id,
    } satisfies IGameplaySceneData)
  }

  private handlePlayerDied = (): void => {
    if (this.phaseController.getCurrentId() === (PHASE_IDS.RESPAWN as PhaseId)) return
    this.phaseController.transition(PHASE_IDS.RESPAWN)
  }

  private handleShutdown = (): void => {
    eventBus.off(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.off(EVENT_KEYS.GAME_RESUME, this.handleResume)
    eventBus.off(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.off(EVENT_KEYS.PLAYER_DIED, this.handlePlayerDied)
    this.events.off(SCENE_EVENT_BOSS_PHASE_CLEARED, this.onBossPhaseCleared)

    // 销毁顺序：从外到内
    this.phaseController?.destroy()
    this.dialogueRunner?.destroy()
    for (const npc of this.npcs.values()) npc.destroy()
    this.npcs.clear()
    this.skillManager?.destroy()
    this.screenBounds?.destroy()
    this.parallax?.destroy()
    this.cameraDirector?.destroy()
    this.inputSystem?.destroy()
    this.playerBullets?.destroy()
    this.player?.destroy()
    this.levelRunner?.destroy()
  }
}
