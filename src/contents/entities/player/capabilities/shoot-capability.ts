/**
 * ShootCapability —— 基础射击。
 *
 * 按 SHOOT 动作时：若冷却过了，从对象池里取一颗子弹，沿 player.facing 方向发射。
 * 不拥有子弹对象池 —— pool 由 GameplayScene 构造并注入，方便后续升级成
 * "多武器共享池" / "不同子弹类型分池"。
 */

import * as Phaser from 'phaser'
import { ACTION_IDS, ASSET_KEYS, AUDIO_TUNING, PLAYER_TUNING } from '@/contents/constants'
import type { ActionId, CapabilityId } from '@/contents/types'
import type { BulletPool } from '@/contents/entities/projectile/bullet-pool'
import { playSfx } from '@/contents/systems/sfx'
import type { Capability, CapabilityContext } from './capability'
import type { Player } from '../player'

export class ShootCapability implements Capability {
  readonly id: CapabilityId = 'shoot'

  private player!: Player
  private scene!: Phaser.Scene
  private pool: BulletPool

  private lastFiredAt = -Infinity

  constructor(pool: BulletPool) {
    this.pool = pool
  }

  attach(ctx: CapabilityContext): void {
    this.player = ctx.player
    this.scene = ctx.scene
  }

  detach(): void {
    // 对象池由 scene 拥有，这里不销毁它；只是不再往里丢新子弹
  }

  onAction(action: ActionId, phase: 'down' | 'up'): void {
    if (phase !== 'down') return
    if (action !== ACTION_IDS.SHOOT) return
    if (!this.player.alive) return

    const now = this.scene.time.now
    if (now - this.lastFiredAt < PLAYER_TUNING.FIRE_COOLDOWN_MS) return
    this.lastFiredAt = now

    const dir = this.player.facing
    // 枪口偏移：向前 20px，稍微上抬
    const muzzleX = this.player.sprite.x + 20 * dir
    const muzzleY = this.player.sprite.y - 4

    this.pool.fire(muzzleX, muzzleY, PLAYER_TUNING.BULLET_SPEED * dir, 0)
    // 短音效：每次成功 fire 跟一声。冷却已经保证至少间隔 FIRE_COOLDOWN_MS，
    // 连射不会把 SoundManager 拉爆；真没 mp3 也是静默 no-op。
    playSfx(this.scene, ASSET_KEYS.AUDIO.SFX_SHOOT, AUDIO_TUNING.SFX_SHOOT_VOLUME)
    console.log('ShootCapability: shoot: ', this.scene.time.now)
  }
}
