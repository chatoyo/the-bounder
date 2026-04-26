/**
 * FlyCapability —— 自由飞行（4 方向 + 零重力 + 随世界巡航）。
 *
 * 挂载时机：拾到飞行道具后由 SkillManager.equip(FLIGHT) 触发。
 *
 * 行为：
 *   - attach()  ：关玩家重力、设 `player.isFlying = true`。
 *   - update()  ：
 *       * 水平无输入时 vx 向 `cruiseSpeed × FLY_IDLE_RATIO` 收敛 —— 默认比率 1.0，
 *         即刚好跟上世界滚动。玩家松手就"悬在原处"，不会被 auto-scroll 推挤。
 *       * 按住 left/right 在巡航基础上加减速度，clamp 到 `cruise ± FLY_SPEED_X`。
 *       * 垂直方向仍以 0 为目标（松手慢慢停住，没重力回落）。
 *   - detach()  ：恢复重力、清 isFlying；velocity 交给重力自行处理。
 *
 * 屏幕边界夹紧由 ScreenBoundsSystem 负责，本 capability 不重复处理；
 * 飞行时 scene 侧应让 ScreenBoundsSystem.setConfig({ clampY: true })。
 */

import * as Phaser from 'phaser'
import { ACTION_IDS, GAME_CONFIG, PLAYER_TUNING } from '@/contents/constants'
import type { CapabilityId } from '@/contents/types'
import type { InputSystem } from '@/contents/systems/input-system'
import type { Capability, CapabilityContext } from './capability'
import type { Player } from '../player'

export class FlyCapability implements Capability {
  readonly id: CapabilityId = 'fly'

  private player!: Player
  private input: InputSystem

  /** 记录 attach 前的重力值，detach 时还原 */
  private prevGravityY: number = GAME_CONFIG.GRAVITY

  constructor(input: InputSystem) {
    this.input = input
  }

  attach(ctx: CapabilityContext): void {
    this.player = ctx.player
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    this.prevGravityY = body.gravity.y || GAME_CONFIG.GRAVITY
    body.setAllowGravity(false)
    body.setGravityY(0)
    this.player.isFlying = true

    // 初始水平速度直接设到巡航速度，避免"刚起飞被甩到屏幕左边"的卡顿感
    const cruise = this.getIdleTargetX()
    body.setVelocityX(cruise)
  }

  detach(): void {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null
    if (body) {
      body.setAllowGravity(true)
      body.setGravityY(this.prevGravityY)
    }
    this.player.isFlying = false
  }

  update(_time: number, delta: number): void {
    if (!this.player.alive) return
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body

    const left = this.input.isDown(ACTION_IDS.MOVE_LEFT)
    const right = this.input.isDown(ACTION_IDS.MOVE_RIGHT)
    const up = this.input.isDown(ACTION_IDS.MOVE_UP)
    const down = this.input.isDown(ACTION_IDS.MOVE_DOWN)

    const dt = delta / 1000 // 秒
    const accel = PLAYER_TUNING.FLY_ACCEL

    let vx = body.velocity.x
    let vy = body.velocity.y

    // ---- 水平 ----
    const cruise = this.getIdleTargetX()
    if (left && !right) {
      vx -= accel * dt
      this.player.facing = -1
    } else if (right && !left) {
      vx += accel * dt
      this.player.facing = 1
    } else {
      // 无输入 → 向巡航速度收敛
      vx = cruise + (vx - cruise) * PLAYER_TUNING.FLY_DAMP
      if (Math.abs(vx - cruise) < 1) vx = cruise
    }

    // ---- 垂直 ----
    if (up && !down) {
      vy -= accel * dt
    } else if (down && !up) {
      vy += accel * dt
    } else {
      vy *= PLAYER_TUNING.FLY_DAMP
      if (Math.abs(vy) < 2) vy = 0
    }

    // clamp —— 水平相对巡航速度；垂直绝对
    const vxMin = cruise - PLAYER_TUNING.FLY_SPEED_X
    const vxMax = cruise + PLAYER_TUNING.FLY_SPEED_X
    vx = Phaser.Math.Clamp(vx, vxMin, vxMax)
    vy = Phaser.Math.Clamp(vy, -PLAYER_TUNING.FLY_SPEED_Y, PLAYER_TUNING.FLY_SPEED_Y)

    body.setVelocity(vx, vy)
    this.player.sprite.setFlipX(this.player.facing === -1)
  }

  private getIdleTargetX(): number {
    return this.player.getCruiseSpeed() * PLAYER_TUNING.FLY_IDLE_RATIO
  }
}
