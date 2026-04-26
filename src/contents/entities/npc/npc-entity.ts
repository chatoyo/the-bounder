/**
 * NpcEntity —— 剧情 / 对话用的静态 NPC。
 *
 * 行为：
 *   - 在世界空间站一个 sprite，无物理（不会被玩家撞翻、不受重力）。
 *   - 暴露一个 `Phaser.GameObjects.Zone` 作为交互 hitbox；scene 侧通过
 *     `physics.overlap(player, npc.zone, ...)` 检测接近。
 *   - 浮动一个 "!" 提示符表明"可以交互"；玩家走进交互区时闪烁更显眼。
 *
 * 不持有对话运行器；对话状态由上层 `DialogueRunner` + `DialoguePhase` 管。
 * 本类只负责"被发现 / 被按 E / 报告我是谁"。
 */

import * as Phaser from 'phaser'
import type { NpcSegmentDef } from '@/contents/types'

const SPRITE_BY_VARIANT: Record<NonNullable<NpcSegmentDef['sprite']>, string> = {
  sage: 'npc-sage',
  merchant: 'npc-merchant',
  warrior: 'npc-warrior',
}

export class NpcEntity {
  readonly id: string
  readonly dialogueId: string
  readonly sprite: Phaser.GameObjects.Sprite
  readonly zone: Phaser.GameObjects.Zone
  private bubble: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, def: NpcSegmentDef) {
    this.id = def.id
    this.dialogueId = def.dialogueId

    const textureKey = SPRITE_BY_VARIANT[def.sprite ?? 'sage'] ?? 'npc-sage'
    this.sprite = scene.add.sprite(def.x, def.y, textureKey)
    this.sprite.setDepth(5)

    // 交互 hitbox：比 sprite 略大，玩家只要靠近即可
    this.zone = scene.add.zone(def.x, def.y, 64, 72)
    scene.physics.add.existing(this.zone, true) // static body
    // zone 的 body 是 StaticBody；需要 refresh 以更新 size
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody
    body.setSize(64, 72)
    body.updateFromGameObject()

    // 上方浮动 "!" 提示
    this.bubble = scene.add.text(def.x, def.y - 36, '!', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffe066',
      stroke: '#000',
      strokeThickness: 3,
    })
    this.bubble.setOrigin(0.5, 1)
    this.bubble.setDepth(6)

    scene.tweens.add({
      targets: this.bubble,
      y: def.y - 44,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** 玩家在交互区内时外部可以调这个做更强的视觉提示 */
  setHighlighted(on: boolean): void {
    this.bubble.setColor(on ? '#ffcc33' : '#ffe066')
    this.bubble.setScale(on ? 1.3 : 1)
  }

  destroy(): void {
    this.bubble.destroy()
    this.zone.destroy()
    this.sprite.destroy()
  }
}
