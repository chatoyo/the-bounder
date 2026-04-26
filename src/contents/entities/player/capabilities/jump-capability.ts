/**
 * JumpCapability —— 跳跃（离散事件 + coyote/jump-buffer + 可变次数）。
 *
 * 手感开关（PLAYER_TUNING）：
 *   - COYOTE_FRAMES       ：离开地面仍能地面跳的宽容帧数
 *   - JUMP_BUFFER_FRAMES  ：落地前提前按跳键的缓冲帧数
 *   - JUMP_CUT_MULTIPLIER ：松开跳键时若还在上升，纵速乘该值（可变跳高）
 *   - MAX_AIR_JUMPS       ：地面跳之外还能在空中按几下跳键。默认 1 = 二段跳。
 *
 * 飞行状态下这个 capability 完全不工作（player.isFlying === true 时 no-op）。
 */

import * as Phaser from 'phaser'
import { ACTION_IDS, PLAYER_TUNING } from '@/contents/constants'
import type { ActionId, CapabilityId } from '@/contents/types'
import type { Capability, CapabilityContext } from './capability'
import type { Player } from '../player'

/** 估算 60fps，每帧 ~16.67ms；这里把帧数转 ms 方便 this.scene.time.now 比较 */
const FRAME_MS = 1000 / 60

export class JumpCapability implements Capability {
  readonly id: CapabilityId = 'jump'

  private player!: Player
  private scene!: Phaser.Scene

  /** 上次接触地面的时间戳（用于 coyote） */
  private lastGroundedAt = 0
  /** 上次按下跳键的时间戳（用于 jump-buffer） */
  private lastJumpPressedAt = -Infinity

  /** 本段空中过程中已用掉的空中跳次数（从 0 开始，max = MAX_AIR_JUMPS） */
  private airJumpsUsed = 0

  attach(ctx: CapabilityContext): void {
    this.player = ctx.player
    this.scene = ctx.scene
  }

  detach(): void {
    // 没有需要清理的资源
  }

  update(_time: number, _delta: number): void {
    if (!this.player.alive) return
    if (this.player.isFlying) return

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    const now = this.scene.time.now
    const grounded = body.blocked.down || body.touching.down

    if (grounded) {
      this.lastGroundedAt = now
      // 回到地面 → 空中跳计数清零
      this.airJumpsUsed = 0
    }

    // 地面 / coyote 跳
    const bufferActive = now - this.lastJumpPressedAt <= PLAYER_TUNING.JUMP_BUFFER_FRAMES * FRAME_MS
    const coyoteActive = now - this.lastGroundedAt <= PLAYER_TUNING.COYOTE_FRAMES * FRAME_MS

    if (bufferActive && coyoteActive) {
      body.setVelocityY(PLAYER_TUNING.JUMP_VELOCITY)
      // 用掉这两个窗口
      this.lastJumpPressedAt = -Infinity
      this.lastGroundedAt = -Infinity
    }
  }

  onAction(action: ActionId, phase: 'down' | 'up'): void {
    if (!this.player.alive) return
    if (this.player.isFlying) return
    if (action !== ACTION_IDS.JUMP) return

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body
    const now = this.scene.time.now
    const grounded = body.blocked.down || body.touching.down

    if (phase === 'down') {
      this.lastJumpPressedAt = now

      // 空中跳判定：不在地面且不在 coyote 窗口内 且 还剩 air-jump 次数
      const coyoteActive =
        now - this.lastGroundedAt <= PLAYER_TUNING.COYOTE_FRAMES * FRAME_MS

      if (
        !grounded &&
        !coyoteActive &&
        this.airJumpsUsed < PLAYER_TUNING.MAX_AIR_JUMPS
      ) {
        body.setVelocityY(PLAYER_TUNING.JUMP_VELOCITY)
        this.airJumpsUsed += 1
        // 用掉 buffer，避免接下来的 update() 再吃一次 coyote
        this.lastJumpPressedAt = -Infinity
      }
    } else if (phase === 'up') {
      // 松开时若还在上升，裁短纵速
      if (body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y * PLAYER_TUNING.JUMP_CUT_MULTIPLIER)
      }
    }
  }
}
