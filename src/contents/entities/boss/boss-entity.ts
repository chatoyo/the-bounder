/**
 * BossEntity —— Boss 占位实现：悬停 + 三连散射 + HP 条事件。
 *
 * 定位（2026-04-26 修订）：**相机空间 boss**。BossPhase 不再锁相机，auto-scroll
 * 继续推进；本类每帧把 sprite.x 主动对齐"相机视口右缘减 BASE_SCREEN_OFFSET_X"，
 * 使 boss 视觉上保持浮在屏幕右侧、跟着世界一起流动。
 *
 *   世界坐标 x = camera.scrollX + camera.width - BASE_SCREEN_OFFSET_X + entryOffset
 *
 * 进入动画：entryOffset 从 +220（屏幕外右侧）用 Sine.easeOut 缓动到 0，可感到
 * "boss 从右边迎面飞过来"。
 *
 * 死亡后本类**停止追踪相机**（保留最后一帧的世界 x），让死亡 tween 原地播完；
 * 相机继续右滚会让残影被留在左侧，视觉上像"被甩在身后"。
 *
 * 设计边界：
 *   - 用 `Phaser.Physics.Arcade.Sprite`（dynamic body）但关重力、关世界边界 —— 靠 update 定位。
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

  /**
   * 入场偏移：+220 = 屏幕外右侧；0 = 目标位置。
   * 每帧 targetX = cam.scrollX + cam.width - BASE_SCREEN_OFFSET_X + entry.offset。
   * 用 addCounter 在 700ms 内从 220 缓到 0，可感到"boss 从右侧冲进视口"。
   */
  private entry = { offset: 220 }

  /** 相机空间上 boss 中心距视口右缘的基准像素 —— 数值越大 boss 越靠左 */
  private static readonly BASE_SCREEN_OFFSET_X = 160

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

    // 相机当前视口 → 算出"本该在这里"的初始 X，再加入场偏移让它落在屏幕外右缘。
    const cam = scene.cameras.main
    const baseX = cam.scrollX + cam.width - BossEntity.BASE_SCREEN_OFFSET_X
    const startX = baseX + this.entry.offset
    this.sprite = scene.physics.add.sprite(startX, def.spawnY, textureKey)
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setImmovable(true)
    this.sprite.setDepth(10)
    this.sprite.setAlpha(0)

    // 入场：偏移 220 → 0 + 透明度 0 → 1，700ms
    scene.tweens.addCounter({
      from: this.entry.offset,
      to: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        this.entry.offset = tween.getValue() ?? 0
      },
    })
    scene.tweens.add({
      targets: this.sprite,
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
    if (!this.alive) {
      // 故意不再追踪相机 —— 保留最后一帧 sprite.x，让死亡 tween 在原地播完；
      // 相机继续右滚会把它甩到视口左侧 / 屏幕外，自然淡出。
      return
    }

    // 每帧锁定到"相机视口右侧"的基准位置 + 入场偏移
    const cam = this.scene.cameras.main
    const baseX = cam.scrollX + cam.width - BossEntity.BASE_SCREEN_OFFSET_X
    this.sprite.x = baseX + this.entry.offset

    // 悬停摆动（sin 波动的 Y）
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
    if (this.hp <= 0) return // 已被判定死亡但死亡动画未完，忽略后续伤害
    this.hp = Math.max(0, this.hp - amount)

    // 受击全身闪白：
    //   - Phaser 3 的 setTintFill(color) 在 Phaser 4 里拆成了"先 setTint(color) + 再
    //     setTintMode(FILL)"；旧 API 已退化为 no-op（见 phaser.d.ts 注释）。
    //   - 必须用 FILL 模式才能把整张贴图临时涂成纯白；仅 setTint(0xffffff) 等价于
    //     "无 tint"（RGB × 1 = 原色），视觉上完全看不出命中。
    this.sprite.setTint(0xffffff)
    this.sprite.setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(90, () => {
      if (this.alive) {
        this.sprite.clearTint()
        this.sprite.setTintMode(Phaser.TintModes.MULTIPLY)
      }
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
