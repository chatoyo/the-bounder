/**
 * World collision setup —— 所有"玩家 vs 关卡静态物 / 拾取物"的物理 wiring。
 *
 * 之前散在 GameplayScene.create 一百多行；提取出来让 scene 端只剩一行调用。
 * 不返回任何句柄：Phaser scene shutdown 时会自动拆掉这些 collider/overlap。
 */
import * as Phaser from 'phaser'
import {
  ASSET_KEYS,
  AUDIO_TUNING,
  EVENT_KEYS,
} from '@/contents/constants'
import { Player } from '@/contents/entities/player/player'
import { BulletPool } from '@/contents/entities/projectile/bullet-pool'
import { LevelRunner } from '@/contents/systems/level-runner'
import { playSfx } from '@/contents/systems/sfx'
import type { CheckpointReachedPayload } from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

export interface WorldCollisionDeps {
  readonly scene: Phaser.Scene
  readonly player: Player
  readonly playerBullets: BulletPool
  readonly levelRunner: LevelRunner
  /** 拾取物 overlap 时回调，scene 端处理"是什么道具 + 加技能/血量等" */
  readonly onPickup: (go: Phaser.GameObjects.GameObject) => void
}

export function setupWorldCollisions(deps: WorldCollisionDeps): void {
  const { scene, player, playerBullets, levelRunner, onPickup } = deps

  // 玩家踩平台
  scene.physics.add.collider(player.sprite, levelRunner.platforms)

  // 玩家子弹打到平台 → 子弹回池
  scene.physics.add.collider(
    playerBullets.group,
    levelRunner.platforms,
    (bullet) => {
      playerBullets.kill(bullet as Phaser.Physics.Arcade.Sprite)
    },
  )

  // 玩家踩 hazard → 扣血
  scene.physics.add.overlap(
    player.sprite,
    levelRunner.hazards,
    (_playerGO, hazardGO) => {
      if (!player.alive) return
      const dmg = levelRunner.getHazardDamage(hazardGO as Phaser.GameObjects.GameObject)
      player.damage(dmg, 'hazard')
    },
  )

  // 玩家撞 checkpoint → 激活 + 短音效（仅"新激活"才响一次）
  scene.physics.add.overlap(
    player.sprite,
    levelRunner.checkpoints,
    (_playerGO, cpGO) => {
      const res = levelRunner.handleCheckpointTouched(cpGO as Phaser.GameObjects.GameObject)
      if (res && res.changed) {
        const sp = levelRunner.getActiveSpawn()
        eventBus.emit(EVENT_KEYS.CHECKPOINT_REACHED, {
          id: res.id,
          x: sp.x,
        } satisfies CheckpointReachedPayload)
        playSfx(scene, ASSET_KEYS.AUDIO.SFX_CHECKPOINT, AUDIO_TUNING.SFX_CHECKPOINT_VOLUME)
      }
    },
  )

  // 玩家碰拾取物 → 走 scene 端回调
  scene.physics.add.overlap(
    player.sprite,
    levelRunner.pickups,
    (_playerGO, pickupGO) => {
      if (!player.alive) return
      onPickup(pickupGO as Phaser.GameObjects.GameObject)
    },
  )
}
