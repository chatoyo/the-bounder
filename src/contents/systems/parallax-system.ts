/**
 * ParallaxSystem —— 多层 TileSprite 背景/前景，按 scrollFactor 自动平移。
 *
 * 设计：
 *   - 每层一条 Phaser.GameObjects.TileSprite，宽度填满 camera.width。
 *   - scrollFactorX = layer.scrollFactor → Phaser 渲染时自动做视差。
 *   - scrollFactorY = 0 → 垂直不随相机动（典型背景行为）。
 *   - 当相机很长距离滚动 / TileSprite 宽度不够时，底层 tilePositionX 自动包裹重复纹理。
 *
 * 深度分配（PARALLAX_DEPTHS）：
 *   - background: -2000 + index         （最深）
 *   - midground:  0  （LevelRunner 创建的平台/hazard/checkpoint/pickup 在此）
 *   - foreground: 1000 + index           （最浅）
 *
 * 用法：
 *   const px = new ParallaxSystem(scene, cameraDirector)
 *   px.loadBackground(level.background)
 *   px.loadForeground(level.foreground)
 *   // 每帧由 scene.update() 调 px.update()，以便 auto-scroll 下 TileSprite
 *   // 能按 scrollX 不断重铺（Phaser 自动管 tilePosition，但某些浏览器有
 *   // sub-pixel 漂移 → 我们自己重写 tilePositionX 精确对齐）。
 */

import * as Phaser from 'phaser'
import type { ParallaxLayerDef } from '@/contents/types'
import type { CameraDirector } from './camera-director'

const PARALLAX_DEPTHS = {
  BACKGROUND_BASE: -2000,
  FOREGROUND_BASE: 1000,
} as const

interface Layer {
  readonly def: ParallaxLayerDef
  readonly sprite: Phaser.GameObjects.TileSprite
}

export class ParallaxSystem {
  private scene: Phaser.Scene

  private background: Layer[] = []
  private foreground: Layer[] = []

  // director 目前未用到（TileSprite + scrollFactor 由 Phaser 自动处理），
  // 保留构造参数是为了未来做 shader / 按相机速度动态做 tilePositionX 修正时有钩子。
  constructor(scene: Phaser.Scene, _director: CameraDirector) {
    this.scene = scene
  }

  loadBackground(defs: readonly ParallaxLayerDef[] = []): void {
    this.clearLayers(this.background)
    defs.forEach((def, i) => {
      const layer = this.buildLayer(def, PARALLAX_DEPTHS.BACKGROUND_BASE + i)
      this.background.push(layer)
    })
  }

  loadForeground(defs: readonly ParallaxLayerDef[] = []): void {
    this.clearLayers(this.foreground)
    defs.forEach((def, i) => {
      const layer = this.buildLayer(def, PARALLAX_DEPTHS.FOREGROUND_BASE + i)
      this.foreground.push(layer)
    })
  }

  /** 每帧调一次。纯保险：若 layer.sprite 被外部改 scrollFactor，重置回 def 值 */
  update(_time: number, _delta: number): void {
    // TileSprite + scrollFactor 已经够；保留 hook 方便未来做 shader / 动态色。
  }

  destroy(): void {
    this.clearLayers(this.background)
    this.clearLayers(this.foreground)
  }

  // ---- 内部 ----

  private buildLayer(def: ParallaxLayerDef, defaultDepth: number): Layer {
    const cam = this.scene.cameras.main
    const tex = this.scene.textures.get(def.textureKey)
    const srcImg = tex.getSourceImage()
    const srcH =
      'height' in srcImg && typeof srcImg.height === 'number' ? srcImg.height : cam.height

    const y = this.resolveY(def, srcH)

    // TileSprite 宽度：撑满相机宽度即可；scrollFactor 会自动让"背后的世界"感觉更大。
    const sprite = this.scene.add.tileSprite(
      0,
      y,
      cam.width,
      srcH,
      def.textureKey,
    )
    sprite.setOrigin(0, 0)
    sprite.setScrollFactor(def.scrollFactor, 0)
    sprite.setDepth(def.depth ?? defaultDepth)
    if (def.tint != null) sprite.setTint(def.tint)
    if (def.alpha != null) sprite.setAlpha(def.alpha)

    return { def, sprite }
  }

  private resolveY(def: ParallaxLayerDef, srcH: number): number {
    if (def.y != null) return def.y
    const camH = this.scene.cameras.main.height
    switch (def.anchor ?? 'top') {
      case 'top':
        return 0
      case 'middle':
        return Math.max(0, (camH - srcH) / 2)
      case 'bottom':
        return Math.max(0, camH - srcH)
    }
  }

  private clearLayers(list: Layer[]): void {
    for (const l of list) l.sprite.destroy()
    list.length = 0
  }
}
