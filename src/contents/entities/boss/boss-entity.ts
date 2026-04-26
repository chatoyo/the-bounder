/**
 * BossEntity —— Boss 占位实现：悬停 + 三连散射 + HP 条事件。
 *
 * 设计边界：
 *   - 用 `Phaser.Physics.Arcade.Sprite`（dynamic body）但关重力、关世界边界 —— 靠 tween/update 定位。
 *   - 不持有"被打死后世界怎么办"的逻辑；Boss 死亡后 emit BOSS_DEFEATED，BossPhase 接手。
 *   - 子弹池由外部注入（EnemyBulletPool 实例 = 一个通用 `BulletPool`）。
 *
 * 扩展路径：
 *   - 加新攻击模式：把 update() 里的计时器拆成 AI FSM。
 *   - 加第二阶段：HP 到阈值时切 currentPatternId。
 */

import * as Phaser from 'phaser'
import { EVENT_KEYS } from '@/contents/constants'
import type {
  BossDef,
  BossDefeatedPayload,
  BossHpChangedPayload,
  BossSpawnedPayload,
} from '@/contents/types'
import type { BulletPool } from '@/contents/entities/projectile/bullet-pool'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

const SPRITE_BY_VARIANT: Record<NonNullable<BossDef['sprite']>, string> = {
  hulk: 'boss-hulk',
  wisp: 'boss-wisp',
  serpent: 'boss-serpent',
}

export class BossEntity {
  readonly def: BossDef
  readonly sprite: Phaser.Physics.Arcade.Sprite

  private scene: Phaser.Scene
  private hp: number
  private alive = true

  private bulletPool: BulletPool
  private lastShotAt = 0

  /** 悬停的基准 Y；sprite.y 围绕它做 sin 波动 */
  private hoverBaseY: number

  /** 攻击间隔（ms） */
  private static readonly SHOT_COOLDOWN_MS = 1350
  /** 散射子弹速度 */
  private static readonly BULLET_SPEED = 240
  /** Boss 接触玩家造成的伤害 */
  private static readonly CONTACT_DAMAGE = 1

  constructor(scene: Phaser.Scene, def: BossDef, bulletPool: BulletPool) {
    this.scene = scene
    this.def = def
    this.bulletPool = bulletPool
    this.hp = def.maxHp
    this.hoverBaseY = def.spawnY

    const textureKey = SPRITE_BY_VARIANT[def.sprite ?? 'hulk']
    this.sprite = scene.physics.add.sprite(def.spawnX, def.spawnY, textureKey)
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setImmovable(true)
    this.sprite.setDepth(10)

    // 进入动画：从屏幕外右侧滑入
    const arriveX = def.spawnX
    this.sprite.setX(arriveX + 200)
    this.sprite.setAlpha(0)
    scene.tweens.add({
      targets: this.sprite,
      x: arriveX,
      alpha: 1,
      duration: 700,
      ease: 'Sine.easeOut',
    })

    eventBus.emit(EVENT_KEYS.BOSS_SPAWNED, {
      bossId: def.id,
      displayName: def.displayName,
      maxHp: def.maxHp,
    } satisfies BossSpawnedPayload)
    eventBus.emit(EVENT_KEYS.BOSS_HP_CHANGED, {
      bossId: def.id,
      current: this.hp,
      max: def.maxHp,
    } satisfies BossHpChangedPayload)
  }

  isAlive(): boolean {
    return this.alive
  }

  getContactDamage(): number {
    return BossEntity.CONTACT_DAMAGE
  }

  /** 由 BossPhase.update() 每帧调用 */
  update(time: number, _delta: number): void {
    if (!this.alive) return

    // 悬停摆动
    const t = time / 1000
    this.sprite.y = this.hoverBaseY + Math.sin(t * 1.8) * 16

    // 定时攻击
    if (time - this.lastShotAt >= BossEntity.SHOT_COOLDOWN_MS) {
      this.lastShotAt = time
      this.fireSpread()
    }
  }

  /** 被玩家子弹击中 */
  takeHit(amount = 1): void {
    if (!this.alive) return
    this.hp = Math.max(0, this.hp - amount)

    // 受击闪白
    this.sprite.setTint(0xffffff)
    this.scene.time.delayedCall(80, () => {
      if (this.alive) this.sprite.clearTint()
    })

    eventBus.emit(EVENT_KEYS.BOSS_HP_CHANGED, {
      bossId: this.def.id,
      current: this.hp,
      max: this.def.maxHp,
    } satisfies BossHpChangedPayload)

    if (this.hp === 0) this.die()
  }

  destroy(): void {
    this.sprite.destroy()
  }

  // ---- 内部 ----

  private fireSpread(): void {
    // 三连散射：水平向左 + 上下 15° 偏转
    const baseAngle = Math.PI // 朝玩家方向（左）
    const spread = (15 * Math.PI) / 180
    const speeds = [-spread, 0, spread]
    for (const off of speeds) {
      const angle = baseAngle + off
      const vx = Math.cos(angle) * BossEntity.BULLET_SPEED
      const vy = Math.sin(angle) * BossEntity.BULLET_SPEED
      this.bulletPool.fire(this.sprite.x - 40, this.sprite.y, vx, vy)
    }
  }

  private die(): void {
    this.alive = false
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null
    if (body) body.enable = false

    // 死亡动画
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: 1.2,
      angle: 30,
      duration: 700,
      ease: 'Sine.easeIn',
    })
    this.scene.cameras.main.flash(400, 255, 200, 80)
    this.scene.cameras.main.shake(250, 0.01)

    eventBus.emit(EVENT_KEYS.BOSS_DEFEATED, {
      bossId: this.def.id,
    } satisfies BossDefeatedPayload)
  }
}
