/**
 * BossPhase —— Boss 战斗的 in-scene FSM 状态。
 *
 * 进入时（enter）：
 *   - 停掉 auto-scroll，把相机锁在 boss 附近。
 *   - 实例化 BossEntity；挂好玩家子弹 vs boss 命中、玩家 vs boss 接触、
 *     玩家 vs 敌方子弹的 collider / overlap。
 *
 * 每帧（update）：
 *   - tick boss.update()
 *   - cull 敌方子弹池
 *
 * 退出（exit）：
 *   - 解除 colliders、销毁 boss / 敌方子弹池、放行 auto-scroll 或切走到 level-exit。
 *
 * Boss 死亡由 `BOSS_DEFEATED` 事件驱动：phase 捕获后让 scene.completeLevel()（通过
 * PhaseContext.scene.events 发一个 phase-local 事件），再自己 transition 回 running。
 */

import * as Phaser from 'phaser'
import { EVENT_KEYS, PHASE_IDS, POOL_SIZES } from '@/contents/constants'
import type { BossDef, PhaseId } from '@/contents/types'
import { useEventBus } from '@/runtime'
import { BulletPool } from '@/contents/entities/projectile/bullet-pool'
import { BossEntity } from '@/contents/entities/boss/boss-entity'
import type { Phase, PhaseContext } from '../phase-controller'

const eventBus = useEventBus()

/** Scene 级事件：BossPhase 结束时发，GameplayScene 接 → 继续 completeLevel */
export const SCENE_EVENT_BOSS_PHASE_CLEARED = 'boss-phase-cleared'

export interface BossPhaseEnterData {
  bossDef: BossDef
  /** 当前关卡 id；用于 phase-end 后 scene 触发 LEVEL_COMPLETED */
  levelId: string
}

export class BossPhase implements Phase {
  readonly id: PhaseId = PHASE_IDS.BOSS

  private ctx: PhaseContext
  private boss: BossEntity | null = null
  private enemyBullets: BulletPool | null = null

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
    // 相机：停止 auto-scroll 并平移到 boss 附近（scene.data['cameraDirector']
    // 由 scene.create 注入，避免 ctx 表面积扩大）
    const director = scene.data.get('cameraDirector') as
      | { lock: (x: number, y: number) => void }
      | undefined
    director?.lock(d.bossDef.spawnX - 100, 300)

    // 敌方子弹池（寿命短一点，避免满屏紫点）
    this.enemyBullets = new BulletPool(scene, 'enemy-bullet', POOL_SIZES.ENEMY_BULLETS, 2000)

    // 实例化 Boss
    this.boss = new BossEntity(scene, d.bossDef, this.enemyBullets)

    // 玩家子弹 vs boss
    const onBulletHitBoss: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
      bullet,
      _bossGO,
    ) => {
      if (!this.boss?.isAlive()) return
      // 从 scene 里找玩家子弹池比较繁琐；直接 kill sprite 即可
      const b = bullet as Phaser.Physics.Arcade.Sprite
      b.setActive(false).setVisible(false)
      const body = b.body as Phaser.Physics.Arcade.Body | null
      if (body) body.enable = false
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
          playerBulletsGroup,
          this.boss.sprite,
          onBulletHitBoss,
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

    // 玩家 vs 敌方子弹
    this.colliders.push(
      scene.physics.add.overlap(
        this.ctx.player.sprite,
        this.enemyBullets.group,
        (_p, bulletGO) => {
          if (!this.ctx.player.alive) return
          const b = bulletGO as Phaser.Physics.Arcade.Sprite
          if (!b.active) return
          this.enemyBullets?.kill(b)
          this.ctx.player.damage(1, 'enemy')
        },
      ) as Phaser.Physics.Arcade.Collider,
    )

    // 监听 boss 死亡 → 过几拍后发"phase cleared" + 切回 running
    eventBus.on(EVENT_KEYS.BOSS_DEFEATED, this.onBossDefeated)
    // 把 levelId 暂存供 cleared 时用
    this.ctx.scene.data.set('bossPhaseLevelId', d.levelId)
  }

  update(time: number, delta: number): void {
    this.boss?.update(time, delta)
    this.enemyBullets?.cull(time)
  }

  exit(): void {
    eventBus.off(EVENT_KEYS.BOSS_DEFEATED, this.onBossDefeated)
    for (const c of this.colliders) c.destroy()
    this.colliders.length = 0
    this.boss?.destroy()
    this.boss = null
    this.enemyBullets?.destroy()
    this.enemyBullets = null
    // 相机模式由 scene 决定（通常 BossPhase 结束后 scene 立即 completeLevel）
  }

  private onBossDefeated = (): void => {
    // 稍微延迟让击杀特效播放
    this.ctx.scene.time.delayedCall(600, () => {
      this.ctx.scene.events.emit(SCENE_EVENT_BOSS_PHASE_CLEARED)
      if (this.ctx.controller.getCurrentId() === PHASE_IDS.BOSS) {
        this.ctx.controller.transition(PHASE_IDS.RUNNING)
      }
    })
  }
}
