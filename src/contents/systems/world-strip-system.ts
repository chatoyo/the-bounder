/**
 * WorldStripSystem —— 按 chunk 把 "world strip" 图片铺进世界空间。
 *
 * 与 LevelRunner.tickSpawner 平行运作：
 *   - LevelRunner 负责 platforms / hazards / checkpoints 的周期副本；
 *   - WorldStripSystem 负责把 strip.images 里的每一张图按 placement 在每个
 *     chunk 里实例化一份 Phaser.GameObjects.Image（不是 TileSprite —— 图片
 *     本身就已经是"长条世界"，不需要再平铺）。
 *
 * 渲染规则（关键）：
 *   - scrollFactor = 1：图片与 midground 同速（= 世界空间坐标）。
 *   - depth 按 chunk × image 递增：`WORLD_STRIP_DEPTH_BASE + k * N + imageIdx`。
 *     这样"滚动方向靠后"的图始终画在"靠前"的图上方，overlap 区域被后图覆盖。
 *   - WORLD_STRIP_DEPTH_BASE 取很小的负数（-10000），确保图片位于 platform /
 *     player / parallax 以下，不会挡住其它游戏对象。
 *
 * 生命周期：
 *   - tickSpawner(scrollX, viewWidth) 每帧调一次，补齐 / 回收 chunk（和
 *     LevelRunner 用一样的滑动窗口）。
 *   - destroy() 清空所有已生成的 image。
 */

import * as Phaser from 'phaser'
import type { BuiltWorldStripLevel } from '@/contents/types'

/** 所有 world-strip 图片的 depth 起点。保证在任何游戏对象之下。 */
const WORLD_STRIP_DEPTH_BASE = -10000

export class WorldStripSystem {
  private readonly scene: Phaser.Scene
  private readonly built: BuiltWorldStripLevel
  /** chunk 索引 → 该 chunk 下创建的所有 Image（按 imageIdx 顺序） */
  private readonly chunkObjects = new Map<number, Phaser.GameObjects.Image[]>()

  constructor(scene: Phaser.Scene, built: BuiltWorldStripLevel) {
    this.scene = scene
    this.built = built
  }

  /**
   * 每帧由 GameplayScene 调（仅在启用 strip 的关卡里生效）。
   *
   * loop=true：滑动窗口 —— 把相机视窗前后各 1 个 chunk 的 strip 图片保持在场。
   * loop=false：整条 strip 只出现一次（chunk 0），超出部分相机 clamp 到世界右端；
   *   首帧调用时把 chunk 0 铺好，之后保持不变。
   */
  tickSpawner(scrollX: number, viewWidth: number): void {
    const W = this.built.chunkWidth
    if (W <= 0) return

    let minK: number
    let maxK: number
    if (this.built.loop) {
      minK = Math.max(0, Math.floor(scrollX / W) - 1)
      maxK = Math.floor((scrollX + viewWidth) / W) + 1
    } else {
      // 非循环：只保留 chunk 0 —— 相机到达世界右端 (W - cam.width) 就停了，
      // 永远不会看到 chunk 1 之后的内容，没必要生成。
      minK = 0
      maxK = 0
    }

    for (let k = minK; k <= maxK; k++) {
      if (!this.chunkObjects.has(k)) this.spawnChunk(k)
    }
    for (const k of Array.from(this.chunkObjects.keys())) {
      if (k < minK || k > maxK) this.despawnChunk(k)
    }
  }

  private spawnChunk(k: number): void {
    if (this.chunkObjects.has(k)) return
    const offset = k * this.built.chunkWidth
    const images: Phaser.GameObjects.Image[] = []
    const N = this.built.placements.length
    const stripHeight = this.built.strip.height
    for (const p of this.built.placements) {
      const img = this.scene.add
        .image(offset + p.leftX, 0, p.textureKey)
        .setOrigin(0, 0)
        .setScrollFactor(1, 1)
        // 显式把贴图缩到声明的显示尺寸：既兜底原生 ≠ 显示（例如 3018×1280 → 1584×672），
        // 也在用户调整 WorldStripImageDef.width 时自动跟随，不用重新出图。
        .setDisplaySize(p.width, stripHeight)
        // 后一张图盖在前一张之上；跨 chunk 也保持这个序。
        .setDepth(WORLD_STRIP_DEPTH_BASE + k * N + p.imageIdx)
      images.push(img)
    }
    this.chunkObjects.set(k, images)
  }

  private despawnChunk(k: number): void {
    const imgs = this.chunkObjects.get(k)
    if (!imgs) return
    for (const g of imgs) {
      if (g.scene) g.destroy()
    }
    this.chunkObjects.delete(k)
  }

  destroy(): void {
    for (const k of Array.from(this.chunkObjects.keys())) {
      this.despawnChunk(k)
    }
  }
}
