import * as Phaser from 'phaser'
import { SCENE_KEYS, GAME_CONFIG } from '../constants'

/**
 * 启动场景 - 用占位图形生成纹理，无需外部素材文件
 *
 * 学习要点:
 * 1. Phaser.Scene 的 Class 结构
 * 2. preload / create 生命周期
 * 3. 用 Graphics 生成纹理 (generateTexture) 替代真实图片
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT })
  }

  preload(): void {
    // 显示加载进度（demo 里瞬间完成，但结构要有）
    const { WIDTH: width, HEIGHT: height } = GAME_CONFIG
    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0x00ff88, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 10, 300 * value, 20)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
    })
  }

  create(): void {
    // ---- 用 Graphics 生成占位纹理 ----

    // 玩家：蓝色矩形 32x48
    const playerGfx = this.make.graphics({ x: 0, y: 0 })
    playerGfx.fillStyle(0x4488ff, 1)
    playerGfx.fillRect(0, 0, 32, 48)
    playerGfx.generateTexture('player', 32, 48)
    playerGfx.destroy()

    // 星星：黄色圆形 16x16
    const starGfx = this.make.graphics({ x: 0, y: 0 })
    starGfx.fillStyle(0xffdd00, 1)
    starGfx.fillCircle(8, 8, 8)
    starGfx.generateTexture('star', 16, 16)
    starGfx.destroy()

    // 平台：绿色矩形 (会在 GameScene 里 tileSprite 或直接缩放)
    const platformGfx = this.make.graphics({ x: 0, y: 0 })
    platformGfx.fillStyle(0x44aa44, 1)
    platformGfx.fillRect(0, 0, 64, 16)
    platformGfx.generateTexture('platform', 64, 16)
    platformGfx.destroy()

    // 跳转到主游戏场景
    this.scene.start(SCENE_KEYS.GAME)
  }
}
