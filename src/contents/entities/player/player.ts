/**
 * Player —— 玩家实体（组合，非继承）。
 *
 * 故意不 extend `Phaser.Physics.Arcade.Sprite`。原因：
 *   1) 我们要动态增删 capability，继承把"能做什么"锁死在类声明里。
 *   2) sprite 必须通过 scene.physics.add.sprite(...) 创建才拿得到物理 body，
 *      混入继承后构造流程更绕。
 *   3) HUD / SkillManager / Boss 要查的是"这个玩家现在挂着哪些 capability"，
 *      不是"sprite 的几何状态"，面向外部的 API 更自然放在 wrapper 上。
 *
 * 外部用法：`player.sprite.x` / `player.sprite.body`（就是普通的 Arcade sprite）。
 */

import * as Phaser from 'phaser'
import { EVENT_KEYS, GAME_CONFIG, PLAYER_TUNING } from '@/contents/constants'
import type {
  ActionId,
  CapabilityId,
  PlayerDamagedPayload,
  PlayerDiedPayload,
  PlayerHpChangedPayload,
  PlayerRespawnedPayload,
} from '@/contents/types'
import { useEventBus } from '@/runtime'
import type { CameraDirector } from '@/contents/systems/camera-director'
import type { Capability } from './capabilities/capability'

const eventBus = useEventBus()

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite

  /** 朝向：-1 = 左，1 = 右。由 MoveCapability 在 update 里维护 */
  facing: -1 | 1 = 1

  /**
   * 飞行模式标记。由 FlyCapability 在 attach/detach 时翻转。
   * MoveCapability / JumpCapability 见此 flag 为 true 时会自动 no-op，
   * 把 velocity 全权交给 FlyCapability。
   */
  isFlying = false

  /** 当前血量 */
  private _hp: number
  /** 最大血量；UI 显示用 */
  readonly maxHp: number

  /** 是否处于无敌帧（受伤后短暂免疫）*/
  private _invulnUntil = 0

  /** 存活标记；死亡 → respawn 之间为 false，capability 应跳过逻辑 */
  private _alive = true

  /** 活跃 capability 表；key 是 CapabilityId */
  private capabilities = new Map<CapabilityId, Capability>()

  /** 受伤时用的闪烁 tween，避免多次叠加 */
  private damageFlashTween: Phaser.Tweens.Tween | null = null

  /**
   * 当前"世界滚动速度"的缓存（由 getCruiseSpeed() 惰性解析 scene.data['cameraDirector']）。
   * Move / Fly 等 capability 通过这个值决定"无输入时默认向前推的速度"，避免每个
   * capability 各自解析 director。
   */
  private cachedDirector: CameraDirector | null = null

  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'player') {
    this.scene = scene
    this.maxHp = PLAYER_TUNING.MAX_HP
    this._hp = this.maxHp

    this.sprite = scene.physics.add.sprite(x, y, textureKey)
    this.sprite.setCollideWorldBounds(false) // 世界边界由 scene 侧 physics.world.setBounds 控制

    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setGravityY(GAME_CONFIG.GRAVITY)
    // 稍微收紧一点碰撞盒，减少视觉上"悬在空中"的感觉
    body.setSize(26, 46)
    body.setOffset(3, 1)
  }

  // -------------------------------------------------------------------------
  // Capability 挂载 / 卸载
  // -------------------------------------------------------------------------

  attachCapability(cap: Capability): void {
    if (this.capabilities.has(cap.id)) {
      // 幂等：同 id 重复挂载直接忽略
      return
    }
    cap.attach({ player: this, scene: this.scene })
    this.capabilities.set(cap.id, cap)
  }

  detachCapability(id: CapabilityId): void {
    const cap = this.capabilities.get(id)
    if (!cap) return
    cap.detach()
    this.capabilities.delete(id)
  }

  hasCapability(id: CapabilityId): boolean {
    return this.capabilities.has(id)
  }

  // -------------------------------------------------------------------------
  // 生命周期：每帧 + 输入事件转发
  // -------------------------------------------------------------------------

  update(time: number, delta: number): void {
    for (const cap of this.capabilities.values()) {
      cap.update?.(time, delta)
    }
  }

  onAction(action: ActionId, phase: 'down' | 'up'): void {
    for (const cap of this.capabilities.values()) {
      cap.onAction?.(action, phase)
    }
  }

  /**
   * 返回当前世界的"巡航速度"（= 相机 auto-scroll 速度）。
   * - auto-right 关卡：返回关卡 scroll.speed（例 200 px/s）。
   * - follow / locked 关卡：返回 0。
   *
   * 由 MoveCapability（按 BASE_FORWARD_RATIO 缩放）和 FlyCapability（按
   * FLY_IDLE_RATIO 缩放）共同消费，统一"没按键默认以世界节奏往前漂"的语义。
   */
  getCruiseSpeed(): number {
    if (!this.cachedDirector) {
      const d = this.scene.data.get('cameraDirector') as CameraDirector | undefined
      if (d) this.cachedDirector = d
    }
    return this.cachedDirector?.getAutoScrollSpeed() ?? 0
  }

  // -------------------------------------------------------------------------
  // HP / 受伤 / 死亡 / 重生
  // -------------------------------------------------------------------------

  get hp(): number {
    return this._hp
  }

  get alive(): boolean {
    return this._alive
  }

  get invulnerable(): boolean {
    return this.scene.time.now < this._invulnUntil
  }

  /**
   * 扣血。返回本次实际造成的伤害（若处于无敌帧 / 已死亡则 0）。
   */
  damage(amount: number, cause: PlayerDiedPayload['cause'] = 'hazard'): number {
    if (!this._alive) return 0
    if (this.invulnerable) return 0
    if (amount <= 0) return 0

    this._hp = Math.max(0, this._hp - amount)
    this._invulnUntil = this.scene.time.now + PLAYER_TUNING.INVULN_MS

    this.flashDamage()

    eventBus.emit(EVENT_KEYS.PLAYER_DAMAGED, {
      amount,
      remaining: this._hp,
    } satisfies PlayerDamagedPayload)
    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: this._hp,
      max: this.maxHp,
    } satisfies PlayerHpChangedPayload)

    if (this._hp === 0) {
      this.die(cause)
    }
    return amount
  }

  /** 强制杀死（用于摔出世界） */
  kill(cause: PlayerDiedPayload['cause']): void {
    if (!this._alive) return
    this._hp = 0
    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: 0,
      max: this.maxHp,
    } satisfies PlayerHpChangedPayload)
    this.die(cause)
  }

  private die(cause: PlayerDiedPayload['cause']): void {
    this._alive = false
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
    body.setAllowGravity(false)
    this.sprite.setTint(0xff4444)
    eventBus.emit(EVENT_KEYS.PLAYER_DIED, { cause } satisfies PlayerDiedPayload)
  }

  /**
   * 重生到指定坐标，满血复活，清无敌帧。
   * 由 RespawnPhase 调用；scene 侧负责清敌方子弹 / 复位相机等场外事。
   */
  respawn(x: number, y: number, checkpointId: string): void {
    this.sprite.setPosition(x, y)
    this.sprite.setVelocity(0, 0)
    this.sprite.clearTint()
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    // isFlying 由 FlyCapability.attach/detach 管；但若它仍挂着（跨重生保留飞行），
    // 保持重力关闭与否 = 当前是否飞行。这里不强行开启重力，以免干扰 FlyCapability。
    if (!this.isFlying) {
      body.setAllowGravity(true)
    }
    body.setVelocity(0, 0)

    this._hp = this.maxHp
    this._alive = true
    // 复活后给一段短无敌
    this._invulnUntil = this.scene.time.now + PLAYER_TUNING.INVULN_MS

    eventBus.emit(EVENT_KEYS.PLAYER_HP_CHANGED, {
      current: this._hp,
      max: this.maxHp,
    } satisfies PlayerHpChangedPayload)
    eventBus.emit(EVENT_KEYS.PLAYER_RESPAWNED, {
      checkpointId,
      x,
      y,
    } satisfies PlayerRespawnedPayload)
  }

  private flashDamage(): void {
    // 已经在闪 → 重置
    this.damageFlashTween?.stop()
    this.sprite.setTint(0xffff66)
    this.damageFlashTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.35, to: 1 },
      duration: 120,
      repeat: Math.ceil(PLAYER_TUNING.INVULN_MS / 240),
      yoyo: true,
      onComplete: () => {
        this.sprite.clearTint()
        this.sprite.setAlpha(1)
      },
    })
  }

  destroy(): void {
    for (const cap of this.capabilities.values()) {
      cap.detach()
    }
    this.capabilities.clear()
    this.damageFlashTween?.stop()
    this.sprite.destroy()
  }
}
