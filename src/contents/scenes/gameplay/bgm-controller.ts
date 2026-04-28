/**
 * BgmController —— 关卡 BGM 的整段生命周期。
 *
 * 用法：
 *   const bgm = new BgmController(scene)
 *   bgm.start(levelId)          // create() 末尾
 *   bgm.pause() / bgm.resume()  // GAME_PAUSE / GAME_RESUME 时
 *   bgm.stop()                  // 关卡转场前（让过场视频接管声场）
 *   bgm.destroy()               // shutdown 链路里
 *
 * 设计点：
 *   - audio 在 BootScene 里通过 `this.load.audio(key, url)` 预加载；
 *     这里只做 `sound.add` + play。
 *   - play 可能被浏览器 autoplay 策略阻塞，Phaser 会在用户首次输入后自动 resume
 *     AudioContext；不要让 play 失败把场景带炸。
 */
import * as Phaser from 'phaser'
import { AUDIO_TUNING } from '@/contents/constants'
import { LEVEL_BGM } from '@/contents/data/levels'

export class BgmController {
  private bgm: Phaser.Sound.BaseSound | null = null
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * 按 levelId 查表 → 加载并循环播放。
   *   - 表里没有的关卡 → 静音（不报错）；
   *   - 表里有但 cache 里找不到（preload 漏加）→ 控制台 warn + 静音。
   */
  start(levelId: string): void {
    const key = LEVEL_BGM[levelId]
    if (!key) return
    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`[BgmController] BGM "${key}" 未加载（检查 BootScene.preload），跳过`)
      return
    }
    this.bgm = this.scene.sound.add(key, {
      loop: true,
      volume: AUDIO_TUNING.GAME_VOLUME,
    })
    try {
      this.bgm.play()
    } catch (err) {
      console.warn('[BgmController] BGM play 阻塞（将在用户首次输入后恢复）:', err)
    }
  }

  pause(): void {
    // scene.pause 不会停 sound manager；BGM 要手动暂停，否则暂停菜单下音乐仍在循环。
    this.bgm?.pause()
  }

  resume(): void {
    this.bgm?.resume()
  }

  /**
   * 立刻停掉 —— 用在关卡转场前（boss 过场视频 / 通关 overlay 期间）让旧 BGM
   * 不要再循环。stop 必须在 scene.restart 之前发生，等到 shutdown 就已经晚了。
   */
  stop(): void {
    this.bgm?.stop()
  }

  destroy(): void {
    this.bgm?.stop()
    this.bgm?.destroy()
    this.bgm = null
  }
}
