/**
 * BossPhase —— Boss 战斗的 in-scene FSM 状态。
 *
 * 设计（2026-04-26 修订）：**世界不停**。
 *   - auto-scroll 相机继续推进；BossEntity 自己每帧追踪相机右缘来保持"呆在视口里"。
 *   - 这样 boss 像是"从右侧追上来"的敌人，而不是"战斗进入一个静止的 boss 房"。
 *   - screenBounds / parallax / chunk spawner / 玩家 capability 全部保持运行；
 *     GameplayScene 不再因为 inCombat 而关掉任何系统。
 *
 * 进入时（enter）：
 *   - 实例化 BossEntity（它自己会处理从右侧滑入 + 每帧追随相机）。
 *   - 挂好玩家子弹 vs boss 命中、玩家 vs boss 接触、玩家 vs 敌方子弹的 collider / overlap。
 *
 * 每帧（update）：
 *   - tick boss.update()
 *   - cull 敌方子弹池
 *
 * 退出（exit）：
 *   - 解除 colliders、销毁 boss / 敌方子弹池。相机无需恢复 auto-scroll（本来就没停）。
 *
 * Boss 死亡由 `BOSS_DEFEATED` 事件驱动：phase 留 2s 给死亡动画 + "世界继续流动"
 * 的缓冲，然后发一个 phase-local 事件（SCENE_EVENT_BOSS_PHASE_CLEARED）给 scene，
 * 再自己 transition 回 running。scene 侧会接着打开 BossVictoryOverlay 结算面板。
 */

import * as Phaser from 'phaser'
import { EVENT_KEYS, PHASE_IDS, POOL_SIZES } from '@/contents/constants'
import type { BossDef, PhaseId } from '@/contents/types'
import { useEventBus } from '@/runtime'
import { CodeDanmakuPool } from '@/contents/entities/enemies/code-danmaku-pool'
import { BossEntity } from '@/contents/entities/boss/boss-entity'
import type { Phase, PhaseContext } from '../phase-controller'

const eventBus = useEventBus()

/** Scene 级事件：BossPhase 结束时发，GameplayScene 接 → 继续 completeLevel */
export const SCENE_EVENT_BOSS_PHASE_CLEARED = 'boss-phase-cleared'

export interface BossPhaseEnterData {
  bossDef: BossDef
  /** 当前关卡 id；用于 phase-end 后 scene 触发 LEVEL_COMPLETED */
  levelId: string
  /**
   * boss 被击破后要载入的下一关 id（来自 BossTriggerSegmentDef.nextLevelId）。
   * 缺省时 scene 侧按 level-exit 兜底；loop 关卡缺省 → 老行为（继续跑）。
   */
  nextLevelId?: string
}

export class BossPhase implements Phase {
  readonly id: PhaseId = PHASE_IDS.BOSS

  private ctx: PhaseContext
  private boss: BossEntity | null = null
  /**
   * 敌方子弹池。Boss 战的"紫色圆点"被换成 Matrix 风格的绿色代码字符；
   * 弹道（散射 / 瞄准射 / 环爆）完全由 BossEntity 不变地驱动，只是视觉
   * 呈现改成 `CodeDanmakuPool`。
   */
  private enemyBullets: CodeDanmakuPool | null = null

  private colliders: Phaser.Physics.Arcade.Collider[] = []

  constructor(ctx: PhaseContext) {
    this.ctx = ctx
  }

  enter(data?: unknown): void {
    const d = data as BossPhaseEnterData | undefined
    if (!d) {
      console.warn('[BossPhase] enter 未传 bossDef；切回 running')
      this.ctx.controller.transition(PHASE_IDS.RUNNING)
      return
    }

    const scene = this.ctx.scene
    // 相机：**故意不锁**。auto-scroll 继续推进，boss 自己会每帧跟随相机保持在
    // 视口右侧；下面也不会调用 director.lock()（这是 2026-04-26 之后的设计修订）。

    // 敌方子弹池：Matrix 风格绿色代码字符（替换原来的紫色 sprite BulletPool）。
    // BossEntity 只调 `.fire(x, y, vx, vy)`；CodeDanmakuPool 的 fire 和 BulletPool.fire
    // 同签名，所以弹道、命中、overlap 全部保持不变。
    this.enemyBullets = new CodeDanmakuPool(scene, POOL_SIZES.ENEMY_BULLETS)

    // 实例化 Boss —— 把玩家 sprite 引用传进去，Boss 的瞄准射（phase 2+）
    // 要据此算方向。BossEntity 只读 sprite.x/y，不持有 Player 类，避免
    // 跨层循环依赖。
    this.boss = new BossEntity(scene, d.bossDef, this.enemyBullets, this.ctx.player.sprite)

    // 玩家子弹 vs boss
    //
    // 防御式过滤：Phaser Arcade 的 overlap 每帧都会 detect 同一对 (bullet, boss) 直到
    // body.enable 被翻为 false；若一颗子弹完全穿过 boss 需要多帧（bullet 11.7px/frame,
    // boss 96px 宽 → ~8 帧），哪怕我们在 collide callback 里立刻 disable body，
    // 本帧已经安排好的 overlap check 仍可能照常触发一次 takeHit，导致单颗子弹打出
    // 多次伤害、boss 秒死。processCallback 早于 collide callback 执行，且返回 false
    // 可以 short-circuit 本次 overlap —— 这里用它再加一道闸：只有活着的子弹才计伤。
    //
    // **参数顺序坑**：Phaser Arcade 的 overlap(group, sprite, cb) 在内部会把参数重排
    // 成 `collideSpriteVsGroup(sprite, group)` —— 不论调用者传 (group, sprite) 还是
    // (sprite, group)，callback 收到的永远是 `(spriteGO, groupMemberGO)`，即 boss 在
    // 前、bullet 在后（见 phaser/src/physics/arcade/World.js:1946 + 2090）。此前把
    // 第一参数当 bullet 来禁用 body / setActive(false) / setPosition(-9999, -9999)，
    // 实际上禁用的是 boss 本体：一颗子弹命中后 boss body 被关掉，后续子弹的 overlap
    // 直接在 `collideSpriteVsGroup` 入口因 `bodyA.enable === false` 退出，boss 也因此
    // 不再和玩家 sprite 发生碰撞。所以这里把 boss 放在 overlap 第一参数、bullet 在第二，
    // 并把 callback 签名对齐为 `(bossGO, bullet)` —— 顺序和 Phaser 实际传参一致，
    // 读代码时不用再反向脑补。
    const processBulletVsBoss: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = ((
      _bossGO: Phaser.Physics.Arcade.Sprite,
      bullet: Phaser.Physics.Arcade.Sprite,
    ) => {
      if (!bullet.active) return false
      const body = bullet.body as Phaser.Physics.Arcade.Body | null
      if (!body || body.enable === false) return false
      return true
    }) as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback

    const onBulletHitBoss: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      _bossGO,
      bullet,
    ) => {
      if (!this.boss?.isAlive()) return
      const b = bullet as Phaser.Physics.Arcade.Sprite
      if (!b.active) return
      // 立刻让 group 把它视为已死：killAndHide + body.enable = false + 丢到界外。
      // 最后一步是因为部分 Phaser 版本会在本次 step 结束前再扫一遍 overlap，
      // 仅仅 setActive/disable 可能被本帧的剩余 overlap pass 忽略。
      playerBulletsGroup?.killAndHide(b)
      const body = b.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        body.enable = false
        body.setVelocity(0, 0)
      }
      b.setPosition(-9999, -9999)
      this.boss.takeHit(1)
    }
    // 玩家子弹池的 group 可以通过 scene.data / 约定 key 共享；这里走 scene 自定义事件拿
    // —— 为了避免耦合，直接在 scene 侧挂 collider：让 scene 在 SCENE_EVENT 里告诉我们
    // 玩家子弹的 group。简单做法：从 scene.data 取；由 GameplayScene.create 里事先 set。
    const playerBulletsGroup = this.ctx.scene.data.get('playerBulletsGroup') as
      | Phaser.Physics.Arcade.Group
      | undefined
    if (playerBulletsGroup) {
      this.colliders.push(
        scene.physics.add.overlap(
          this.boss.sprite,
          playerBulletsGroup,
          onBulletHitBoss,
          processBulletVsBoss,
        ) as Phaser.Physics.Arcade.Collider,
      )
    }

    // 玩家 vs boss 接触：扣血
    this.colliders.push(
      scene.physics.add.overlap(
        this.ctx.player.sprite,
        this.boss.sprite,
        () => {
          if (!this.boss?.isAlive()) return
          if (!this.ctx.player.alive) return
          this.ctx.player.damage(this.boss.getContactDamage(), 'enemy')
        },
      ) as Phaser.Physics.Arcade.Collider,
    )

    // 玩家 vs 敌方子弹（Matrix 代码弹幕）
    // enemyBullets.group 里装的是 `Phaser.GameObjects.Text`（不是 Sprite），所以
    // 这里不 narrow 到 Sprite —— `CodeDanmakuPool.kill` 接 `GameObject`，命中后
    // 走它的统一回池流程，和老 BulletPool 调用姿势一致。
    this.colliders.push(
      scene.physics.add.overlap(
        this.ctx.player.sprite,
        this.enemyBullets.group,
        (_p, bulletGO) => {
          if (!this.ctx.player.alive) return
          const b = bulletGO as Phaser.GameObjects.GameObject
          if (!b.active) return
          this.enemyBullets?.kill(b)
          this.ctx.player.damage(1, 'enemy')
        },
      ) as Phaser.Physics.Arcade.Collider,
    )

    // 监听 boss 死亡 → 过几拍后发"phase cleared" + 切回 running
    eventBus.on(EVENT_KEYS.BOSS_DEFEATED, this.onBossDefeated)
    // 把 levelId / nextLevelId 暂存供 cleared 时用（scene 侧按 key 反查，
    // 避免把 PhaseContext 表面积扩大）
    this.ctx.scene.data.set('bossPhaseLevelId', d.levelId)
    this.ctx.scene.data.set('bossPhaseNextLevelId', d.nextLevelId ?? null)
  }

  update(time: number, delta: number): void {
    this.boss?.update(time, delta)
    this.enemyBullets?.cull(time)
  }

  exit(): void {
    eventBus.off(EVENT_KEYS.BOSS_DEFEATED, this.onBossDefeated)
    for (const c of this.colliders) c.destroy()
    this.colliders.length = 0

    // 若 phase 被中断（boss 还没死就切走 —— 绝大多数情况是玩家死亡 → RESPAWN）：
    // 把 `firedBossTriggers` 清掉，保证 respawn 后玩家再次走到 trigger 能让 boss 重新登场。
    // 如果 boss 已经死了（正常完结），不清 —— 避免 auto-scroll loop 关卡里 boss 反复刷。
    if (this.boss?.isAlive()) {
      this.ctx.levelRunner.clearFiredBossTriggers()
    }

    this.boss?.destroy()
    this.boss = null
    this.enemyBullets?.destroy()
    this.enemyBullets = null
    // 相机模式由 scene 决定（通常 BossPhase 结束后 scene 立即 completeLevel）
  }

  private onBossDefeated = (): void => {
    // 2 秒缓冲：让死亡动画播完 + 世界继续以 auto-scroll 流动的节奏"缓一下"，
    // 再通知 scene 打开结算面板。600ms 太短，玩家会觉得 boss 一死马上就弹窗、
    // 世界戛然而止；2s 能让"击破 → 世界依旧在动 → 结算"的层次更清晰。
    this.ctx.scene.time.delayedCall(2000, () => {
      this.ctx.scene.events.emit(SCENE_EVENT_BOSS_PHASE_CLEARED)
      if (this.ctx.controller.getCurrentId() === PHASE_IDS.BOSS) {
        this.ctx.controller.transition(PHASE_IDS.RUNNING)
      }
    })
  }
}
