/**
 * BulletPool —— 玩家子弹对象池。
 *
 * 遵守 AGENTS.md §6："反复生成的东西必须池化"。调用 fire() 直接发射一颗，
 * 到期 / 撞墙 → kill() 归还池中；内部永远不超过构造时指定的 maxSize。
 *
 * 设计边界：
 *   - 池本身不管 owner（玩家/敌人），需要区分时再建第二个池（例如 EnemyBulletPool）。
 *   - 池不拥有碰撞规则；scene 负责给 `pool.group` 挂 collider / overlap。
 *   - 生命周期 tick 由 scene 在 update() 里调 pool.cull(time) 触发。
 */

import * as Phaser from 'phaser'
import { PLAYER_TUNING } from '@/contents/constants'

const BULLET_SPAWN_KEY = 'spawnedAt'

export class BulletPool {
  readonly group: Phaser.Physics.Arcade.Group

  private scene: Phaser.Scene
  /** 每颗子弹的最大存活时间；默认用玩家子弹寿命，敌人子弹可显式传入 */
  private lifetimeMs: number

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    maxSize: number,
    lifetimeMs: number = PLAYER_TUNING.BULLET_LIFETIME_MS,
  ) {
    this.scene = scene
    this.lifetimeMs = lifetimeMs
    this.group = scene.physics.add.group({
      defaultKey: textureKey,
      maxSize,
      allowGravity: false,
      collideWorldBounds: false,
    })
  }

  /**
   * 从池中取一颗子弹并发射。池耗尽时返回 null —— 调用方无须特殊处理
   * （通常意味着武器太密集，丢一发不会影响体验）。
   */
  fire(x: number, y: number, vx: number, vy: number): Phaser.Physics.Arcade.Sprite | null {
    const bullet = this.group.get(x, y) as Phaser.Physics.Arcade.Sprite | null
    if (!bullet) return null

    bullet.setActive(true)
    bullet.setVisible(true)
    const body = bullet.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setAllowGravity(false)
    bullet.setPosition(x, y)
    bullet.setVelocity(vx, vy)
    // 让子弹朝飞行方向略微倾斜（视觉判读）
    bullet.setRotation(Math.atan2(vy, vx))
    bullet.setData(BULLET_SPAWN_KEY, this.scene.time.now)
    return bullet
  }

  /** 回收一颗子弹（撞墙 / 命中敌人 / 超时都走这里） */
  kill(bullet: Phaser.Physics.Arcade.Sprite): void {
    this.group.killAndHide(bullet)
    const body = bullet.body as Phaser.Physics.Arcade.Body | null
    if (body) body.enable = false
  }

  /** 场景每帧调一次；按寿命剔除过期子弹 */
  cull(time: number): void {
    // Phaser 4: group.children 是原生 Set<GameObject>；不再有 iterate()
    this.group.children.forEach((obj) => {
      const b = obj as Phaser.Physics.Arcade.Sprite
      if (!b.active) return
      const spawnedAt = b.getData(BULLET_SPAWN_KEY) as number | undefined
      if (spawnedAt == null) return
      if (time - spawnedAt > this.lifetimeMs) {
        this.kill(b)
      }
    })
  }

  destroy(): void {
    // 与 FlyingEnemyPool 同样的保护：scene shutdown 时 Phaser 4 可能先把 group
    // 的 children Set 置空，再触发我们注册的 SHUTDOWN 监听器。此时 `group.clear`
    // 会抛 `undefined is not an object (evaluating 'children.forEach')`，一旦
    // throw 会中断 handleShutdown 剩下的清理 + Phaser 的下一 scene.create。
    if (!this.group) return
    try {
      const g = this.group as unknown as { children?: { size?: number } }
      if (g.children && typeof g.children.size === 'number') {
        this.group.clear(true, true)
        this.group.destroy(true)
      }
    } catch (err) {
      console.warn('[BulletPool] destroy 忽略 Phaser 内部 teardown 异常:', err)
    }
  }
}
