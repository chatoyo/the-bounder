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
  ASSET_KEYS,
  AUDIO_TUNING,
  BOSS_TRANSITION_LEVEL_ID,
  CAPABILITY_IDS,
  CODE_DANMAKU_TUNING,
  EVENT_KEYS,
  FLYING_ENEMY_TUNING,
  GAME_CONFIG,
  PHASE_IDS,
  POOL_SIZES,
  SCENE_KEYS,
  SCROLL_TUNING,
  SKILL_IDS,
} from '../constants'
import type {
  ActionId,
  BossTriggerSegmentDef,
  BossVictoryPayload,
  CheckpointReachedPayload,
  DialogueCommand,
  IGameplaySceneData,
  LevelDef,
  LevelCompletedPayload,
  LevelStartedPayload,
  PhaseId,
  PickupCollectedPayload,
  PlayerHpChangedPayload,
  SkillId,
} from '../types'
import { ACTION_IDS } from '../constants'
import { LEVEL_01 } from '../data/levels/level-01'
import { LEVEL_02 } from '../data/levels/level-02'
import {
  LEVEL_WORLD_STRIP_DEMO,
  WORLD_STRIP_LEVELS,
} from '../data/levels/world-strip-demo'
import { LEVEL_WORLD_STRIP_BOSS } from '../data/levels/world-strip-boss'
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
import { CodeDanmakuPool } from '../entities/enemies/code-danmaku-pool'
import { FlyingEnemyPool } from '../entities/enemies/flying-enemy-pool'
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

const eventBus = useEventBus()

/** 关卡表：id → LevelDef。新增关卡只要 import + 加一行。 */
const LEVEL_REGISTRY: Readonly<Record<string, LevelDef>> = {
  [LEVEL_01.id]: LEVEL_01,
  [LEVEL_02.id]: LEVEL_02,
  [LEVEL_WORLD_STRIP_DEMO.id]: LEVEL_WORLD_STRIP_DEMO,
  // world-strip-demo 的 level-exit 会 scene.restart 到这一关；单图 boss 场景 + 终极结算。
  [LEVEL_WORLD_STRIP_BOSS.id]: LEVEL_WORLD_STRIP_BOSS,
}

/**
 * 当前默认关卡。Demo commit：切到 world-strip 演示（可变宽底图 + 循环地面轮廓）；
 * 要回到 LEVEL_01 只改这一行。
 */
const DEFAULT_LEVEL: LevelDef = LEVEL_WORLD_STRIP_DEMO

/**
 * 启用"Matrix 代码弹幕雨"的关卡集合。设计上就是"Boss 战之前"的过渡关卡 ——
 * 给玩家营造"越靠近 boss 越觉得世界在崩"的氛围，同时练一练在 auto-scroll 里
 * 躲 / 击落飞来物的手感。
 *
 * 维护边界：
 *   - BossPhase 进场 / 结算时会清场（不让代码雨盖在 boss UI 上）；
 *   - 只在 running phase + 非 settlement 时 spawn。
 *   - 新关卡想加就加一行；目前只 `world-strip-demo` 一关。
 */
const CODE_DANMAKU_LEVELS: ReadonlySet<string> = new Set([LEVEL_WORLD_STRIP_DEMO.id])

/**
 * 关卡 id → Phaser audio key 的映射。`startBgmForLevel` 按当前关卡查表；
 * 未声明的关卡跑静音（不影响场景正确性，只是没音乐）。
 *
 * 当前只有一首曲子（Rust City）；把新曲加到 `ASSET_KEYS.AUDIO` + `BGM_URLS`
 * + `BootScene.preload` 之后，在此添加一行即可。复用同一首曲子（例如
 * `world-strip-demo` 暂借 level-01 的 BGM）也无所谓 —— key 相同只加载一次。
 */
const LEVEL_BGM: Readonly<Record<string, string | undefined>> = {
  [LEVEL_01.id]: ASSET_KEYS.AUDIO.BGM_LEVEL_01,
  // level-02 暂无专属 BGM → 静音
  [LEVEL_WORLD_STRIP_DEMO.id]: ASSET_KEYS.AUDIO.BGM_LEVEL_01,
  // Boss 场景专属 BGM（ok6.mp3） —— scene.restart 进 boss 时 startBgmForLevel
  // 会加载这个 key；GameplayScene.completeLevel 会先把上一关的 BGM 停掉，
  // 让 BossTransitionOverlay 播放视频期间无背景音干扰。
  [LEVEL_WORLD_STRIP_BOSS.id]: ASSET_KEYS.AUDIO.BGM_BOSS,
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
  /** 仅 world-strip 关卡会创建；普通关卡留 null */
  private worldStrip: WorldStripSystem | null = null
  private phaseController!: PhaseController
  private dialogueRunner!: DialogueRunner
  /** 小飞兵对象池 —— 仅 running phase 用定时器 spawn；BossPhase 进入时清场 */
  private flyingEnemies!: FlyingEnemyPool
  /** 小飞兵 spawn 定时器（固定 interval；回调里按 phase 过滤） */
  private flyerSpawner!: Phaser.Time.TimerEvent
  /**
   * Matrix 代码弹幕池 —— 只在 `CODE_DANMAKU_LEVELS` 里的关卡创建；其它关卡为 null。
   * BossPhase 进入时 despawnAll；shutdown 时 destroy。
   */
  private codeDanmaku: CodeDanmakuPool | null = null
  /** 代码弹幕 spawn 定时器；同上，仅在 danmaku 关卡存在 */
  private codeDanmakuSpawner: Phaser.Time.TimerEvent | null = null
  /** 关卡 BGM（Level 01 = "Rust City"）。循环播放；pause/resume/shutdown 里同步暂停。 */
  private bgm: Phaser.Sound.BaseSound | null = null

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

  /**
   * 结算锁：true 时本 scene 处于 "boss 已击破 → 正在展示 BOSS_VICTORY 面板" 的
   * 冻结窗口（camera locked + physics paused）。update() / spawnFlyer 等要据此跳过。
   */
  private inSettlement = false

  /**
   * world-strip-demo → world-strip-boss 过场视频（`BossTransitionOverlay`）结束
   * 的一次性回调；`completeLevel` 在触发 boss 过场时安装、视频 ended 时触发、
   * shutdown 时兜底 off 掉（若玩家在视频中途切出本页面）。
   */
  private pendingBossTransitionListener: (() => void) | null = null

  /**
   * 终极 boss 好结局视频（`BossEndingOverlay` 播 `good_ending.mp4`）结束的
   * 一次性回调；`onBossPhaseCleared` 在终极 boss（无 nextLevelId）结算时安装、
   * 视频 ended / skip / error / 看门狗 时触发，然后才 emit `BOSS_VICTORY`
   * 打开 `BossVictoryOverlay`。shutdown 时同步摘掉避免泄漏到下一 scene。
   */
  private pendingBossEndingListener: (() => void) | null = null

  constructor() {
    super({ key: SCENE_KEYS.GAMEPLAY })
  }

  init(data: IGameplaySceneData): void {
    console.log('[GameplayScene.init]', data)
    this.initData = data ?? {}
    this.npcs = new Map()
    this.currentNpcInRange = null
    this.seenNpcs = new Set()
    this.inSettlement = false
    // scene.restart 不会重新运行 constructor，class field initializer 不会生效；
    // 这里显式重置，避免上一场景的 "等待视频结束" listener 泄漏到新 scene。
    this.pendingBossTransitionListener = null
    this.pendingBossEndingListener = null
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

    // World-strip 关卡：准备 WorldStripSystem。普通关卡 null 即可。
    const stripBuild = WORLD_STRIP_LEVELS[level.id]
    this.worldStrip = stripBuild ? new WorldStripSystem(this, stripBuild) : null

    // ---- 3. 玩家 ----
    const spawn = this.levelRunner.getActiveSpawn()
    this.player = new Player(this, spawn.x, spawn.y)

    // ---- 4. 子弹池 + 小飞兵池 ----
    this.playerBullets = new BulletPool(this, 'bullet', POOL_SIZES.PLAYER_BULLETS)
    // 把玩家子弹 group 塞到 scene.data，BossPhase 需要它建 overlap
    this.data.set('playerBulletsGroup', this.playerBullets.group)

    this.flyingEnemies = new FlyingEnemyPool(this, 'enemy-flyer', POOL_SIZES.FLYING_ENEMIES)

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
    // 世界比相机高（例如 world-strip 的 672×600）时，把相机 Y 锁在底部，让
    // 玩家能看到地面；世界 ≤ 相机高度则为 0，行为不变。
    const cameraY = Math.max(0, level.height - this.cameras.main.height)
    // 初始相机 X：让玩家横向落在屏幕正中。以前用固定 200 偏移会把玩家推到
    // 1/4 位置，spawn.x 较小时还会被 bounds 夹到屏幕最左 —— 现在统一用
    // `cam.width / 2`。auto-scroll 会把玩家慢慢往左挤（BASE_FORWARD_RATIO=0.8），
    // 所以居中起步正好给玩家最大的反应余量。
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


    // ---- Boss 场景专属：强制装备飞行 + 换上"悬浮平台"sprite ----
    //
    // world-strip-boss 是空中 boss 战：玩家应当一进来就能飞，不管前面关卡有没有捡
    // 飞行 orb。同时视觉上换到 `player-floating-platform` 贴图（自带浮空平台），
    // 把"现在是飞行战斗"这件事一眼传达给玩家。
    //
    // 执行顺序要求：必须在 `initData.unlockedSkills` 回放后触发，否则这里 equip 完
    // 的 FlyCapability 会被后续 unlockedSkills 的 equip(FLIGHT) 二次 attach（equip
    // 内部对已 equipped 的 id 会早退，但保险起见放在回放之后更直白）。
    // 只针对 world-strip-boss 生效；其它关卡行为不变。
    if (level.id === LEVEL_WORLD_STRIP_BOSS.id) {
      this.skillManager.unlock(SKILL_IDS.FLIGHT)
      this.skillManager.equip(SKILL_IDS.FLIGHT)
      this.player.useStaticSprite('player-floating-platform')
    }

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
        // 短音效：只在"新激活" checkpoint 时响一次 —— 复活后再滑过同一个
        // checkpoint、或 loop 关卡里每个 chunk 复制出来的 checkpoint 重复触碰，
        // `res.changed === false` 不响，避免回跑 / 循环世界变成一路叮叮叮。
        playSfx(this, ASSET_KEYS.AUDIO.SFX_CHECKPOINT, AUDIO_TUNING.SFX_CHECKPOINT_VOLUME)
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

    // 小飞兵 vs 玩家 → 扣血 + 飞兵回池
    this.physics.add.overlap(
      this.player.sprite,
      this.flyingEnemies.group,
      (_playerGO, flyerGO) => {
        if (!this.player.alive) return
        const s = flyerGO as Phaser.Physics.Arcade.Sprite
        if (!s.active) return
        this.flyingEnemies.kill(s)
        this.player.damage(FLYING_ENEMY_TUNING.CONTACT_DAMAGE, 'enemy')
      },
    )

    // 玩家子弹 vs 小飞兵 → 双方销毁
    this.physics.add.overlap(
      this.playerBullets.group,
      this.flyingEnemies.group,
      (bulletGO, flyerGO) => {
        const b = bulletGO as Phaser.Physics.Arcade.Sprite
        const s = flyerGO as Phaser.Physics.Arcade.Sprite
        if (!b.active || !s.active) return
        this.playerBullets.kill(b)
        this.flyingEnemies.kill(s)
        // 击落小飞兵短音效；和 boss 命中共用 key → 打击感统一
        playSfx(this, ASSET_KEYS.AUDIO.SFX_ENEMY_HIT, AUDIO_TUNING.SFX_ENEMY_HIT_VOLUME)
      },
    )

    // 小飞兵 spawner —— 固定 interval；回调里按 phase 过滤，避免 boss / respawn / dialogue
    // 期间硬刷（BossPhase.enter 里也会主动 despawnAll()）。
    this.flyerSpawner = this.time.addEvent({
      delay: FLYING_ENEMY_TUNING.SPAWN_INTERVAL_MS,
      loop: true,
      callback: this.spawnFlyer,
      callbackScope: this,
    })

    // ---- Matrix 代码弹幕 —— 仅"通往 Boss 战"的关卡 ----
    //
    // 设计意图：world-strip-demo 是 Boss 战前的 runner 关卡；加上绿色代码雨让
    // 玩家"越跑越觉得世界在崩"。Boss 场景里玩家已经切到飞行 + 世界停，代码雨
    // 会挡视线、还没好处 → 这一关结束就自然关掉（BossPhase.enter 里再手动
    // despawnAll，防止 level-exit 场景切换的瞬间残留一两条字符）。
    if (CODE_DANMAKU_LEVELS.has(level.id)) {
      this.codeDanmaku = new CodeDanmakuPool(this, POOL_SIZES.CODE_DANMAKU)

      // 接触玩家 → 扣血 + 弹幕回池
      this.physics.add.overlap(
        this.player.sprite,
        this.codeDanmaku.group,
        (_playerGO, danGO) => {
          if (!this.player.alive) return
          const pool = this.codeDanmaku
          if (!pool) return
          const t = danGO as Phaser.GameObjects.Text
          if (!t.active) return
          pool.kill(t)
          this.player.damage(CODE_DANMAKU_TUNING.CONTACT_DAMAGE, 'enemy')
        },
      )

      // 玩家子弹 vs 代码弹幕 → 双方回池 / 销毁
      this.physics.add.overlap(
        this.playerBullets.group,
        this.codeDanmaku.group,
        (bulletGO, danGO) => {
          const pool = this.codeDanmaku
          if (!pool) return
          const b = bulletGO as Phaser.Physics.Arcade.Sprite
          const t = danGO as Phaser.GameObjects.Text
          if (!b.active || !t.active) return
          this.playerBullets.kill(b)
          pool.kill(t)
        },
      )

      this.codeDanmakuSpawner = this.time.addEvent({
        delay: CODE_DANMAKU_TUNING.SPAWN_INTERVAL_MS,
        loop: true,
        callback: this.spawnCodeDanmaku,
        callbackScope: this,
      })
    }

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
    eventBus.on(EVENT_KEYS.PLAYER_DAMAGED, this.handlePlayerDamagedSfx)

    // Boss phase 清场 → 关卡完成
    this.events.on(SCENE_EVENT_BOSS_PHASE_CLEARED, this.onBossPhaseCleared)

    // ---- 14. 初始状态同步给 HUD ----
    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: this.player.hp,
      max: this.player.maxHp,
    } satisfies PlayerHpChangedPayload)

    // 通知 Vue 侧"本场新关卡已就绪" —— LevelTransitionOverlay 据此关闭过渡面板。
    // fromTransition = 区分"游戏首次挂载"和"上一关刚结束 → scene.restart"，前者
    // 不会有 LEVEL_COMPLETED 先发生，Vue 侧可以据此决定是否有 in-animation。
    console.log(`[GameplayScene.create] → emit LEVEL_STARTED (${this.levelDef.id})`)
    eventBus.emit(EVENT_KEYS.LEVEL_STARTED, {
      levelId: this.levelDef.id,
      fromTransition: this.initData.fromTransition === true,
    } satisfies LevelStartedPayload)

    // ---- 15. BGM 起播（当前仅 level-01 → rust-city；其他关卡可在此按 levelId 分支） ----
    this.startBgmForLevel()

    // ---- 16. shutdown 清理 ----
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

    // 结算态：boss 刚击破，正在展示 BOSS_VICTORY 面板；phase 已经切回 running，
    // 但我们故意让世界冻结（锁相机 + 暂停物理）把注意力全留给 Vue 覆盖层。
    // 同样跳过所有世界系统，只保留 inputSystem + phaseController 的驱动（已在上面跑过）。
    if (this.inSettlement) return

    // ---- 世界更新 ----
    this.player.update(time, delta)
    this.playerBullets.cull(time)
    // 小飞兵：boss / running phase 都要 tick —— running 下正常刷，boss 下已经 despawnAll 过，
    // 这里 no-op 但要让 cull / sin 摆动流程对称。
    this.flyingEnemies.update(time, this.cameras.main.scrollX)
    // 代码弹幕：同样每帧 tick（cull 离屏 + 字形闪烁）；boss 后清场了也只是全部
    // 跳过活体检查，开销极低。
    this.codeDanmaku?.update(time, this.cameras.main)

    this.cameraDirector.update(time, delta)
    this.parallax.update(time, delta)

    // 飞行态下开启 Y 夹紧
    this.screenBounds.setConfig({ clampY: this.player.isFlying })
    // auto-scroll 关卡里 screenBounds 始终保持开启 —— boss phase 也不再关掉
    // （BossPhase 现在保持世界流动，若关 screenBounds 玩家就能一直向左飞出屏幕）。
    const phaseId = this.phaseController.getCurrentId()
    this.screenBounds.setEnabled(this.savedScrollMode === 'auto-right')
    this.screenBounds.update(time, delta)

    // 水平无限循环：让 LevelRunner 根据相机位置维护 platform / hazard /
    // checkpoint 的前后生成（非 loop 关卡下 tickSpawner 自己早 return）。
    const cam = this.cameras.main
    this.levelRunner.tickSpawner(cam.scrollX, cam.width)
    // World-strip 关卡：无论 loop / 非 loop 都要 tick（非 loop 下系统自己只保留 chunk 0，
    // 首帧把底图铺上、后续帧几乎是 no-op）。
    this.worldStrip?.tickSpawner(cam.scrollX, cam.width)

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
          // 清掉所有在场小飞兵，避免 boss 登场时屏幕还飘着一片杂兵
          this.flyingEnemies.despawnAll()
          // 同理清掉代码弹幕 —— Boss HUD 在上方居中，一堆绿字符盖在血条上既糊
          // 又干扰读血量。虽然本关 `CODE_DANMAKU_LEVELS` 只有 `world-strip-demo`
          // （没有 boss-trigger），但保险起见放在这儿，未来给其它关加 boss
          // 时不必再漏一处。
          this.codeDanmaku?.despawnAll()
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

  /**
   * 小飞兵刷新回调 —— 固定 interval；仅 running phase + 非结算态 下才刷。
   * spawn 坐标：相机视口右缘外 SPAWN_MARGIN 像素，Y 随机在 [SPAWN_Y_MIN, SPAWN_Y_MAX]。
   */
  private spawnFlyer = (): void => {
    if (this.inSettlement) return
    if (this.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return
    const cam = this.cameras.main
    const T = FLYING_ENEMY_TUNING
    const x = cam.scrollX + cam.width + T.SPAWN_MARGIN
    const y = T.SPAWN_Y_MIN + Math.random() * (T.SPAWN_Y_MAX - T.SPAWN_Y_MIN)
    this.flyingEnemies.spawn(x, y)
  }

  /**
   * Matrix 代码弹幕刷新回调 —— 每 tick 随机挑一种发射方式：
   *   - `horizontal`：自屏幕右缘水平向左飞过（最常见）。
   *   - `diag-tr-bl`：自右上角俯冲到左下角（"黑客帝国"经典斜角）。
   *   - `vertical`：自屏幕上缘垂直下落（像代码雨）。
   *
   * 每 tick 发射 SPAWN_BURST 条；即使某条 spawn 返回 null（池满）也不阻塞其它条。
   */
  private spawnCodeDanmaku = (): void => {
    if (this.inSettlement) return
    if (!this.codeDanmaku) return
    if (this.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return

    const cam = this.cameras.main
    const T = CODE_DANMAKU_TUNING

    for (let i = 0; i < T.SPAWN_BURST; i++) {
      const speed = T.SPEED_MIN + Math.random() * (T.SPEED_MAX - T.SPEED_MIN)
      // 方向轮盘：水平 50%、右上→左下 35%、垂直下落 15%
      const roll = Math.random()
      let x: number
      let y: number
      let vx: number
      let vy: number
      if (roll < 0.5) {
        // 水平：从右缘外 margin 位置向左飞
        x = cam.scrollX + cam.width + T.SPAWN_MARGIN
        y = cam.scrollY + T.SPAWN_Y_MIN + Math.random() * (T.SPAWN_Y_MAX - T.SPAWN_Y_MIN)
        vx = -speed
        vy = 0
      } else if (roll < 0.85) {
        // 右上 → 左下：从右缘 + 顶部一小段 Y 区间出发，斜着扎向左下
        x = cam.scrollX + cam.width + T.SPAWN_MARGIN
        // Y 只在上半屏出发，才能"斜着扎到"下半屏
        const topBand = T.SPAWN_Y_MIN + Math.random() * Math.max(40, (T.SPAWN_Y_MAX - T.SPAWN_Y_MIN) * 0.4)
        y = cam.scrollY + topBand
        // 45° 左下
        const c = Math.SQRT1_2 // cos(45)=sin(45)≈0.707
        vx = -speed * c
        vy = speed * c
      } else {
        // 垂直下落：从顶部出发（"代码雨"本味）
        x = cam.scrollX + Math.random() * cam.width
        y = cam.scrollY - T.SPAWN_MARGIN
        vx = 0
        vy = speed
      }

      this.codeDanmaku.spawn(x, y, vx, vy)
    }
  }

  private onBossPhaseCleared = (): void => {
    // BossPhase 已经等过 2s 才派发本事件（见 BossPhase.onBossDefeated 的 delayedCall）。
    // 现在进入"结算"段：锁相机 + 暂停物理 + 打开 BossVictoryOverlay。
    //
    // nextLevelId 解析优先级：
    //   1) 触发本次 boss 的 BossTriggerSegmentDef.nextLevelId（BossPhase 存到 scene.data）
    //   2) 段里任意 level-exit 的 nextLevelId（非 loop 关卡的兜底）
    //   3) 都没有 → 终极 boss：结算面板常驻，不再调 completeLevel
    //
    // 2026-04-26 修订：以前 "loop 关卡 + 无 nextLevelId" 会跳过结算继续跑圈；现在把
    // 结算和转场拆开 —— 结算恒定发生，转场仅当 nextLevelId 有效时才安排。这样
    // world-strip-boss 这类 "终极 boss" 关卡打完能正常看到 BOSS_VICTORY 面板。
    //
    // 2026-04-26(v2) 修订：终极 boss（无 nextLevelId）结算前先播 `good_ending.mp4`
    // 过场动画 —— 锁相机 + 暂停物理的"冻结画面"保留在视频下面，视频结束后
    // BossVictoryOverlay 再淡入常驻（= "return to the original scene, which should
    // already have a 结算画面"）。普通 boss（有 nextLevelId）节奏不变。
    const fromTrigger = this.data.get('bossPhaseNextLevelId') as string | null | undefined
    const fromExit = (this.levelRunner.getDef().segments as readonly { type: string }[])
      .find((s) => s.type === 'level-exit') as { nextLevelId?: string } | undefined
    const nextLevelId = fromTrigger ?? fromExit?.nextLevelId

    // ---- 结算阶段 freeze ----
    // 锁相机 + 暂停物理 + 打 inSettlement 标记，让整个世界冻结在"最后一帧"的画面上，
    // Vue 覆盖层（先是 BossEndingOverlay 的视频，再是 BossVictoryOverlay 的面板）
    // 占据全部注意力。两个覆盖层都在这层 freeze 之上播放。
    this.inSettlement = true
    const snap = {
      x: this.cameras.main.scrollX + this.cameras.main.width / 2,
      y: this.cameras.main.scrollY + this.cameras.main.height / 2,
    }
    this.cameraDirector.lock(snap.x, snap.y)
    // `?.`：scene 处于异步收尾（例如玩家在 2s boss 死亡缓冲内发起 restart / 离开页面），
    // `physics.world` 可能已被 Phaser 置 null（ArcadePhysics.shutdown），跳过即可。
    this.physics.world?.pause()
    // spawner 本身不停（time.addEvent 的 paused 会被 physics.world.pause 连带影响），
    // 不过回调里的 inSettlement 检查已经兜底；这里再显式清场避免残影。
    this.flyingEnemies.despawnAll()
    this.codeDanmaku?.despawnAll()

    // 找到 boss 的 displayName：当前 phase 刚从 BOSS 退出，boss def 我们没留引用。
    // 退而求其次：按 bossPhaseLevelId 所在关卡的 boss-trigger 反查 BossDef。
    const bossDef = this.findLastFiredBossDef()
    const bossId = bossDef?.id ?? 'boss'
    const displayName = bossDef?.displayName ?? 'BOSS'

    // 结算面板 emission 抽成局部 helper —— 终极 boss 需要等视频结束再调，
    // 普通 boss 立即调；复用同一段"发 BOSS_VICTORY + 按需 schedule completeLevel"。
    const showVictoryPanel = (): void => {
      eventBus.emit(EVENT_KEYS.BOSS_VICTORY, {
        bossId,
        displayName,
        nextLevelId,
      } satisfies BossVictoryPayload)

      // 仅当指定了下一关时才调 completeLevel；否则 BossVictoryOverlay 常驻作为终章。
      // 有 nextLevelId 时总时序：boss 死 → 2s 缓冲 → 2.5s 结算面板 → 1.6s 过渡面板 → 新关卡就绪。
      if (nextLevelId) {
        this.time.delayedCall(2500, () => {
          this.completeLevel(nextLevelId)
        })
      }
    }

    if (!nextLevelId) {
      // ---- 终极 boss：good_ending.mp4 → 结算面板 ----
      //
      // 时序：BOSS_ENDING_START → BossEndingOverlay 播 good_ending.mp4 →
      //   ended / skip / error / watchdog → BOSS_ENDING_ENDED →
      //   showVictoryPanel() → BOSS_VICTORY → BossVictoryOverlay 常驻。
      //
      // BGM：没有下一关 = completeLevel 不会跑 = 关卡 BGM 不会被它清掉；所以
      // 这里主动 stop 一次，让视频音轨占据声场（视频本身若静音也无所谓，
      // 反正上一关 BGM 需要停）。
      console.log('[GameplayScene.onBossPhaseCleared] terminal boss → play good_ending.mp4')
      this.bgm?.stop()

      const onEndingEnded = (): void => {
        console.log('[GameplayScene] BOSS_ENDING_ENDED received → show BossVictoryOverlay')
        eventBus.off(EVENT_KEYS.BOSS_ENDING_ENDED, onEndingEnded)
        this.pendingBossEndingListener = null
        showVictoryPanel()
        playSfx(this, ASSET_KEYS.AUDIO.SFX_BOSS_DEFEATED, AUDIO_TUNING.SFX_BOSS_DEFEATED_VOLUME)
      }
      this.pendingBossEndingListener = onEndingEnded
      eventBus.on(EVENT_KEYS.BOSS_ENDING_ENDED, onEndingEnded)
      eventBus.emit(EVENT_KEYS.BOSS_ENDING_START)
    } else {
      // ---- 普通 boss：直接开结算 → 2.5s 后 completeLevel ----
      showVictoryPanel()
    }
  }

  /**
   * 反查本次被击破的 BossDef。由于 BossPhase 已经 exit，ctx 拿不到了；从当前关卡
   * 的 boss-trigger segments 里挑第一条 bossId 存在于 BOSS_REGISTRY 的即可。
   * loop 关卡 + 多 trigger 场景下可能不准，但 jam demo 每关最多一个 boss，够用。
   */
  private findLastFiredBossDef() {
    const segs = this.levelRunner.getDef().segments
    for (const s of segs) {
      if (s.type !== 'boss-trigger') continue
      const trig = s as BossTriggerSegmentDef
      const bd = BOSS_REGISTRY[trig.bossId]
      if (bd) return bd
    }
    return null
  }

  private completeLevel(nextLevelId?: string): void {
    if ((this.data.get('levelCompleted') as boolean) === true) return
    this.data.set('levelCompleted', true)

    eventBus.emit(EVENT_KEYS.LEVEL_COMPLETED, {
      levelId: this.levelDef.id,
      nextLevelId,
    } satisfies LevelCompletedPayload)

    // 停掉相机 + 物理
    // `?.`：和 onBossPhaseCleared 一样，completeLevel 可能在 shutdown / restart
    // 链路的边角被再次进入，`physics.world` 可能已为 null，跳过即可。
    this.physics.world?.pause()
    this.cameraDirector.lock(this.player.sprite.x, this.player.sprite.y)
    this.cameras.main.flash(400, 255, 255, 120)

    // 立刻停掉当前关卡 BGM —— 否则 BossTransitionOverlay 播放视频期间、或
    // LevelTransitionOverlay 展示过渡面板期间，上一关的 BGM 仍在循环。
    // shutdown 里的 safeDestroy 会兜底 destroy，但 stop 必须在 scene.restart
    // 之前发生，等到 shutdown 就已经晚了（视频整段都会伴着旧 BGM 在响）。
    if (this.bgm) {
      this.bgm.stop()
    }

    if (nextLevelId && LEVEL_REGISTRY[nextLevelId]) {
      const carryOver: SkillId[] = []
      if (this.skillManager.isUnlocked(SKILL_IDS.FLIGHT)) carryOver.push(SKILL_IDS.FLIGHT)

      // 真正执行 scene.restart。BossTransitionOverlay 发 BOSS_TRANSITION_ENDED 时
      // 我们的监听器是在一个 Vue DOM 事件 (`<video>` ended / timeupdate) 的回调栈
      // 里触发的；Phaser SceneManager 的 queueOp 理论上能应付同步调用，但保险起见
      // 先 `time.delayedCall(0, ...)` 把 restart 推到下一个 Phaser tick，让它在干净
      // 的 Phaser 生命周期里处理 —— 避免与"刚刚还在 Vue 事件栈里"这种外部调用栈
      // 的任何潜在竞态。另外把 physics.world 主动 resume 一次，防止旧 scene 的
      // `physics.world.pause()` 状态影响 restart 时序。
      const doRestart = (): void => {
        console.log(`[GameplayScene] scene.restart → levelId=${nextLevelId}, carryOver=${JSON.stringify(carryOver)}`)
        // 恢复物理（restart 自己会重建物理世界，但先显式 resume 避免 "paused → restart
        // → 新世界也瞬间 paused" 的边角 case）
        if (this.physics?.world?.isPaused) this.physics.world.resume()
        this.scene.restart({
          levelId: nextLevelId,
          unlockedSkills: carryOver,
          fromTransition: true,
        } satisfies IGameplaySceneData)
      }

      const scheduleRestart = (): void => {
        // 下一 tick 执行 —— 即使调用方在 Vue DOM event 栈里也能干净地 hand off 给 Phaser
        this.time.delayedCall(0, doRestart)
      }

      if (nextLevelId === BOSS_TRANSITION_LEVEL_ID) {
        // Boss 场景专用：`BossTransitionOverlay` 会播 boss_transition.mp4 —— 视频
        // 结束后发 BOSS_TRANSITION_ENDED，我们这才 scene.restart。视频时长通常 >
        // 1600ms，所以不能再用固定 delay。shutdown 里会兜底 off 掉 listener 避免泄漏。
        const onEnded = (): void => {
          console.log(`[GameplayScene] BOSS_TRANSITION_ENDED received → scene.restart → ${nextLevelId}`)
          eventBus.off(EVENT_KEYS.BOSS_TRANSITION_ENDED, onEnded)
          this.pendingBossTransitionListener = null
          scheduleRestart()
        }
        this.pendingBossTransitionListener = onEnded
        eventBus.on(EVENT_KEYS.BOSS_TRANSITION_ENDED, onEnded)
        console.log(`[GameplayScene] waiting for BOSS_TRANSITION_ENDED before restarting to ${nextLevelId}`)
      } else {
        // 常规过关：1600ms 的过渡预算让 Vue 的 LevelTransitionOverlay 完整淡入 +
        // 展示"载入下一关"文字，再由下一场景的 LEVEL_STARTED 触发淡出。
        this.time.delayedCall(1600, doRestart)
      }
    }
  }

  // =========================================================================
  // 监听器
  // =========================================================================

  // =========================================================================
  // BGM（真实音频资源；占位纹理和它们分开管）
  // =========================================================================

  /**
   * 根据当前 levelId 选 BGM，按 `LEVEL_BGM` 表查找。
   *   - 表里没有的关卡 → 静音（不报错）；
   *   - 表里有但 cache 里找不到（preload 漏加）→ 控制台 warn + 静音。
   *
   * audio 在 BootScene 里通过 `this.load.audio(key, url)` 预加载；这里只做
   * `sound.add` + play。play 可能被浏览器 autoplay 策略阻塞，Phaser 会在
   * 用户首次输入后自动 resume AudioContext；不要让 play 失败把场景带炸。
   */
  private startBgmForLevel(): void {
    const key = LEVEL_BGM[this.levelDef.id]
    if (!key) return
    if (!this.cache.audio.exists(key)) {
      console.warn(`[GameplayScene] BGM "${key}" 未加载（检查 BootScene.preload），跳过`)
      return
    }
    this.bgm = this.sound.add(key, {
      loop: true,
      volume: AUDIO_TUNING.GAME_VOLUME,
    })
    try {
      this.bgm.play()
    } catch (err) {
      console.warn('[GameplayScene] BGM play 阻塞（将在用户首次输入后恢复）:', err)
    }
  }

  private handlePause = (): void => {
    this.scene.pause()
    // scene.pause 不会停 sound manager；BGM 要手动暂停，否则暂停菜单下音乐仍在循环。
    this.bgm?.pause()
  }

  private handleResume = (): void => {
    this.scene.resume()
    this.bgm?.resume()
  }

  private handleRestart = (): void => {
    this.scene.restart({
      startCheckpointId: undefined,
      levelId: this.levelDef?.id,
    } satisfies IGameplaySceneData)
  }

  private handlePlayerDied = (): void => {
    // Scene 护栏：die() → emit PLAYER_DIED → 本 handler 的同步链路可能在
    // scene 已经 shutdown（Phaser 4 的 ArcadePhysics.shutdown 把 world 置 null）
    // 或还没 create 完的中间态里被触发。这种时候跑 transition(RESPAWN) 会在
    // RespawnPhase.enter 里崩在 `physics.world.pause()`。
    //
    // 两道闸：
    //   1) `scene.isActive()` —— scene 不在 RUNNING 状态（SHUTDOWN / SLEEPING
    //      / PAUSED）就彻底不处理。反正玩家死了，马上 restart / 下一关自己会
    //      重建 player + phase。
    //   2) `this.physics?.world` —— 即便 isActive() 为 true，也兜一下 world
    //      真的不在的场景（例如刚 SHUTDOWN 但 scene 状态还没翻到对应值的一帧）。
    if (!this.scene.isActive()) return
    if (!this.physics?.world) return
    if (this.phaseController.getCurrentId() === (PHASE_IDS.RESPAWN as PhaseId)) return
    this.phaseController.transition(PHASE_IDS.RESPAWN)
  }

  /**
   * 受击短音效 —— 挂在 PLAYER_DAMAGED 上。`Player.damage` 已经做过无敌帧 /
   * `_alive` 过滤，事件发出来就说明这一下"真的打中了"，直接响就好。
   *
   * 不在 `Player.damage` 里直接 `scene.sound.play`，是因为 Player 层本身不耦合
   * scene 的 audio 资源；由 scene 侧做"听事件 → 放音效"的翻译，未来换 sfx 系统
   * 只动这里一行。
   */
  private handlePlayerDamagedSfx = (): void => {
    playSfx(this, ASSET_KEYS.AUDIO.SFX_DAMAGE, AUDIO_TUNING.SFX_DAMAGE_VOLUME)
  }

  private handleShutdown = (): void => {
    console.log('[GameplayScene.shutdown]')
    eventBus.off(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.off(EVENT_KEYS.GAME_RESUME, this.handleResume)
    eventBus.off(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.off(EVENT_KEYS.PLAYER_DIED, this.handlePlayerDied)
    eventBus.off(EVENT_KEYS.PLAYER_DAMAGED, this.handlePlayerDamagedSfx)
    this.events.off(SCENE_EVENT_BOSS_PHASE_CLEARED, this.onBossPhaseCleared)
    // 若玩家在 boss 过场视频途中离开页面（退出到主页 / 直接 unmount Phaser），
    // completeLevel 挂的"等视频结束"一次性监听器要主动摘掉，避免泄漏到下一次 scene。
    if (this.pendingBossTransitionListener) {
      eventBus.off(EVENT_KEYS.BOSS_TRANSITION_ENDED, this.pendingBossTransitionListener)
      this.pendingBossTransitionListener = null
    }
    // 同理：若玩家在终极 boss 结局视频中途离开页面，onBossPhaseCleared 挂的
    // "等结局视频结束"一次性监听器也要摘掉。
    if (this.pendingBossEndingListener) {
      eventBus.off(EVENT_KEYS.BOSS_ENDING_ENDED, this.pendingBossEndingListener)
      this.pendingBossEndingListener = null
    }

    // 销毁顺序：从外到内。
    //
    // **关键**：每一步都单独 try/catch。Phaser 4 在 scene shutdown 时内部系统
    // 的拆解顺序不确定，某些 destroy() 在这里可能抛（例如早期版本的 FlyingEnemyPool
    // 在 Phaser 把 group.children 置空后 clear 会失败）。一旦抛出，后续的 destroy
    // 会被跳过、Phaser 自己的 shutdown 流程也会中断 —— 表现为"下一个 scene 永远不
    // create"（= boss 场景不加载）。用 safeDestroy 包起来保证每一步都跑完。
    const safeDestroy = (label: string, fn: () => void): void => {
      try {
        fn()
      } catch (err) {
        console.warn(`[GameplayScene.shutdown] ${label} destroy threw (non-fatal):`, err)
      }
    }

    safeDestroy('bgm', () => {
      this.bgm?.stop()
      this.bgm?.destroy()
      this.bgm = null
    })
    safeDestroy('flyerSpawner', () => this.flyerSpawner?.remove(false))
    safeDestroy('codeDanmakuSpawner', () => this.codeDanmakuSpawner?.remove(false))
    safeDestroy('phaseController', () => this.phaseController?.destroy())
    safeDestroy('dialogueRunner', () => this.dialogueRunner?.destroy())
    safeDestroy('npcs', () => {
      for (const npc of this.npcs.values()) npc.destroy()
      this.npcs.clear()
    })
    safeDestroy('skillManager', () => this.skillManager?.destroy())
    safeDestroy('screenBounds', () => this.screenBounds?.destroy())
    safeDestroy('parallax', () => this.parallax?.destroy())
    safeDestroy('worldStrip', () => {
      this.worldStrip?.destroy()
      this.worldStrip = null
    })
    safeDestroy('cameraDirector', () => this.cameraDirector?.destroy())
    safeDestroy('inputSystem', () => this.inputSystem?.destroy())
    safeDestroy('flyingEnemies', () => this.flyingEnemies?.destroy())
    safeDestroy('codeDanmaku', () => {
      this.codeDanmaku?.destroy()
      this.codeDanmaku = null
    })
    safeDestroy('playerBullets', () => this.playerBullets?.destroy())
    safeDestroy('player', () => this.player?.destroy())
    safeDestroy('levelRunner', () => this.levelRunner?.destroy())
  }
}
