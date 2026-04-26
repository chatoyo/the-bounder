/**
 * ScreenBoundsSystem —— 把玩家夹在"相机可视窗口"内。
 *
 * 谁用：
 *   - 自动滚动关（auto-right）：世界在向右流过，玩家必须被锁在屏幕里。
 *   - 飞行模式：4 方向自由移动也必须不能飞出屏幕。
 *
 * 谁不用：
 *   - 传统跟随关：跟随本身保证玩家在屏幕中间，不需要 clamp。
 *
 * 行为：
 *   - enabled=false 时 update() 是 no-op，外层可以在对话 / boss 等阶段关它。
 *   - 夹左 / 夹右都只改玩家 X；夹上 / 夹下 可选（飞行时才开）。
 *   - 若玩家被相机 **从左边追撞**（auto-scroll 推挤），会回调 onCrush()；
 *     scene 侧挂上去 → 扣血 / 杀玩家 / 结算。
 */

import type * as Phaser from 'phaser'
import { SCROLL_TUNING } from '@/contents/constants'
import type { CameraDirector } from './camera-director'

export interface ScreenBoundsConfig {
  /** 是否夹 Y 轴（飞行时开） */
  clampY: boolean
  /** 左右留白（防止贴边） */
  padLeft: number
  padRight: number
  padTop: number
  padBottom: number
}

const DEFAULT_CONFIG: ScreenBoundsConfig = {
  clampY: false,
  padLeft: SCROLL_TUNING.LEFT_BOUND_PADDING,
  padRight: SCROLL_TUNING.RIGHT_BOUND_PADDING,
  padTop: 8,
  padBottom: 8,
}

export type CrushCallback = () => void

export class ScreenBoundsSystem {
  private target: Phaser.Physics.Arcade.Sprite | null = null
  private director: CameraDirector
  private config: ScreenBoundsConfig
  private enabled = true
  private crushCb: CrushCallback | null = null

  constructor(director: CameraDirector, config: Partial<ScreenBoundsConfig> = {}) {
    this.director = director
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  setTarget(sprite: Phaser.Physics.Arcade.Sprite | null): void {
    this.target = sprite
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  setConfig(patch: Partial<ScreenBoundsConfig>): void {
    this.config = { ...this.config, ...patch }
  }

  /** 注册 "被挤死" 回调。玩家紧贴左边缘且相机还在向右推进时触发 */
  onCrush(cb: CrushCallback): void {
    this.crushCb = cb
  }

  update(_time: number, _delta: number): void {
    if (!this.enabled || !this.target) return

    const sprite = this.target
    const body = sprite.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    const vp = this.director.getViewport()
    const halfW = (body.width ?? sprite.displayWidth) / 2
    const halfH = (body.height ?? sprite.displayHeight) / 2

    const minX = vp.x + this.config.padLeft + halfW
    const maxX = vp.x + vp.width - this.config.padRight - halfW

    // 记录压挤条件
    const distFromLeft = sprite.x - (vp.x + halfW)
    const scrollSpeed = this.director.getAutoScrollSpeed()

    if (sprite.x < minX) {
      sprite.x = minX
      body.x = sprite.x - halfW
      body.setVelocityX(Math.max(body.velocity.x, 0))
      // 被挤到左边 && 相机还在推进 → 判死
      if (scrollSpeed > 0 && distFromLeft <= this.config.padLeft + 0.5 && this.crushCb) {
        this.crushCb()
      }
    } else if (sprite.x > maxX) {
      sprite.x = maxX
      body.x = sprite.x - halfW
      body.setVelocityX(Math.min(body.velocity.x, 0))
    }

    if (this.config.clampY) {
      const minY = vp.y + this.config.padTop + halfH
      const maxY = vp.y + vp.height - this.config.padBottom - halfH
      if (sprite.y < minY) {
        sprite.y = minY
        body.y = sprite.y - halfH
        body.setVelocityY(Math.max(body.velocity.y, 0))
      } else if (sprite.y > maxY) {
        sprite.y = maxY
        body.y = sprite.y - halfH
        body.setVelocityY(Math.min(body.velocity.y, 0))
      }
    }
  }

  destroy(): void {
    this.target = null
    this.crushCb = null
  }
}
