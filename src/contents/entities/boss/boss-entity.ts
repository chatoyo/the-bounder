/**
 * BossEntity —— 三阶段 Boss 实体（悬停 + 散射 / 瞄准 / 环爆 + HP 条事件）。
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
 * 悬停浮沉：`update()` 每帧用 sin 波围绕 `hoverBaseY` 做 Y 方向缓动 —— 振幅 +
 * 频率走 `HOVER_AMPLITUDE_PX` / `HOVER_FREQ_RAD` 常量，**三阶段不变**；保证 1→2
 * / 2→3 阶段切换时 y 曲线连续，视觉上"boss 始终保持同一种缓慢浮沉节奏"。
 *
 * 视觉变体：`SPRITE_BY_VARIANT` + `VISUALS_BY_VARIANT` 按 `BossDef.sprite` 查表
 * 决定 textureKey / scale / hitboxRatio。占位变体（hulk/wisp/serpent）直接用
 * BootScene 生成的方块；真素材变体（`colossus` —— 章鱼机械终章 boss）会 setScale
 * + 按 hitboxRatio 收紧 body，让外围触须只是视觉吓人、不参与接触判定。
 *
 * ---------------------------------------------------------------------------
 * 三阶段 AI（2026-04-26 追加，面向 world-strip-boss 终章 boss 战）
 * ---------------------------------------------------------------------------
 *
 * HP 降到阈值时切阶段；每次切阶段发一次 `camera.flash + shake + scale pulse`
 * 让玩家"看得见"难度升级。攻击参数（冷却 / 子弹速度 / 散射角度 / 视觉 tint）
 * 全部列在 `PHASE_CONFIG` 静态表里，调难度改表即可、不用动 update() 骨架。
 *
 *   阶段 1 "觉醒" (HP 100%→~67%)：
 *     - Spread：3 发散射（±15°），每 1400ms 一次；速度 240
 *     - 无 tint
 *   阶段 2 "紧逼" (HP ~67%→~33%)：
 *     - Spread：3 发散射（±18°），每 1100ms 一次；速度 280
 *     - Aimed：1 发瞄准射（追踪玩家当前位置），每 1700ms 一次
 *     - Tint：0xffaa66（琥珀色）
 *   阶段 3 "疯狂" (HP ~33%→0)：
 *     - Spread：5 发更宽散射（±26°），每 900ms 一次；速度 320
 *     - Aimed：每 1200ms 一次
 *     - Ring  ：8 发环形爆发（45° 均分），每 2600ms 一次
 *     - Tint：0xff5566（血红）
 *
 * 阶段判定逻辑写在 `takeHit()` 里（只有被击中时 HP 才下降 → 唯一需要检查的时机）。
 * update() 里按当前阶段读 `PHASE_CONFIG` 决定本帧是否发射哪种子弹。
 *
 * 子弹池由外部注入（EnemyBulletPool 实例 = 一个通用 `BulletPool`）。
 * 玩家引用（用于瞄准射）也由外部注入：BossEntity 只读 `playerSprite.x/y`，
 * 避免和 `Player` 类产生硬耦合（circular import 的预防）。
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
import type { CodeDanmakuPool } from '@/contents/entities/enemies/code-danmaku-pool'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

const SPRITE_BY_VARIANT: Record<NonNullable<BossDef['sprite']>, string> = {
  hulk: 'boss-hulk',
  wisp: 'boss-wisp',
  serpent: 'boss-serpent',
  colossus: 'boss-colossus',
}

/**
 * 每个 sprite 变体的显示 / hitbox 配置。占位变体（hulk/wisp/serpent）纹理已经
 * 按最终显示尺寸绘制（96×96 / 128×96），scale=1 + 默认 hitbox 即可；真素材变体
 * `colossus` 纹理很大（580×420 数量级，含大面积透明区域 + 飘出的触须），需要
 * setScale 缩到屏幕合适尺寸，再按比例收紧 hitbox —— 让玩家可以从触须稀疏处
 * 飞过去而不被判定受击，只有撞到核心机械身体才吃接触伤害。
 *
 * `hitboxRatio`：{w, h} 都是 0-1 的比例，相对于纹理原始尺寸；例如 0.55 = hitbox
 * 占纹理宽度的 55%，另外 45% 都是"触须 / 光晕 / 透明"区域。offset 自动居中。
 */
interface VariantVisuals {
  readonly scale: number
  readonly hitboxRatio?: { w: number; h: number }
}

const VISUALS_BY_VARIANT: Record<NonNullable<BossDef['sprite']>, VariantVisuals> = {
  hulk: { scale: 1 },
  wisp: { scale: 1 },
  serpent: { scale: 1 },
  colossus: {
    // 580×420 → 显示 348×252；半宽 174，放在 baseX=cam.right-160 处 → 从屏幕 x≈466
    // 延伸到 x≈814，右端略出屏 14px（可接受，触须本来就该飘出视野暗示体型）。
    scale: 0.6,
    // 中心 55%×60% 是机械身体 + 红色菱形核，其余都是触须/光晕 → 这部分才算命中。
    hitboxRatio: { w: 0.55, h: 0.6 },
  },
}

/** 三阶段 Id —— 仅内部使用（boss HP 条不向外暴露阶段号）。 */
type PhaseNum = 1 | 2 | 3

interface PhaseConfig {
  /** 散射子弹数量（≥1），1 = 退化为单发正向射 */
  readonly spreadCount: number
  /** 散射总角宽（弧度）—— 均分给 spreadCount 发子弹 */
  readonly spreadArcRad: number
  /** 散射冷却（ms）；Infinity = 本阶段不发散射 */
  readonly spreadCooldownMs: number
  /** 瞄准射冷却（ms）；Infinity = 本阶段不发 aimed */
  readonly aimedCooldownMs: number
  /** 环爆冷却（ms）；Infinity = 本阶段不发 ring */
  readonly ringCooldownMs: number
  /** 环爆子弹数（默认 8） */
  readonly ringCount: number
  /** 子弹速度（px/s） */
  readonly bulletSpeed: number
  /**
   * 阶段视觉 tint（MULTIPLY 模式）。null = 不 tint（恢复原色）。
   * 受击白闪结束后 `applyPhaseVisuals()` 会把 tint 还原到这里。
   */
  readonly tint: number | null
}

export class BossEntity {
  readonly def: BossDef
  readonly sprite: Phaser.Physics.Arcade.Sprite

  private scene: Phaser.Scene
  private hp: number
  private alive = true

  /**
   * 敌方子弹池。BossEntity 只调 `bulletPool.fire(x, y, vx, vy)`，所以任何把 `fire`
   * 实现得和 `BulletPool.fire` 同签名的池都可以注入：
   *   - 占位 / 老关卡：`BulletPool`（紫色圆点 sprite）
   *   - 当前 Boss 战：`CodeDanmakuPool`（绿色代码字符 Text，Matrix 雨视觉）
   * 弹道逻辑（散射 / 瞄准射 / 环爆）对实现无感，换池只换视觉。
   */
  private bulletPool: BulletPool | CodeDanmakuPool
  /** 玩家 sprite 引用 —— 用来算瞄准射的方向；不写只读 */
  private playerSprite: Phaser.Physics.Arcade.Sprite

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

  /** Boss 接触玩家造成的伤害 */
  private static readonly CONTACT_DAMAGE = 1

  /** 悬停浮沉幅度（像素，sin 波峰值离 hoverBaseY 的距离） */
  private static readonly HOVER_AMPLITUDE_PX = 32
  /** 悬停浮沉频率（rad/s），对应周期 2π / freq ≈ 4.83s（@freq=1.3） */
  private static readonly HOVER_FREQ_RAD = 1.3

  /** 阶段切换阈值（相对 maxHp 的比例）—— 低于该比例进入下一阶段 */
  private static readonly PHASE_2_RATIO = 2 / 3
  private static readonly PHASE_3_RATIO = 1 / 3

  /** 三阶段静态参数表。调难度改这张表；update() 只读不写。 */
  private static readonly PHASE_CONFIG: Record<PhaseNum, PhaseConfig> = {
    1: {
      spreadCount: 3,
      spreadArcRad: Phaser.Math.DegToRad(30),
      spreadCooldownMs: 1400,
      aimedCooldownMs: Infinity,
      ringCooldownMs: Infinity,
      ringCount: 0,
      bulletSpeed: 240,
      tint: null,
    },
    2: {
      spreadCount: 3,
      spreadArcRad: Phaser.Math.DegToRad(36),
      spreadCooldownMs: 1100,
      aimedCooldownMs: 1700,
      ringCooldownMs: Infinity,
      ringCount: 0,
      bulletSpeed: 280,
      tint: 0xffaa66,
    },
    3: {
      spreadCount: 5,
      spreadArcRad: Phaser.Math.DegToRad(52),
      spreadCooldownMs: 900,
      aimedCooldownMs: 1200,
      ringCooldownMs: 2600,
      ringCount: 8,
      bulletSpeed: 320,
      tint: 0xff5566,
    },
  }

  /** 当前阶段（1/2/3） */
  private currentPhase: PhaseNum = 1

  /** 各类攻击上次发射的时间戳（scene.time.now；-Infinity = 还没发过） */
  private lastSpreadAt = -Infinity
  private lastAimedAt = -Infinity
  private lastRingAt = -Infinity

  constructor(
    scene: Phaser.Scene,
    def: BossDef,
    bulletPool: BulletPool | CodeDanmakuPool,
    playerSprite: Phaser.Physics.Arcade.Sprite,
  ) {
    this.scene = scene
    this.def = def
    this.bulletPool = bulletPool
    this.playerSprite = playerSprite
    this.hp = def.maxHp
    this.hoverBaseY = def.spawnY

    const variant = def.sprite ?? 'hulk'
    const textureKey = SPRITE_BY_VARIANT[variant]
    const visuals = VISUALS_BY_VARIANT[variant]

    // 相机当前视口 → 算出"本该在这里"的初始 X，再加入场偏移让它落在屏幕外右缘。
    const cam = scene.cameras.main
    const baseX = cam.scrollX + cam.width - BossEntity.BASE_SCREEN_OFFSET_X
    const startX = baseX + this.entry.offset
    this.sprite = scene.physics.add.sprite(startX, def.spawnY, textureKey)
    this.sprite.setScale(visuals.scale)
    // 收紧 hitbox：Arcade body 默认 = 完整纹理矩形；对于带大面积透明光晕的真素材
    // 变体（colossus），默认 hitbox 会把"看得见但根本没身体"的触须区域也算成命中，
    // 玩家飞过时会莫名其妙吃伤害。按 hitboxRatio 裁到只包住核心机械身体。
    if (visuals.hitboxRatio) {
      const tex = this.sprite.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement
      const texW = tex.width
      const texH = tex.height
      const hitW = texW * visuals.hitboxRatio.w
      const hitH = texH * visuals.hitboxRatio.h
      this.sprite.setSize(hitW, hitH)
      // setSize 已自动居中 body，但以防 Phaser 版本差异再显式居中一次。
      this.sprite.setOffset((texW - hitW) / 2, (texH - hitH) / 2)
    }
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

    // 悬停摆动（smooth sin 浮沉）：三阶段统一使用常量振幅 + 频率，不再跟 phase 变化，
    // 保证从 1 → 2 → 3 切换时 y 曲线连续，视觉上"boss 一直在同一种缓慢浮沉节奏里"。
    // 振幅 32 px、频率 1.3 rad/s（周期 ≈4.83s，2.4s 一个上升冲程）—— 够显著让玩家
    // 一眼看见"它在漂浮"，但又慢到符合"庞然大物"的质感，不会显得轻佻。
    const t = time / 1000
    this.sprite.y = this.hoverBaseY + Math.sin(t * BossEntity.HOVER_FREQ_RAD) * BossEntity.HOVER_AMPLITUDE_PX

    // 按当前阶段配置发射各类子弹
    const cfg = BossEntity.PHASE_CONFIG[this.currentPhase]

    if (
      cfg.spreadCooldownMs !== Infinity &&
      time - this.lastSpreadAt >= cfg.spreadCooldownMs
    ) {
      this.lastSpreadAt = time
      this.fireSpread(cfg.spreadCount, cfg.spreadArcRad, cfg.bulletSpeed)
    }

    if (
      cfg.aimedCooldownMs !== Infinity &&
      time - this.lastAimedAt >= cfg.aimedCooldownMs
    ) {
      this.lastAimedAt = time
      this.fireAimed(cfg.bulletSpeed)
    }

    if (
      cfg.ringCooldownMs !== Infinity &&
      time - this.lastRingAt >= cfg.ringCooldownMs
    ) {
      this.lastRingAt = time
      this.fireRing(cfg.ringCount, cfg.bulletSpeed)
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
        // 白闪结束后**不是 clearTint** —— 阶段 2/3 还带颜色 tint，要再应用一次
        this.applyPhaseVisuals()
      }
    })

    eventBus.emit(EVENT_KEYS.BOSS_HP_CHANGED, {
      bossId: this.def.id,
      current: this.hp,
      max: this.def.maxHp,
    } satisfies BossHpChangedPayload)

    // 阶段判定 —— HP 一过阈值立刻切；玩家反馈越快越好
    this.maybeAdvancePhase()

    if (this.hp === 0) this.die()
  }

  destroy(): void {
    this.sprite.destroy()
  }

  // ---- 内部 ----

  /**
   * 按 HP 比例推进阶段。只能单调前进：从 1 → 2 → 3，不回退。
   * 调用时机：`takeHit()` 扣血后。
   */
  private maybeAdvancePhase(): void {
    const ratio = this.hp / this.def.maxHp
    let next: PhaseNum = this.currentPhase
    if (this.currentPhase < 3 && ratio <= BossEntity.PHASE_3_RATIO) next = 3
    else if (this.currentPhase < 2 && ratio <= BossEntity.PHASE_2_RATIO) next = 2

    if (next === this.currentPhase) return

    const from = this.currentPhase
    this.currentPhase = next

    // 重置所有子弹计时器 —— 进入新阶段不应该紧跟着上阶段的冷却继续开火，
    // 否则玩家感知不到节奏变化（尤其是阶段 2→3 冷却大幅缩短时）。
    this.lastSpreadAt = this.scene.time.now
    this.lastAimedAt = this.scene.time.now
    this.lastRingAt = this.scene.time.now

    // 视觉：相机 flash + shake + boss scale pulse；颜色随阶段渐深
    const cam = this.scene.cameras.main
    if (next === 2) {
      cam.flash(240, 255, 200, 120)
      cam.shake(220, 0.006)
    } else {
      cam.flash(300, 255, 100, 100)
      cam.shake(320, 0.01)
    }
    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: 1.3, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
    })

    this.applyPhaseVisuals()

    // 阶段转换每场 boss 战最多两次（1→2、2→3），留一条 log 方便调参 / 复盘
    console.log(`[BossEntity] phase ${from} → ${next} (HP ${this.hp}/${this.def.maxHp})`)
  }

  /** 按 currentPhase 的 tint 配置应用颜色。null = 清 tint。 */
  private applyPhaseVisuals(): void {
    const cfg = BossEntity.PHASE_CONFIG[this.currentPhase]
    if (cfg.tint == null) {
      this.sprite.clearTint()
    } else {
      this.sprite.setTint(cfg.tint)
    }
    this.sprite.setTintMode(Phaser.TintModes.MULTIPLY)
  }

  /**
   * 散射：以 baseAngle=PI（朝左）为中心，在 `arcRad` 总角宽内均匀分布 `count` 发子弹。
   * count=1 时退化为一发正向射（偏移 0）。
   */
  private fireSpread(count: number, arcRad: number, speed: number): void {
    if (count <= 0) return
    const baseAngle = Math.PI // 朝玩家方向（左）
    const startX = this.sprite.x - 40
    const startY = this.sprite.y
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const offset = -arcRad / 2 + t * arcRad
      const angle = baseAngle + offset
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      this.bulletPool.fire(startX, startY, vx, vy)
    }
  }

  /**
   * 瞄准射：一发朝玩家当前位置发射。距离 0 时 fallback 到朝左（边界保护）。
   */
  private fireAimed(speed: number): void {
    const dx = this.playerSprite.x - this.sprite.x
    const dy = this.playerSprite.y - this.sprite.y
    const len = Math.hypot(dx, dy)
    let vx: number
    let vy: number
    if (len < 1) {
      // Boss 和玩家几乎重合 → 直接朝左射，避免除零
      vx = -speed
      vy = 0
    } else {
      vx = (dx / len) * speed
      vy = (dy / len) * speed
    }
    this.bulletPool.fire(this.sprite.x, this.sprite.y, vx, vy)
  }

  /**
   * 环形爆发：围绕 boss 均匀分布 `count` 发子弹，全向散开。
   * 玩家在飞行状态下可以上/下/左/右躲开 —— 保留"不 overwhelming"的手感。
   */
  private fireRing(count: number, speed: number): void {
    if (count <= 0) return
    const startX = this.sprite.x
    const startY = this.sprite.y
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      this.bulletPool.fire(startX, startY, vx, vy)
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
