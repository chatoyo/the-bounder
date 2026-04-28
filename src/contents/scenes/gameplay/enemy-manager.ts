/**
 * EnemyManager —— 关卡里所有"非 boss"敌人的池 / 刷新 / 碰撞 / 清场的统一入口。
 *
 * 现存敌人：
 *   - FlyingEnemyPool：所有 auto-scroll 关卡通用的小飞兵
 *   - CodeDanmakuPool：仅 `CODE_DANMAKU_LEVELS` 里的关卡（boss 战前氛围）
 *
 * 加新种敌人就在本类里新建池 + 在 `setupCollisions` / `update` / `despawnAll`
 * 里多挂一行；scene 不必感知具体敌人种类。
 *
 * 生命周期接口（与 scene 对齐）：
 *   - constructor：建池 + 起 spawner 定时器
 *   - setupCollisions(player, bullets)：scene 把玩家 sprite + 玩家子弹 group 给进来
 *   - update(time, scrollX, camera)：每帧 tick 池
 *   - despawnAll()：boss 登场 / 结算时清场
 *   - bulletGroupForPlayerOverlap：暴露 `playerBullets.group` 之外的"敌方子弹"group
 *     给 BossPhase 之类的消费方（暂时只有 codeDanmaku.group 这个用例，外面有需要再加）
 *   - destroy()：shutdown 链路
 */
import * as Phaser from 'phaser'
import {
  ASSET_KEYS,
  AUDIO_TUNING,
  CODE_DANMAKU_TUNING,
  FLYING_ENEMY_TUNING,
  PHASE_IDS,
  POOL_SIZES,
} from '@/contents/constants'
import { CodeDanmakuPool } from '@/contents/entities/enemies/code-danmaku-pool'
import { FlyingEnemyPool } from '@/contents/entities/enemies/flying-enemy-pool'
import { Player } from '@/contents/entities/player/player'
import { BulletPool } from '@/contents/entities/projectile/bullet-pool'
import type { LevelDef } from '@/contents/types'
import { PhaseController } from '@/contents/systems/phase-controller'
import { playSfx } from '@/contents/systems/sfx'

/**
 * 启用 Matrix 代码弹幕雨的关卡集合。设计上是"Boss 战之前"的过渡关卡。
 * 维护边界：
 *   - BossPhase 进场 / 结算时会清场（不让代码雨盖在 boss UI 上）；
 *   - 只在 running phase + 非 settlement 时 spawn。
 */
const CODE_DANMAKU_LEVELS: ReadonlySet<string> = new Set(['world-strip-demo'])

export interface EnemyManagerOptions {
  /** scene 端 inSettlement 标记的 getter；spawner 据此早 return */
  readonly isInSettlement: () => boolean
}

export class EnemyManager {
  /** 小飞兵 —— 所有 auto-scroll 关卡都建 */
  readonly flyingEnemies: FlyingEnemyPool
  /** Matrix 代码弹幕 —— 仅 `CODE_DANMAKU_LEVELS` 关卡建；其它关卡为 null */
  readonly codeDanmaku: CodeDanmakuPool | null
  /** 小飞兵刷新定时器 */
  private readonly flyerSpawner: Phaser.Time.TimerEvent
  /** 代码弹幕刷新定时器；同上，仅 danmaku 关卡存在 */
  private readonly codeDanmakuSpawner: Phaser.Time.TimerEvent | null = null

  private readonly scene: Phaser.Scene
  private readonly phaseController: PhaseController
  private readonly options: EnemyManagerOptions

  constructor(
    scene: Phaser.Scene,
    phaseController: PhaseController,
    levelDef: LevelDef,
    options: EnemyManagerOptions,
  ) {
    this.scene = scene
    this.phaseController = phaseController
    this.options = options
    this.flyingEnemies = new FlyingEnemyPool(scene, 'enemy-flyer', POOL_SIZES.FLYING_ENEMIES)

    this.codeDanmaku = CODE_DANMAKU_LEVELS.has(levelDef.id)
      ? new CodeDanmakuPool(scene, POOL_SIZES.CODE_DANMAKU)
      : null

    this.flyerSpawner = scene.time.addEvent({
      delay: FLYING_ENEMY_TUNING.SPAWN_INTERVAL_MS,
      loop: true,
      callback: this.spawnFlyer,
      callbackScope: this,
    })

    if (this.codeDanmaku) {
      this.codeDanmakuSpawner = scene.time.addEvent({
        delay: CODE_DANMAKU_TUNING.SPAWN_INTERVAL_MS,
        loop: true,
        callback: this.spawnCodeDanmaku,
        callbackScope: this,
      })
    }
  }

  /**
   * 把玩家 / 玩家子弹接进来挂物理 overlap。scene 在 player 和 bullets 都建好之后调一次。
   * （不放进 constructor 是因为 scene 端的 player / bullets 创建顺序固定，
   *  把"挂碰撞"和"建池"分开更易读。）
   */
  setupCollisions(player: Player, playerBullets: BulletPool): void {
    const { scene, flyingEnemies, codeDanmaku } = this

    // 小飞兵 vs 玩家 → 扣血 + 飞兵回池
    scene.physics.add.overlap(
      player.sprite,
      flyingEnemies.group,
      (_playerGO, flyerGO) => {
        if (!player.alive) return
        const s = flyerGO as Phaser.Physics.Arcade.Sprite
        if (!s.active) return
        flyingEnemies.kill(s)
        player.damage(FLYING_ENEMY_TUNING.CONTACT_DAMAGE, 'enemy')
      },
    )

    // 玩家子弹 vs 小飞兵 → 双方销毁 + 命中音效
    scene.physics.add.overlap(
      playerBullets.group,
      flyingEnemies.group,
      (bulletGO, flyerGO) => {
        const b = bulletGO as Phaser.Physics.Arcade.Sprite
        const s = flyerGO as Phaser.Physics.Arcade.Sprite
        if (!b.active || !s.active) return
        playerBullets.kill(b)
        flyingEnemies.kill(s)
        playSfx(scene, ASSET_KEYS.AUDIO.SFX_ENEMY_HIT, AUDIO_TUNING.SFX_ENEMY_HIT_VOLUME)
      },
    )

    if (codeDanmaku) {
      // 代码弹幕 vs 玩家 → 扣血 + 弹幕回池
      scene.physics.add.overlap(
        player.sprite,
        codeDanmaku.group,
        (_playerGO, danGO) => {
          if (!player.alive) return
          const t = danGO as Phaser.GameObjects.Text
          if (!t.active) return
          codeDanmaku.kill(t)
          player.damage(CODE_DANMAKU_TUNING.CONTACT_DAMAGE, 'enemy')
        },
      )
      // 玩家子弹 vs 代码弹幕 → 双方回收
      scene.physics.add.overlap(
        playerBullets.group,
        codeDanmaku.group,
        (bulletGO, danGO) => {
          const b = bulletGO as Phaser.Physics.Arcade.Sprite
          const t = danGO as Phaser.GameObjects.Text
          if (!b.active || !t.active) return
          playerBullets.kill(b)
          codeDanmaku.kill(t)
        },
      )
    }
  }

  /** 每帧 tick：所有池都要 update（cull / sin 摆动 / 字形闪烁）。 */
  update(time: number, scrollX: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    this.flyingEnemies.update(time, scrollX)
    this.codeDanmaku?.update(time, camera)
  }

  /** Boss 登场 / 关卡结算 时清场 */
  despawnAll(): void {
    this.flyingEnemies.despawnAll()
    this.codeDanmaku?.despawnAll()
  }

  destroy(): void {
    this.flyerSpawner?.remove(false)
    this.codeDanmakuSpawner?.remove(false)
    this.flyingEnemies?.destroy()
    this.codeDanmaku?.destroy()
  }

  // ---------------------------------------------------------------------------
  // Spawner 回调
  // ---------------------------------------------------------------------------

  /**
   * 小飞兵刷新 —— 仅 running phase + 非结算态 下才刷。
   * spawn 坐标：相机视口右缘外 SPAWN_MARGIN 像素，Y 随机在 [SPAWN_Y_MIN, SPAWN_Y_MAX]。
   */
  private readonly spawnFlyer = (): void => {
    if (this.options.isInSettlement()) return
    if (this.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return
    const cam = this.scene.cameras.main
    const T = FLYING_ENEMY_TUNING
    const x = cam.scrollX + cam.width + T.SPAWN_MARGIN
    const y = T.SPAWN_Y_MIN + Math.random() * (T.SPAWN_Y_MAX - T.SPAWN_Y_MIN)
    this.flyingEnemies.spawn(x, y)
  }

  /**
   * 代码弹幕刷新 —— 每 tick 随机挑一种发射方式：
   *   - `horizontal` (50%)：自屏幕右缘水平向左飞过（最常见）。
   *   - `diag-tr-bl` (35%)：自右上角俯冲到左下角（"黑客帝国"经典斜角）。
   *   - `vertical`   (15%)：自屏幕上缘垂直下落（像代码雨）。
   */
  private readonly spawnCodeDanmaku = (): void => {
    if (this.options.isInSettlement()) return
    if (!this.codeDanmaku) return
    if (this.phaseController.getCurrentId() !== PHASE_IDS.RUNNING) return

    const cam = this.scene.cameras.main
    const T = CODE_DANMAKU_TUNING

    for (let i = 0; i < T.SPAWN_BURST; i++) {
      const speed = T.SPEED_MIN + Math.random() * (T.SPEED_MAX - T.SPEED_MIN)
      const roll = Math.random()
      let x: number
      let y: number
      let vx: number
      let vy: number
      if (roll < 0.5) {
        x = cam.scrollX + cam.width + T.SPAWN_MARGIN
        y = cam.scrollY + T.SPAWN_Y_MIN + Math.random() * (T.SPAWN_Y_MAX - T.SPAWN_Y_MIN)
        vx = -speed
        vy = 0
      } else if (roll < 0.85) {
        x = cam.scrollX + cam.width + T.SPAWN_MARGIN
        const topBand = T.SPAWN_Y_MIN + Math.random() * Math.max(40, (T.SPAWN_Y_MAX - T.SPAWN_Y_MIN) * 0.4)
        y = cam.scrollY + topBand
        const c = Math.SQRT1_2
        vx = -speed * c
        vy = speed * c
      } else {
        x = cam.scrollX + Math.random() * cam.width
        y = cam.scrollY - T.SPAWN_MARGIN
        vx = 0
        vy = speed
      }
      this.codeDanmaku.spawn(x, y, vx, vy)
    }
  }
}
