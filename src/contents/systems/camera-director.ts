/**
 * CameraDirector —— 相机模式调度。
 *
 * 模式：
 *   - follow      ：跟随目标 sprite（死区 + lerp）。普通跑酷 / 平台跳跃关。
 *   - auto-right  ：每帧按固定速度 +X 滚动，实现"世界匀速向左流过屏幕"。
 *                   视差、玩家屏幕边界夹紧交给各自的 system 处理。
 *   - lock        ：钉死在一处。对话 / boss 房 / 过场。
 *
 * 设计边界：
 *   - CameraDirector 不读/写世界对象，只控制 `cameras.main.scrollX/Y`。
 *   - auto-scroll 的 "速度单位" 是 "像素/秒"。由 scene 在 update 里调 `update(delta)`。
 *   - 切模式时不会自动归位相机；调用方有需要再 centerOn / scrollTo。
 */

import type * as Phaser from 'phaser'
import { CAMERA_TUNING } from '@/contents/constants'

export type CameraMode = 'follow' | 'auto-right' | 'lock'

export class CameraDirector {
  private camera: Phaser.Cameras.Scene2D.Camera
  private mode: CameraMode = 'follow'

  /** auto-right 模式下，相机每秒向右推进的像素数 */
  private autoScrollSpeed = 0

  constructor(scene: Phaser.Scene) {
    this.camera = scene.cameras.main
  }

  /** 设置世界边界（相机不会滚出这个矩形）。一般在 LevelRunner 加载后立刻调。 */
  setBounds(x: number, y: number, width: number, height: number): void {
    this.camera.setBounds(x, y, width, height)
  }

  /** 模式 A：跟随 —— 带死区 + 平滑 lerp。传入的 target 要是有 x/y 的游戏对象。 */
  follow(target: Phaser.GameObjects.Sprite): void {
    this.mode = 'follow'
    this.autoScrollSpeed = 0
    const { FOLLOW_LERP_X, FOLLOW_LERP_Y, DEAD_ZONE_WIDTH, DEAD_ZONE_HEIGHT } = CAMERA_TUNING

    this.camera.startFollow(target, true, FOLLOW_LERP_X, FOLLOW_LERP_Y)
    this.camera.setDeadzone(DEAD_ZONE_WIDTH, DEAD_ZONE_HEIGHT)
  }

  /**
   * 模式 B：自动向右滚动 —— 相机每帧 scrollX 增加 speed * deltaSeconds。
   * 调用方必须每帧调用 `update(delta)`，否则相机不会移动。
   */
  autoScrollRight(speed: number): void {
    this.mode = 'auto-right'
    this.autoScrollSpeed = speed
    this.camera.stopFollow()
  }

  /** 模式 C：锁定在某点（boss 房 / 对话等需要相机静止的阶段） */
  lock(x: number, y: number): void {
    this.mode = 'lock'
    this.autoScrollSpeed = 0
    this.camera.stopFollow()
    this.camera.centerOn(x, y)
  }

  /** scene.update() 里调一次；仅 auto-right 模式会真正做事 */
  update(_time: number, delta: number): void {
    if (this.mode !== 'auto-right') return
    if (this.autoScrollSpeed <= 0) return
    const dx = (this.autoScrollSpeed * delta) / 1000
    const bounds = this.camera.getBounds()
    const maxScrollX = bounds.width - this.camera.width
    const next = Math.min(this.camera.scrollX + dx, Math.max(0, maxScrollX))
    this.camera.setScroll(next, this.camera.scrollY)
  }

  getMode(): CameraMode {
    return this.mode
  }

  /** 当前相机可视窗口（世界空间矩形）。ScreenBoundsSystem / 视差等都会读 */
  getViewport(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.camera.scrollX,
      y: this.camera.scrollY,
      width: this.camera.width,
      height: this.camera.height,
    }
  }

  /** 当前相机 scrollX；auto-right 模式下每帧递增 */
  getScrollX(): number {
    return this.camera.scrollX
  }

  getAutoScrollSpeed(): number {
    return this.mode === 'auto-right' ? this.autoScrollSpeed : 0
  }

  /** 受伤 / 大事件的屏幕效果透传 */
  shake(durationMs: number, intensity: number): void {
    this.camera.shake(durationMs, intensity)
  }

  flash(durationMs: number, r = 255, g = 255, b = 255): void {
    this.camera.flash(durationMs, r, g, b)
  }

  destroy(): void {
    this.camera.stopFollow()
  }
}
