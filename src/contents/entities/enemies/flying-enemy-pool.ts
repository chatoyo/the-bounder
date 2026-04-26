/**
 * FlyingEnemyPool —— 小型飞兵（空中敌人）对象池 + 行为。
 *
 * 定位：
 *   - 在 auto-scroll 关卡里充当"迎面飞来"的骚扰敌人。
 *   - 刷出点：相机视口右缘外 `SPAWN_MARGIN` 像素处，Y ∈ [SPAWN_Y_MIN, SPAWN_Y_MAX]。
 *   - 世界空间速度：vx 随机取 [VX_MAX, VX_MIN]（均为负值，即世界空间向左）；
 *     叠加相机向右滚动，玩家视觉上看到它们"从右侧冲过来 + 微微斜向左下/上浮动"。
 *   - Y 轴：围绕 spawnY 做 sin 波摆动（`SWAY_AMPLITUDE` / `SWAY_PERIOD`）。
 *
 * 生命周期：
 *   - `spawn(x, y)` 从池中取一只并激活；池耗尽返回 null（spawner 会直接丢弃本次 tick）。
 *   - `kill(sprite)` 回池（子弹命中 / 接触玩家 / 离开视口左侧）。
 *   - `update(time)` 每帧更新所有 active 飞兵的 y（sin 摆动）并 cull 离屏。
 *   - `despawnAll()` 清场（BossPhase 进入时调用，避免视觉混乱）。
 *
 * 遵守 AGENTS.md §6："反复生成的东西必须池化"。
 *
 * 本类不挂碰撞；scene 侧自己用 `pool.group` 挂 collider / overlap（参考 BulletPool）。
 */

import * as Phaser from 'phaser'
import { FLYING_ENEMY_TUNING } from '@/contents/constants'

/** per-sprite 附加数据的 key 常量（避免在 sprite.data 里用散落的魔法字符串） */
const DATA_BASE_Y = 'flyerBaseY'
const DATA_SPAWNED_AT = 'flyerSpawnedAt'
const DATA_PHASE = 'flyerSwayPhase'

export class FlyingEnemyPool {
  readonly group: Phaser.Physics.Arcade.Group

  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, textureKey: string, maxSize: number) {
    this.scene = scene
    this.group = scene.physics.add.group({
      defaultKey: textureKey,
      maxSize,
      allowGravity: false,
      collideWorldBounds: false,
    })
  }

  /**
   * 从池中取一只并激活。
   * @param x 世界坐标 x —— 一般 = `camera.scrollX + camera.width + SPAWN_MARGIN`
   * @param y 世界坐标 y
   * @returns sprite 或 null（池满）
   */
  spawn(x: number, y: number): Phaser.Physics.Arcade.Sprite | null {
    const s = this.group.get(x, y) as Phaser.Physics.Arcade.Sprite | null
    if (!s) return null

    s.setActive(true)
    s.setVisible(true)
    s.setDepth(5)

    const body = s.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setAllowGravity(false)
    // 碰撞盒稍微收紧一点，避免视觉边缘就触发伤害
    body.setSize(22, 14)
    body.setOffset(3, 3)

    s.setPosition(x, y)

    // 世界空间水平速度：随机取 [VX_MAX, VX_MIN]（均为负）
    const T = FLYING_ENEMY_TUNING
    const vx = T.VX_MIN + Math.random() * (T.VX_MAX - T.VX_MIN)
    body.setVelocity(vx, 0)

    s.setData(DATA_BASE_Y, y)
    s.setData(DATA_SPAWNED_AT, this.scene.time.now)
    // 每只用随机相位错开，避免所有飞兵"齐步上下"不自然
    s.setData(DATA_PHASE, Math.random() * Math.PI * 2)

    // 每帧我们在 update() 里重写 y；这里清零 alpha / tint 以免上次命中残留。
    s.setAlpha(1)
    s.clearTint()
    return s
  }

  /** 回池。所有"非自然死亡"都走这：命中子弹 / 接触玩家 / 离屏 / 关卡清场。 */
  kill(s: Phaser.Physics.Arcade.Sprite): void {
    this.group.killAndHide(s)
    const body = s.body as Phaser.Physics.Arcade.Body | null
    if (body) {
      body.enable = false
      body.setVelocity(0, 0)
    }
  }

  /**
   * 每帧调用。做两件事：
   *   1) 对每只 active 飞兵更新 y（sin 波摆动） —— x 由物理 velocity 自行推进；
   *   2) cull 离开相机左侧 CULL_OFF_LEFT 像素的飞兵。
   *
   * 需要相机 scrollX 来做 cull；scene 侧提供。
   */
  update(time: number, cameraScrollX: number): void {
    const T = FLYING_ENEMY_TUNING
    const periodMs = T.SWAY_PERIOD * 1000
    this.group.children.forEach((obj) => {
      const s = obj as Phaser.Physics.Arcade.Sprite
      if (!s.active) return

      const baseY = s.getData(DATA_BASE_Y) as number | undefined
      const spawnedAt = s.getData(DATA_SPAWNED_AT) as number | undefined
      const phase = s.getData(DATA_PHASE) as number | undefined
      if (baseY == null || spawnedAt == null) return

      const elapsed = time - spawnedAt
      const theta = (elapsed / periodMs) * Math.PI * 2 + (phase ?? 0)
      s.y = baseY + Math.sin(theta) * T.SWAY_AMPLITUDE
      // body.y 必须手动跟 —— 否则 Arcade body 会在下一帧把 sprite 拉回 body 位置
      const body = s.body as Phaser.Physics.Arcade.Body | null
      if (body) body.y = s.y - body.halfHeight

      // 离屏回收
      if (s.x < cameraScrollX - T.CULL_OFF_LEFT) {
        this.kill(s)
      }
    })
  }

  /** 一次性清场 —— BossPhase 进入时用，避免 boss 登场夹杂满屏飞兵。 */
  despawnAll(): void {
    this.group.children.forEach((obj) => {
      const s = obj as Phaser.Physics.Arcade.Sprite
      if (!s.active) return
      this.kill(s)
    })
  }

  destroy(): void {
    // Phaser 4 在 scene shutdown 时，其内部系统的 shutdown 监听器先跑、我们的
    // handleShutdown 后跑 —— 等到这里时 group 的 children Set 可能已经被 Phaser
    // 置空，直接 `group.clear(true, true)` 会抛
    // `undefined is not an object (evaluating 'children.forEach')`。这条异常会
    // 顺着 handleShutdown 往上抛，中断整条 shutdown → 新 scene.create 不会被触发
    // （=> "boss 场景不加载"）。所以这里只做最保守的 group 销毁，并把 Phaser 的
    // 不确定性吃掉。
    if (!this.group) return
    try {
      const g = this.group as unknown as { children?: { size?: number } }
      // children 还在（Phaser 还没提前拆）→ 走常规 clear+destroy 流水线。
      if (g.children && typeof g.children.size === 'number') {
        this.group.clear(true, true)
        this.group.destroy(true)
      } else {
        // Phaser 已经把 children 置空；再调 clear 会崩。destroy(true) 内部同样会
        // 走 clear 分支，也不安全。此时我们已经没必要手动清理了 —— Phaser 接管。
      }
    } catch (err) {
      console.warn('[FlyingEnemyPool] destroy 忽略 Phaser 内部 teardown 异常:', err)
    }
  }
}
