/**
 * GameplayScene —— 主场景：Auto-scroll 平台跑酷 + 对话 + Boss 战的粘合层。
 *
 * 本文件只做编排，具体逻辑被拆到 `gameplay/` 子目录里的 manager / controller / helper：
 *   - `gameplay/bgm-controller.ts`       —— 关卡 BGM 生命周期
 *   - `gameplay/level-completion.ts`     —— Boss 击破结算 + completeLevel + 转场状态机
 *   - `gameplay/enemy-manager.ts`        —— 小飞兵 + 代码弹幕 池/刷新/碰撞
 *   - `gameplay/world-collisions.ts`     —— 玩家 vs 平台/hazard/checkpoint/pickup
 *   - `gameplay/pickup-handler.ts`       —— 拾取物效果分派
 *   - `gameplay/dialogue-bridge.ts`      —— NPC 邻近探测 + 对话触发 + commands
 *
 * scene 自身只剩三块：
 *   1) create() —— 按依赖顺序构造并把上述模块拼起来
 *   2) update() —— 按 tick 顺序驱动
 *   3) shutdown() —— safeDestroy 清理链
 *
 * 扩展快捷通道：
 *   - 手感：改 `PLAYER_TUNING` / `SCROLL_TUNING`。
 *   - 关卡：在 `data/levels/` 加文件并往 `LEVEL_DEFINITIONS` 追加一条。
 *   - 技能：加 capability 文件 + 在 `data/skills/skill-registry.ts` 加 SkillDef +
 *     在本文件 registerCapabilityFactory + 合适时机 skillManager.equip()。
 *   - Phase：新 Phase 实现 `Phase` 接口，在 create() 里 register + transition。
 */

import * as Phaser from 'phaser'
import {
  ASSET_KEYS,
  AUDIO_TUNING,
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
  IGameplaySceneData,
  LevelDef,
  LevelStartedPayload,
  PhaseId,
  PlayerHpChangedPayload,
} from '../types'
import {
  LEVEL_REGISTRY,
  LEVEL_WORLD_STRIP_BOSS,
  LEVEL_WORLD_STRIP_DEMO,
  WORLD_STRIP_LEVELS,
} from '../data/levels'
import { SKILL_REGISTRY } from '../data/skills/skill-registry'
import { BOSS_REGISTRY } from '../data/bosses'
import { Player } from '../entities/player/player'
import { BulletPool } from '../entities/projectile/bullet-pool'
import { MoveCapability } from '../entities/player/capabilities/move-capability'
import { JumpCapability } from '../entities/player/capabilities/jump-capability'
import { ShootCapability } from '../entities/player/capabilities/shoot-capability'
import { FlyCapability } from '../entities/player/capabilities/fly-capability'
import { CameraDirector } from '../systems/camera-director'
import { InputSystem } from '../systems/input-system'
import { LevelRunner, LOOP_WORLD_MAX_X } from '../systems/level-runner'
import { ParallaxSystem } from '../systems/parallax-system'
import { ScreenBoundsSystem } from '../systems/screen-bounds-system'
import { WorldStripSystem } from '../systems/world-strip-system'
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
import { playSfx } from '../systems/sfx'
import { useEventBus } from '@/runtime'
import { BgmController } from './gameplay/bgm-controller'
import { DialogueBridge } from './gameplay/dialogue-bridge'
import { EnemyManager } from './gameplay/enemy-manager'
import { LevelCompletion } from './gameplay/level-completion'
import { makePickupHandler } from './gameplay/pickup-handler'
import { setupWorldCollisions } from './gameplay/world-collisions'

const eventBus = useEventBus()

/**
 * 当前默认关卡：world-strip 线性演示（首次进场没指定 levelId 时用）。
 * 关卡表 / BGM 表 / strip 表的真正来源在 `data/levels/index.ts`。
 */
const DEFAULT_LEVEL: LevelDef = LEVEL_WORLD_STRIP_DEMO

export class GameplayScene extends Phaser.Scene {
  // ---- 核心系统 ----
  private player!: Player
  private playerBullets!: BulletPool
  private inputSystem!: InputSystem
  private skillManager!: SkillManager
  private cameraDirector!: CameraDirector
  private parallax!: ParallaxSystem
  private screenBounds!: ScreenBoundsSystem
  private levelRunner!: LevelRunner
  /** 仅 world-strip 关卡会创建；普通关卡留 null */
  private worldStrip: WorldStripSystem | null = null
  private phaseController!: PhaseController
  private dialogueRunner!: DialogueRunner

  // ---- 抽出来的 manager / controller ----
  private enemies!: EnemyManager
  private bgm!: BgmController
  private completion!: LevelCompletion
  private dialogueBridge!: DialogueBridge

  /** 初始从上一场景 / 重启带来的启动数据 */
  private initData: IGameplaySceneData = {}

  /** 当前关卡 def（缓存一次避免 update 里反复 getDef） */
  private levelDef!: LevelDef

  /** 保存滚动模式；update 里依据它决定 ScreenBoundsSystem 是否启用 */
  private savedScrollMode: 'auto-right' | 'follow' | 'locked' = 'auto-right'

  /** debug 开关；开启时画物理调试形状、打印 phase 切换 */
  private readonly debug = false

  constructor() {
    super({ key: SCENE_KEYS.GAMEPLAY })
  }

  init(data: IGameplaySceneData): void {
    console.log('[GameplayScene.init]', data)
    this.initData = data ?? {}
  }

  // =========================================================================
  // create
  // =========================================================================

  create(): void {
    // ---- 1. 选关卡 ----
    const levelId = this.initData.levelId ?? DEFAULT_LEVEL.id
    const level = LEVEL_REGISTRY[levelId] ?? DEFAULT_LEVEL
    console.log(`[GameplayScene.create] levelId=${levelId} → ${level.id}`)
    this.levelDef = level
    this.cameras.main.setBackgroundColor('#1a1a2e')

    // ---- 2. 关卡物化 ----
    this.levelRunner = new LevelRunner(this)
    this.levelRunner.load(level)
    if (this.initData.startCheckpointId) {
      this.levelRunner.setActiveCheckpoint(this.initData.startCheckpointId)
    }

    const stripBuild = WORLD_STRIP_LEVELS[level.id]
    this.worldStrip = stripBuild ? new WorldStripSystem(this, stripBuild) : null

    // ---- 3. 玩家 + 子弹池 ----
    const spawn = this.levelRunner.getActiveSpawn()
    this.player = new Player(this, spawn.x, spawn.y)

    this.playerBullets = new BulletPool(this, 'bullet', POOL_SIZES.PLAYER_BULLETS)
    // 把玩家子弹 group 塞到 scene.data，BossPhase 需要它建 overlap
    this.data.set('playerBulletsGroup', this.playerBullets.group)

    // ---- 4. Input + Skill 系统 ----
    this.inputSystem = new InputSystem(this)
    this.inputSystem.bindDefaults()
    this.inputSystem.on((action, phase) => this.player.onAction(action, phase))

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
      this.skillManager.unlock(skillId)
      if (skillId === SKILL_IDS.FLIGHT) this.skillManager.equip(SKILL_IDS.FLIGHT)
    }

    // ---- 5. 相机 ----
    this.setupCamera(level, spawn)

    // ---- Boss 场景专属：强制装备飞行 + 换上"悬浮平台"sprite ----
    // world-strip-boss 是空中 boss 战；进来即飞，视觉上换浮空平台贴图。
    // 必须在 unlockedSkills 回放之后触发，避免 FlyCapability 二次 attach。
    if (level.id === LEVEL_WORLD_STRIP_BOSS.id) {
      this.skillManager.unlock(SKILL_IDS.FLIGHT)
      this.skillManager.equip(SKILL_IDS.FLIGHT)
      this.player.useStaticSprite('player-floating-platform')
    }

    // ---- 6. 视差 + 屏幕边界 ----
    this.parallax = new ParallaxSystem(this, this.cameraDirector)
    this.parallax.loadBackground(level.background)
    this.parallax.loadForeground(level.foreground)

    this.screenBounds = new ScreenBoundsSystem(this.cameraDirector, {
      clampY: this.player.isFlying,
    })
    this.screenBounds.setTarget(this.player.sprite)
    this.screenBounds.setEnabled(this.savedScrollMode === 'auto-right')
    this.screenBounds.onCrush(() => {
      if (this.player.alive) this.player.kill('crush')
    })

    // ---- 7. Dialogue + Phases ----
    // dialogueBridge 只能在 phaseController + skillManager 都建好后建（commands 走 skillManager）
    this.dialogueRunner = new DialogueRunner((cmd) => this.dialogueBridge.handleCommand(cmd))
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

    this.dialogueBridge = new DialogueBridge({
      scene: this,
      player: this.player,
      levelRunner: this.levelRunner,
      phaseController: this.phaseController,
      skillManager: this.skillManager,
    })
    this.inputSystem.on(this.dialogueBridge.onInputAction)

    // ---- 8. 敌人系统 ----
    this.enemies = new EnemyManager(this, this.phaseController, level, {
      isInSettlement: () => this.completion.inSettlement,
    })

    // ---- 9. BGM + LevelCompletion（必须在 enemies 之后，despawnAll 回调要它）----
    this.bgm = new BgmController(this)
    this.completion = new LevelCompletion({
      scene: this,
      player: this.player,
      levelDef: this.levelDef,
      levelRunner: this.levelRunner,
      cameraDirector: this.cameraDirector,
      skillManager: this.skillManager,
      bgm: this.bgm,
      despawnAllEnemies: () => this.enemies.despawnAll(),
    })

    // ---- 10. 物理碰撞 ----
    setupWorldCollisions({
      scene: this,
      player: this.player,
      playerBullets: this.playerBullets,
      levelRunner: this.levelRunner,
      onPickup: makePickupHandler({
        levelRunner: this.levelRunner,
        skillManager: this.skillManager,
        cameraDirector: this.cameraDirector,
      }),
    })
    this.enemies.setupCollisions(this.player, this.playerBullets)

    // ---- 11. EventBus 连线 ----
    eventBus.on(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.on(EVENT_KEYS.GAME_RESUME, this.handleResume)
    eventBus.on(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.on(EVENT_KEYS.PLAYER_DIED, this.handlePlayerDied)
    eventBus.on(EVENT_KEYS.PLAYER_DAMAGED, this.handlePlayerDamagedSfx)
    this.events.on(SCENE_EVENT_BOSS_PHASE_CLEARED, this.completion.bossPhaseCleared)

    // ---- 12. 初始状态同步给 HUD ----
    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: this.player.hp,
      max: this.player.maxHp,
    } satisfies PlayerHpChangedPayload)
    console.log(`[GameplayScene.create] → emit LEVEL_STARTED (${this.levelDef.id})`)
    eventBus.emit(EVENT_KEYS.LEVEL_STARTED, {
      levelId: this.levelDef.id,
      fromTransition: this.initData.fromTransition === true,
    } satisfies LevelStartedPayload)

    // ---- 13. BGM 起播 + shutdown 注册 ----
    this.bgm.start(this.levelDef.id)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown)

    if (this.debug) {
      this.physics.world.createDebugGraphic()
      eventBus.on(EVENT_KEYS.PHASE_CHANGED, (payload: unknown) => {
        console.log('[GameplayScene] phase:', payload)
      })
    }
  }

  /** 相机初始化 + bounds + scroll 模式分派；提取出来让 create() 不被它撑坏。 */
  private setupCamera(level: LevelDef, spawn: { x: number; y: number }): void {
    this.cameraDirector = new CameraDirector(this)
    // loop 模式下相机 X 边界设成"事实上无限"，让 auto-scroll 一直跑下去
    const cameraWorldW = level.loop === true ? LOOP_WORLD_MAX_X : level.width
    this.cameraDirector.setBounds(0, 0, cameraWorldW, level.height)
    // 世界比相机高时把相机 Y 锁在底部；≤ 相机高度则为 0
    const cameraY = Math.max(0, level.height - this.cameras.main.height)
    // 初始相机 X：让玩家横向落在屏幕正中央（auto-scroll 会把他慢慢往左挤）
    const halfCameraW = this.cameras.main.width / 2
    const scrollMode = level.scroll?.mode ?? 'auto-right'
    this.savedScrollMode = scrollMode
    if (scrollMode === 'auto-right') {
      const speed: number = level.scroll?.speed ?? SCROLL_TUNING.DEFAULT_SPEED
      this.cameraDirector.autoScrollRight(speed)
      this.cameras.main.setScroll(Math.max(0, spawn.x - halfCameraW), cameraY)
    } else if (scrollMode === 'follow') {
      this.cameraDirector.follow(this.player.sprite)
      this.cameras.main.setScroll(this.cameras.main.scrollX, cameraY)
    } else {
      this.cameraDirector.lock(spawn.x, spawn.y)
    }
    // 把 director 塞到 scene.data 供 phase 按名查
    this.data.set('cameraDirector', this.cameraDirector)
  }

  // =========================================================================
  // update
  // =========================================================================

  update(time: number, delta: number): void {
    // ---- 始终运行：输入 + 相位控制器 ----
    this.inputSystem.update(time, delta)
    this.phaseController.update(time, delta)

    // 冻结世界的 phase（Dialogue / Respawn / 将来 Cutscene）跳过所有世界推进。
    if (this.phaseController.getCurrent()?.freezesWorld === true) return
    // 结算态：boss 刚击破，世界冻结让 BOSS_VICTORY 面板独占注意力。
    if (this.completion.inSettlement) return

    // ---- 世界更新 ----
    this.player.update(time, delta)
    this.playerBullets.cull(time)
    this.enemies.update(time, this.cameras.main.scrollX, this.cameras.main)
    this.cameraDirector.update(time, delta)
    this.parallax.update(time, delta)

    // 飞行态下开启 Y 夹紧；auto-scroll 关卡里 screenBounds 始终保持开启。
    this.screenBounds.setConfig({ clampY: this.player.isFlying })
    this.screenBounds.setEnabled(this.savedScrollMode === 'auto-right')
    this.screenBounds.update(time, delta)

    // 滑动窗口式生成 platform / hazard / checkpoint（非 loop 关卡下自身早 return）
    const cam = this.cameras.main
    this.levelRunner.tickSpawner(cam.scrollX, cam.width)
    this.worldStrip?.tickSpawner(cam.scrollX, cam.width)
    this.dialogueBridge.tick()

    // 仅 running phase 才做摔死 / 过关 / boss-trigger 检测
    const phaseId = this.phaseController.getCurrentId()
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
          // 清掉所有非 boss 敌人（飞兵 + 代码雨），不让 boss UI 被覆盖
          this.enemies.despawnAll()
          this.phaseController.transition(PHASE_IDS.BOSS, {
            bossDef,
            levelId: this.levelDef.id,
            nextLevelId: trigger.nextLevelId,
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
      if (exit) this.completion.completeLevel(exit.nextLevelId)
    }
  }

  // =========================================================================
  // EventBus 监听器
  // =========================================================================

  private readonly handlePause = (): void => {
    this.scene.pause()
    this.bgm.pause()
  }

  private readonly handleResume = (): void => {
    this.scene.resume()
    this.bgm.resume()
  }

  private readonly handleRestart = (): void => {
    this.scene.restart({
      startCheckpointId: undefined,
      levelId: this.levelDef?.id,
    } satisfies IGameplaySceneData)
  }

  /**
   * Scene 护栏：die() → emit PLAYER_DIED → 本 handler 的同步链路可能在
   * scene shutdown / 还没 create 完的中间态被触发。两道闸：
   *   1) `scene.isActive()`：scene 不在 RUNNING 就彻底不处理
   *   2) `physics?.world` 兜一下边角 SHUTDOWN 但状态还没翻的一帧
   */
  private readonly handlePlayerDied = (): void => {
    if (!this.scene.isActive()) return
    if (!this.physics?.world) return
    if (this.phaseController.getCurrentId() === (PHASE_IDS.RESPAWN as PhaseId)) return
    this.phaseController.transition(PHASE_IDS.RESPAWN)
  }

  /**
   * 受击短音效。Player.damage 已经做过无敌帧 / `_alive` 过滤，事件发出来
   * 就说明是真打中。不在 Player.damage 里直接 sound.play 是为了不耦合 audio 资源。
   */
  private readonly handlePlayerDamagedSfx = (): void => {
    playSfx(this, ASSET_KEYS.AUDIO.SFX_DAMAGE, AUDIO_TUNING.SFX_DAMAGE_VOLUME)
  }

  // =========================================================================
  // shutdown
  // =========================================================================

  private readonly handleShutdown = (): void => {
    console.log('[GameplayScene.shutdown]')
    eventBus.off(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.off(EVENT_KEYS.GAME_RESUME, this.handleResume)
    eventBus.off(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.off(EVENT_KEYS.PLAYER_DIED, this.handlePlayerDied)
    eventBus.off(EVENT_KEYS.PLAYER_DAMAGED, this.handlePlayerDamagedSfx)
    this.events.off(SCENE_EVENT_BOSS_PHASE_CLEARED, this.completion.bossPhaseCleared)

    // 销毁顺序：从外到内。每一步独立 try/catch ——
    // Phaser 4 在 scene shutdown 时内部系统的拆解顺序不确定；某些 destroy()
    // 在这里可能抛（例如早期 FlyingEnemyPool 在 Phaser 把 group.children 置空后崩）。
    // 一旦抛出，后续 destroy 会被跳过、Phaser 自身 shutdown 也会中断 ——
    // 表现为"下一个 scene 永远不 create"。safeDestroy 保证每一步都跑完。
    const safeDestroy = (label: string, fn: () => void): void => {
      try {
        fn()
      } catch (err) {
        console.warn(`[GameplayScene.shutdown] ${label} destroy threw (non-fatal):`, err)
      }
    }

    safeDestroy('completion', () => this.completion?.destroy())
    safeDestroy('bgm', () => this.bgm?.destroy())
    safeDestroy('phaseController', () => this.phaseController?.destroy())
    safeDestroy('dialogueRunner', () => this.dialogueRunner?.destroy())
    safeDestroy('dialogueBridge', () => this.dialogueBridge?.destroy())
    safeDestroy('skillManager', () => this.skillManager?.destroy())
    safeDestroy('screenBounds', () => this.screenBounds?.destroy())
    safeDestroy('parallax', () => this.parallax?.destroy())
    safeDestroy('worldStrip', () => {
      this.worldStrip?.destroy()
      this.worldStrip = null
    })
    safeDestroy('cameraDirector', () => this.cameraDirector?.destroy())
    safeDestroy('inputSystem', () => this.inputSystem?.destroy())
    safeDestroy('enemies', () => this.enemies?.destroy())
    safeDestroy('playerBullets', () => this.playerBullets?.destroy())
    safeDestroy('player', () => this.player?.destroy())
    safeDestroy('levelRunner', () => this.levelRunner?.destroy())
  }
}
