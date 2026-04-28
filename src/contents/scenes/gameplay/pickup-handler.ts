/**
 * PickupHandler —— 玩家踩到拾取物时的具体处理：
 *   - 让 LevelRunner 把这个 sprite 标记为已消费（避免重复触发）
 *   - emit PICKUP_COLLECTED 给 Vue 层
 *   - 按 kind 应用副作用：
 *       flight-orb → 解锁 + 装备 FLIGHT
 *       hp-crystal → 视觉 flash（heal API 暂未实现）
 *
 * 单一函数 + 闭包，没必要做成 class。
 */
import * as Phaser from 'phaser'
import { EVENT_KEYS, SKILL_IDS } from '@/contents/constants'
import { CameraDirector } from '@/contents/systems/camera-director'
import { LevelRunner } from '@/contents/systems/level-runner'
import { SkillManager } from '@/contents/systems/skill-manager'
import type { PickupCollectedPayload } from '@/contents/types'
import { useEventBus } from '@/runtime'

const eventBus = useEventBus()

export interface PickupHandlerDeps {
  readonly levelRunner: LevelRunner
  readonly skillManager: SkillManager
  readonly cameraDirector: CameraDirector
}

export function makePickupHandler(deps: PickupHandlerDeps): (go: Phaser.GameObjects.GameObject) => void {
  const { levelRunner, skillManager, cameraDirector } = deps
  return (go: Phaser.GameObjects.GameObject): void => {
    const meta = levelRunner.getPickupMeta(go)
    if (!meta) return
    levelRunner.consumePickup(go)

    const sprite = go as Phaser.GameObjects.Sprite
    eventBus.emit(EVENT_KEYS.PICKUP_COLLECTED, {
      id: meta.id,
      kind: meta.kind as PickupCollectedPayload['kind'],
      x: sprite.x,
      y: sprite.y,
    } satisfies PickupCollectedPayload)

    if (meta.kind === 'flight-orb') {
      skillManager.unlock(SKILL_IDS.FLIGHT)
      skillManager.equip(SKILL_IDS.FLIGHT)
      cameraDirector.flash(200, 255, 230, 120)
    } else if (meta.kind === 'hp-crystal') {
      // 简化：补满血通道暂未实现，只做视觉 flash
      cameraDirector.flash(200, 255, 120, 120)
    }
  }
}
