/**
 * MoveCapability —— 左右移动（连续状态）。
 *
 * 读 InputSystem 的 isDown('move-left'/'move-right')，写 body.velocity.x 和
 * player.facing。不负责翻转 sprite 图像（那是视觉事）。
 */

import * as Phaser from 'phaser'
import { ACTION_IDS, PLAYER_TUNING } from '@/contents/constants'
import type { CapabilityId } from '@/contents/types'
import type { InputSystem } from '@/contents/systems/input-system'
import type { Capability, CapabilityContext } from './capability'
import type { Player } from '../player'

export class MoveCapability implements Capability {
  readonly id: CapabilityId = 'move'

  private player!: Player
  private input: InputSystem

  constructor(input: InputSystem) {
    this.input = input
  }

  attach(ctx: CapabilityContext): void {
    this.player = ctx.player
  }

  detach(): void {
    // 停止当前水平运动，避免 suppress 后惯性漂移
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null
    body?.setVelocityX(0)
  }

  update(_time: number, _delta: number): void {
    if (!this.player.alive) return
    // 飞行模式下 FlyCapability 全权接管 velocity；此处不插手
    if (this.player.isFlying) return

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    const left = this.input.isDown(ACTION_IDS.MOVE_LEFT)
    const right = this.input.isDown(ACTION_IDS.MOVE_RIGHT)

    let vx = 0
    if (left && !right) {
      vx = -PLAYER_TUNING.MOVE_SPEED
      this.player.facing = -1
    } else if (right && !left) {
      vx = PLAYER_TUNING.MOVE_SPEED
      this.player.facing = 1
    }

    body.setVelocityX(vx)
    // 简单的视觉反馈：朝哪边翻哪边
    this.player.sprite.setFlipX(this.player.facing === -1)
  }
}
