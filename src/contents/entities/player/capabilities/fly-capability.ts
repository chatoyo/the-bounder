/**
 * FlyCapability —— 自由飞行（4 方向 + 零重力）。
 *
 * 挂载时机：拾到飞行道具后由 SkillManager.equip(FLIGHT) 触发。
 *
 * 行为：
 *   - attach()  ：关闭玩家重力、设 player.isFlying = true
 *                  （MoveCapability / JumpCapability 见此 flag 会自动 no-op）。
 *   - update()  ：按 4 方向 action 施加加速度，松开按键按 FLY_DAMP 阻尼。
 *                 velocity 被 clamp 到 FLY_SPEED_{X,Y}。
 *   - onAction  ：不用；4 方向都是连续输入走 update()。
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

    if (left && !right) {
      vx -= accel * dt
      this.player.facing = -1
    } else if (right && !left) {
      vx += accel * dt
      this.player.facing = 1
    } else {
      vx *= PLAYER_TUNING.FLY_DAMP
      if (Math.abs(vx) < 2) vx = 0
    }

    if (up && !down) {
      vy -= accel * dt
    } else if (down && !up) {
      vy += accel * dt
    } else {
      vy *= PLAYER_TUNING.FLY_DAMP
      if (Math.abs(vy) < 2) vy = 0
    }

    // clamp
    vx = Phaser.Math.Clamp(vx, -PLAYER_TUNING.FLY_SPEED_X, PLAYER_TUNING.FLY_SPEED_X)
    vy = Phaser.Math.Clamp(vy, -PLAYER_TUNING.FLY_SPEED_Y, PLAYER_TUNING.FLY_SPEED_Y)

    body.setVelocity(vx, vy)
    this.player.sprite.setFlipX(this.player.facing === -1)
  }
}
