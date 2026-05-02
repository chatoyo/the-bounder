/**
 * BootScene —— 资源加载 + 占位纹理生成 + 切场。
 *
 * 实际工作分散在 `boot/` 子目录里：
 *   - `boot/asset-loader.ts` —— preload 阶段的 audio / image 加载
 *   - `boot/texture-factory.ts` —— 占位纹理（真素材没传时的兜底）
 *   - `boot/player-anims.ts` —— 全局 'player-run' 动画注册
 */
import * as Phaser from 'phaser'
import { SCENE_KEYS } from '@/contents/constants'
import { useGame } from '@/runtime'
import { preloadAssets } from './boot/asset-loader'
import { generatePlaceholderTextures } from './boot/texture-factory'
import { registerPlayerAnims } from './boot/player-anims'

const game = useGame()

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT })
  }

  preload(): void {
    // 使用相机真实视口尺寸，不硬编码 GAME_CONFIG（画布已是全屏 RESIZE 模式）
    const cam = this.cameras.main
    const cx = cam.width / 2
    const cy = cam.height / 2

    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(cx - 160, cy - 15, 320, 30)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0x00ff88, 1)
      progressBar.fillRect(cx - 150, cy - 10, 300 * value, 20)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
    })

    preloadAssets(this)
  }

  create(): void {
    generatePlaceholderTextures(this)
    registerPlayerAnims(this)
    game.switchToScene(SCENE_KEYS.GAMEPLAY)
  }
}
