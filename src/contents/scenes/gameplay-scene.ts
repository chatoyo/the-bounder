/**
 * GameplayScene —— 主场景：Auto-scroll 平台跑酷 + 飞行升级。
 *
 * 本文件扮演"粘合层"：所有"有意思的逻辑"都外包给 systems / entities / data。
 * 场景自己只做三件事：
 *   1) 在 create() 里 **按正确顺序** 构造依赖
 *      （level → player → skills → camera → parallax → bounds → phase）。
 *   2) 在 update() 里 **按正确顺序** 调用它们的 tick
 *      （input → player → bullets → camera → bounds → parallax → phase → 摔死 / 过关 检测）。
 *   3) 把 Vue → Phaser 的遥控事件（pause/resume/restart）、玩家死亡/重生接出去。
 *
 * 新增/调整游玩逻辑的顺序：
 *   - 手感：改 `PLAYER_TUNING` / `SCROLL_TUNING`。
 *   - 关卡：改 `data/levels/*.ts`。
 *   - 技能：加 capability 文件 + 在 `data/skills/skill-registry.ts` 加 SkillDef +
 *     在本文件 registerCapabilityFactory + 合适时机 skillManager.equip()。
 *   - 阶段：新 Phase 实现 `Phase` 接口，在 create() 里 register + transition。
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
  CheckpointReachedPayload,
  IGameplaySceneData,
  LevelDef,
  LevelCompletedPayload,
  PhaseId,
  PickupCollectedPayload,
  PlayerHpChangedPayload,
  SkillId,
} from '../types'
import { LEVEL_01 } from '../data/levels/level-01'
import { SKILL_REGISTRY } from '../data/skills/skill-registry'
import { Player } from '../entities/player/player'
import { BulletPool } from '../entities/projectile/bullet-pool'
import { MoveCapability } from '../entities/player/capabilities/move-capability'
import { JumpCapability } from '../entities/player/capabilities/jump-capability'
import { ShootCapability } from '../entities/player/capabilities/shoot-capability'
import { FlyCapability } from '../entities/player/capabilities/fly-capability'
import { CameraDirector } from '../systems/camera-director'
import { InputSystem } from '../systems/input-system'
import { LevelRunner } from '../systems/level-runner'
import { ParallaxSystem } from '../systems/parallax-system'
import { ScreenBoundsSystem } from '../systems/screen-bounds-system'
import {
  PhaseController,
  RespawnPhase,
  RunningPhase,
  type PhaseContext,
} from '../systems/phase-controller'
import { SkillManager } from '../systems/skill-manager'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

/** 关卡表：id → LevelDef。demo 里会加 LEVEL_02 */
const LEVEL_REGISTRY: Readonly<Record<string, LevelDef>> = {
  [LEVEL_01.id]: LEVEL_01,
}

export class GameplayScene extends Phaser.Scene {
  // ---- 运行时实例（在 create() 里构造，用 ! 延迟初始化） ----
  // 注意：不用 `input` 做字段名 —— `Phaser.Scene.input` 是 InputPlugin，被子类
  // 同名字段会破坏继承可赋值性。我们自己的输入系统叫 inputSystem。
  private player!: Player
  private levelRunner!: LevelRunner
  private playerBullets!: BulletPool
  private inputSystem!: InputSystem
  private skillManager!: SkillManager
  private cameraDirector!: CameraDirector
  private parallax!: ParallaxSystem
  private screenBounds!: ScreenBoundsSystem
  private phaseController!: PhaseController

  /** 初始从上一场景 / 重启带来的启动数据 */
  private initData: IGameplaySceneData = {}

  /** debug 开关；开启时画物理调试形状、打印 phase 切换 */
  private debug = false

  /** 当前关卡 def（缓存一次避免 update 里反复 getDef） */
  private levelDef!: LevelDef

  constructor() {
    super({ key: SCENE_KEYS.GAMEPLAY })
  }

  init(data: IGameplaySceneData): void {
    this.initData = data ?? {}
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

    // ---- 5. Input ----
    this.inputSystem = new InputSystem(this)
    this.inputSystem.bindDefaults()
    this.inputSystem.on((action, phase) => this.player.onAction(action, phase))

    // ---- 6. Skill 系统 ----
    this.skillManager = new SkillManager(this.player)
    this.skillManager.registerSkills(Object.values(SKILL_REGISTRY))

    // Passive：移动 / 跳跃是"与生俱来"的 capability，直接挂上，不走 SkillManager
    this.player.attachCapability(new MoveCapability(this.inputSystem))
    this.player.attachCapability(new JumpCapability())

    // Active capability 工厂（按 capability id 注册；SkillManager 查表实例化）
    this.skillManager.registerCapabilityFactory(
      CAPABILITY_IDS.SHOOT,
      () => new ShootCapability(this.playerBullets),
    )
    this.skillManager.registerCapabilityFactory(
      CAPABILITY_IDS.FLY,
      () => new FlyCapability(this.inputSystem),
    )

    // 装备初始技能：射击永远有；跨关卡带过来的解锁技能一并恢复
    this.skillManager.unlock(SKILL_IDS.SHOOT)
    this.skillManager.equip(SKILL_IDS.SHOOT)

    for (const skillId of this.initData.unlockedSkills ?? []) {
      this.skillManager.unlock(skillId as SkillId)
      // 只有飞行这类"装了就吃属性"的技能，进关时自动 equip
      if (skillId === SKILL_IDS.FLIGHT) this.skillManager.equip(SKILL_IDS.FLIGHT)
    }

    // ---- 7. 相机 ----
    this.cameraDirector = new CameraDirector(this)
    this.cameraDirector.setBounds(0, 0, level.width, level.height)
    const scrollMode = level.scroll?.mode ?? 'auto-right'
    if (scrollMode === 'auto-right') {
      const speed = level.scroll?.speed ?? SCROLL_TUNING.DEFAULT_SPEED
      this.cameraDirector.autoScrollRight(speed)
      // 起始 scroll 对齐 spawn（保证玩家在屏幕左侧内）
      this.cameras.main.setScroll(Math.max(0, spawn.x - 200), 0)
    } else if (scrollMode === 'follow') {
      this.cameraDirector.follow(this.player.sprite)
    } else {
      this.cameraDirector.lock(spawn.x, spawn.y)
    }

    // ---- 8. 视差背景 / 前景 ----
    this.parallax = new ParallaxSystem(this, this.cameraDirector)
    this.parallax.loadBackground(level.background)
    this.parallax.loadForeground(level.foreground)

    // ---- 9. 屏幕边界（auto-right 才启用；follow 关不需要） ----
    this.screenBounds = new ScreenBoundsSystem(this.cameraDirector, {
      clampY: this.player.isFlying,
    })
    this.screenBounds.setTarget(this.player.sprite)
    this.screenBounds.setEnabled(scrollMode === 'auto-right')
    this.screenBounds.onCrush(() => {
      if (this.player.alive) this.player.kill('crush')
    })

    // ---- 10. 碰撞 ----
    this.physics.add.collider(this.player.sprite, this.levelRunner.platforms)

    // 子弹撞墙 → 回池
    const onBulletHitPlatform: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bullet) => {
      this.playerBullets.kill(bullet as Phaser.Physics.Arcade.Sprite)
    }
    this.physics.add.collider(
      this.playerBullets.group,
      this.levelRunner.platforms,
      onBulletHitPlatform,
    )

    // 玩家撞危险 → 扣血
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

    // 玩家碰检查点 → 激活
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

    // 玩家碰拾取物 → 应用效果 + 消费
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

    // ---- 11. PhaseController ----
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
    this.phaseController.transition(PHASE_IDS.RUNNING)

    // ---- 12. EventBus 连线（Vue 遥控 + 玩家死亡响应） ----
    eventBus.on(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.on(EVENT_KEYS.GAME_RESUME, this.handleResume)
    eventBus.on(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.on(EVENT_KEYS.PLAYER_DIED, this.handlePlayerDied)

    // ---- 13. 初始状态同步给 HUD ----
    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: this.player.hp,
      max: this.player.maxHp,
    } satisfies PlayerHpChangedPayload)

    // ---- 14. shutdown 清理 ----
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown)

    // ---- Debug ----
    if (this.debug) {
      this.physics.world.createDebugGraphic()
      eventBus.on(EVENT_KEYS.PHASE_CHANGED, (payload: unknown) => {
        console.log('[GameplayScene] phase:', payload)
      })
    }
  }

  // =========================================================================
  // update —— 顺序重要：相机先于 screenBounds；screenBounds 必须在 player.update
  // 之后执行（要夹紧的是 capability 刚写过的 velocity/position）。
  // =========================================================================

  update(time: number, delta: number): void {
    this.inputSystem.update(time, delta)
    this.player.update(time, delta)
    this.playerBullets.cull(time)

    this.cameraDirector.update(time, delta)
    this.parallax.update(time, delta)

    // 飞行态下开启 Y 夹紧；地面态下关闭（允许跳跃到屏幕顶外一点）
    this.screenBounds.setConfig({ clampY: this.player.isFlying })
    this.screenBounds.update(time, delta)

    this.phaseController.update(time, delta)

    // 摔出世界下沿 → 死
    if (
      this.player.alive &&
      this.player.sprite.y > this.levelDef.height + GAME_CONFIG.FALL_DEATH_MARGIN
    ) {
      this.player.kill('fall')
    }

    // Level exit 碰撞检测（距离式；简化实现）
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
  // 副逻辑：拾取 / 过关
  // =========================================================================

  private handlePickup(go: Phaser.GameObjects.GameObject): void {
    const meta = this.levelRunner.getPickupMeta(go)
    if (!meta) return
    this.levelRunner.consumePickup(go)

    // 事件先发出（Vue 侧 pickup toast 可以用）
    const sprite = go as Phaser.GameObjects.Sprite
    eventBus.emit(EVENT_KEYS.PICKUP_COLLECTED, {
      id: meta.id,
      kind: meta.kind as PickupCollectedPayload['kind'],
      x: sprite.x,
      y: sprite.y,
    } satisfies PickupCollectedPayload)

    // 效果
    if (meta.kind === 'flight-orb') {
      this.skillManager.unlock(SKILL_IDS.FLIGHT)
      this.skillManager.equip(SKILL_IDS.FLIGHT)
      this.cameraDirector.flash(200, 255, 230, 120)
    } else if (meta.kind === 'hp-crystal') {
      // Phase A 没 heal API；这里 respawn 当即 + 1 血的 placeholder：
      // 完整实现放到 demo commit 里再做（避免 Player 类在架构改动里再长 API）
    }
  }

  private completeLevel(nextLevelId?: string): void {
    // 一次性（防重复触发）
    if ((this.data.get('levelCompleted') as boolean) === true) return
    this.data.set('levelCompleted', true)

    eventBus.emit(EVENT_KEYS.LEVEL_COMPLETED, {
      levelId: this.levelDef.id,
      nextLevelId,
    } satisfies LevelCompletedPayload)

    // 停掉相机、停物理
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
  // 监听器（箭头函数保持 this 绑定，便于 eventBus.off 精确匹配）
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

    // 从外向内销毁，避免 Phase 还在 tick 已释放的资源
    this.phaseController?.destroy()
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
