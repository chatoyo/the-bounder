/**
 * CodeDanmakuPool —— "Matrix 代码弹幕"对象池 + 行为。
 *
 * 两处用途（同一实现，不同实例）：
 *   1. Boss 战前 `world-strip-demo` 关卡的氛围敌人 —— 由 GameplayScene 自己的
 *      spawner 用水平 / 斜角 / 垂直三种方式往玩家身上招呼。
 *   2. Boss 战里敌方子弹 —— BossPhase 以它替换原来的 sprite `BulletPool` 注入到
 *      `BossEntity`；弹道逻辑（散射 / 瞄准射 / 环爆）完全不变，只是每颗子弹的
 *      视觉从紫色圆点换成一个飞动的绿色代码字符。
 *
 * 为什么选 `Phaser.GameObjects.Text` 而不是 sprite：
 *   - "每条弹幕显示一个随机字形"是核心视觉，用 Text 可以直接在发射时掷骰换字；
 *     Sprite 得预生成几十张纹理再随机换 key，代价远高于这里需要的。
 *   - Text 没法用 `group.get(defaultKey=...)` 这种惯用 pool API；所以本类
 *     维护自己的对象数组，按 active 标志复用；只把"活体"加到一个
 *     `Phaser.Physics.Arcade.Group` 里，纯粹是为了 scene 侧能对整束 danmaku
 *     一次性 `physics.add.overlap(player.sprite, pool.group, ...)`。
 *
 * API 和 BulletPool 结构对齐（`fire` / `kill` / `cull` / `destroy` / `group`），
 * 所以 BossEntity / BossPhase 等消费方可以直接注入本池替代 BulletPool。
 *
 * 生命周期：
 *   - `fire(x, y, vx, vy)`：从池取一条（或创建新的，直到 maxSize）→ 激活 +
 *     置字 + 写速度。返回 Text 或 null。
 *   - `kill(obj)`：关 body + 隐藏 + 置 inactive，等下次复用。子弹命中 / 接触
 *     玩家 / cull 离屏 / 生命周期过期 都走这里。接收 `GameObject` 以便 scene
 *     侧在 overlap 回调里不必窄化到 Text 类型。
 *   - `cull(time)`：每帧调用；把过期 / 离屏的回池，并做字符"漂移"（每隔约
 *     120 ms 重抽一次字形，加强代码雨的闪烁感）。
 *   - `despawnAll()`：BossPhase 进场 / 结算时清场用。
 *
 * 与 §6 的"对象池"纪律一致；不挂任何场景碰撞，scene 负责用 `pool.group` 接线。
 */

import * as Phaser from 'phaser'
import { CODE_DANMAKU_TUNING } from '@/contents/constants'

/** per-text 附加数据 key */
const DATA_SPAWNED_AT = 'danmakuSpawnedAt'
const DATA_LAST_MORPH = 'danmakuLastMorphAt'
const DATA_IS_HIGHLIGHT = 'danmakuHighlight'

/** Matrix 代码雨的字符候选：片假名 + 数字 + 编程符号。 */
const GLYPHS = (() => {
  // 片假名 U+30A0..U+30FF；挑一段"看着像代码"的
  const katakana: string[] = []
  for (let c = 0x30a0; c <= 0x30ff; c++) katakana.push(String.fromCharCode(c))
  const digits = '0123456789'.split('')
  const symbols = '{}[]()<>=;:.,+-*/?!@#$%&|^~_'.split('')
  const latin = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')
  return [...katakana, ...digits, ...symbols, ...latin]
})()

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export class CodeDanmakuPool {
  /**
   * 对外暴露的物理 group。内部 Text 对象用 `physics.add.existing` 加上 body 后
   * 再 `group.add(text)`，这样 scene 侧可以用
   * `physics.add.overlap(player.sprite, pool.group, cb)` 一口气注册。
   */
  readonly group: Phaser.Physics.Arcade.Group

  private scene: Phaser.Scene
  /** 对象池：所有曾经 spawn 过的 Text，复用时找 active === false 的 */
  private pool: Phaser.GameObjects.Text[] = []
  private maxSize: number

  constructor(scene: Phaser.Scene, maxSize: number = CODE_DANMAKU_TUNING.POOL_SIZE) {
    this.scene = scene
    this.maxSize = maxSize
    this.group = scene.physics.add.group({
      allowGravity: false,
      collideWorldBounds: false,
    })
  }

  /**
   * 从池取一条激活使用；池满时返回 null（scene 侧的 spawner 会直接丢本次 tick）。
   *
   * 别名 `fire` —— 与 `BulletPool.fire` 同签名，方便 BossEntity 无差别注入。
   *
   * @param x 世界坐标 x
   * @param y 世界坐标 y
   * @param vx 世界空间水平速度（像素/秒）
   * @param vy 世界空间垂直速度（像素/秒）
   */
  fire(
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): Phaser.GameObjects.Text | null {
    return this.spawn(x, y, vx, vy)
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): Phaser.GameObjects.Text | null {
    const text = this.acquire(x, y)
    if (!text) return null

    const T = CODE_DANMAKU_TUNING
    const isHighlight = Math.random() < T.HIGHLIGHT_CHANCE
    const color = isHighlight ? T.HIGHLIGHT_COLOR : T.COLOR

    text.setActive(true)
    text.setVisible(true)
    text.setPosition(x, y)
    text.setAlpha(1)
    text.setText(randomGlyph())
    text.setColor(color)
    text.setDepth(4) // 略低于 boss HUD / 前景；高于视差背景
    text.setData(DATA_SPAWNED_AT, this.scene.time.now)
    text.setData(DATA_LAST_MORPH, this.scene.time.now)
    text.setData(DATA_IS_HIGHLIGHT, isHighlight)

    const body = text.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setAllowGravity(false)
    // 把 body 收紧一圈，视觉边缘不那么容易误伤
    body.setSize(T.FONT_PX - 4, T.FONT_PX - 4)
    body.setOffset(2, 2)
    body.setVelocity(vx, vy)
    return text
  }

  /**
   * 回收 —— 子弹命中 / 接触玩家 / 离屏 / 过期都走这里。参数类型放宽到
   * `GameObject` 以匹配 `BulletPool.kill` 的使用惯例；运行时这里收到的
   * 永远是本池创建的 Text。
   */
  kill(obj: Phaser.GameObjects.GameObject): void {
    const text = obj as Phaser.GameObjects.Text
    text.setActive(false)
    text.setVisible(false)
    const body = text.body as Phaser.Physics.Arcade.Body | null
    if (body) {
      body.enable = false
      body.setVelocity(0, 0)
    }
  }

  /**
   * `cull(time)` —— 与 `BulletPool.cull` 同签名的别名；视口来自
   * `this.scene.cameras.main`。
   */
  cull(time: number): void {
    this.update(time, this.scene.cameras.main)
  }

  /**
   * 每帧调用。做两件事：
   *   1) 过期 / 离屏 cull；
   *   2) 每隔 ~120ms 给活着的弹幕随机换个字形，加强"代码雨在跳动"的感觉。
   *
   * 需要 camera 来做视口 cull。
   */
  update(time: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    const T = CODE_DANMAKU_TUNING
    const left = camera.scrollX - T.CULL_OFF_MARGIN
    const right = camera.scrollX + camera.width + T.CULL_OFF_MARGIN
    const top = camera.scrollY - T.CULL_OFF_MARGIN
    const bottom = camera.scrollY + camera.height + T.CULL_OFF_MARGIN

    for (const text of this.pool) {
      if (!text.active) continue

      const spawnedAt = text.getData(DATA_SPAWNED_AT) as number | undefined
      if (spawnedAt != null && time - spawnedAt > T.LIFETIME_MS) {
        this.kill(text)
        continue
      }

      // 出视口回收
      if (text.x < left || text.x > right || text.y < top || text.y > bottom) {
        this.kill(text)
        continue
      }

      // 闪烁：~每 120ms 换字形；高亮的换得更勤快（60ms）
      const highlight = text.getData(DATA_IS_HIGHLIGHT) as boolean | undefined
      const morphEvery = highlight ? 60 : 120
      const lastMorph = text.getData(DATA_LAST_MORPH) as number | undefined
      if (lastMorph != null && time - lastMorph > morphEvery) {
        text.setText(randomGlyph())
        text.setData(DATA_LAST_MORPH, time)
      }
    }
  }

  /** BossPhase 进入 / 结算时清场 —— 别让代码雨盖在 boss 战 UI 上 */
  despawnAll(): void {
    for (const text of this.pool) {
      if (text.active) this.kill(text)
    }
  }

  destroy(): void {
    // Phaser 4 在 scene shutdown 时会先把 group.children 的 Set 置空，晚到的
    // clear(true, true) / destroy(true) 会崩（详见 FlyingEnemyPool.destroy 的
    // 注释）。这里不手动 destroy 池内 text —— group.destroy 没走成也无所谓，
    // scene 销毁时 DisplayList 会兜底回收所有游戏对象。核心目标只是别抛异常
    // 中断 shutdown 链。
    if (!this.group) return
    try {
      const g = this.group as unknown as { children?: { size?: number } }
      if (g.children && typeof g.children.size === 'number') {
        this.group.clear(true, true)
        this.group.destroy(true)
      }
    } catch (err) {
      console.warn('[CodeDanmakuPool] destroy 忽略 Phaser 内部 teardown 异常:', err)
    }
    this.pool.length = 0
  }

  // ---------------------------------------------------------------------------
  // 内部：池分配
  // ---------------------------------------------------------------------------

  /**
   * 从池取一条可用 Text；若池未满就新建并注册到 physics group。
   * 初始字符与位置都占位，调用方负责 spawn() 里写真值。
   */
  private acquire(x: number, y: number): Phaser.GameObjects.Text | null {
    for (const text of this.pool) {
      if (!text.active) return text
    }
    if (this.pool.length >= this.maxSize) return null

    const T = CODE_DANMAKU_TUNING
    const text = this.scene.add.text(x, y, 'ア', {
      fontFamily: '"Courier New", Menlo, Consolas, monospace',
      fontSize: `${T.FONT_PX}px`,
      color: T.COLOR,
      // 轻微阴影让字符在浅色背景上也能认出
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#001108',
        blur: 4,
        fill: true,
        stroke: true,
      },
    })
    text.setOrigin(0.5)
    this.scene.physics.add.existing(text)
    this.group.add(text)
    this.pool.push(text)
    return text
  }
}
