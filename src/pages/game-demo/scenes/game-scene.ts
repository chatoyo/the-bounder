import * as Phaser from 'phaser'
import { SCENE_KEYS, GAME_CONFIG, EVENT_KEYS } from '../constants'
import { eventBus } from '../event-bus'

/**
 * 主游戏场景 - 平台跳跃 + 收集星星
 *
 * 学习要点:
 * 1. Arcade 物理系统：重力、碰撞、overlap
 * 2. 键盘输入处理 (cursors)
 * 3. Group 管理同类游戏对象
 * 4. EventBus 与 Vue HUD 通信
 * 5. shutdown 事件中清理监听器
 */

/** 场景初始化数据接口 */
interface IGameSceneData {
  startScore?: number
}

export class GameScene extends Phaser.Scene {
  // ---- 类型声明 ----
  private player!: Phaser.Physics.Arcade.Sprite
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private stars!: Phaser.Physics.Arcade.Group
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private score = 0
  private gameOver = false

  // debug 开关
  private debug = false

  constructor() {
    super({ key: SCENE_KEYS.GAME })
  }

  init(data: IGameSceneData): void {
    this.score = data.startScore ?? 0
    this.gameOver = false
  }

  create(): void {
    const { WIDTH, HEIGHT, STAR_COUNT, GRAVITY, PLAYER_SPEED } = GAME_CONFIG

    // ---- 背景 ----
    this.cameras.main.setBackgroundColor('#1a1a2e')

    // ---- 平台 ----
    this.platforms = this.physics.add.staticGroup()

    // 地面：横跨整个画面
    const ground = this.platforms.create(WIDTH / 2, HEIGHT - 8, 'platform') as Phaser.Physics.Arcade.Sprite
    ground.setScale(WIDTH / 64, 1).refreshBody()

    // 几个浮空平台
    const platformPositions = [
      { x: 150, y: 420 },
      { x: 450, y: 340 },
      { x: 700, y: 260 },
      { x: 300, y: 180 },
    ]
    for (const pos of platformPositions) {
      const p = this.platforms.create(pos.x, pos.y, 'platform') as Phaser.Physics.Arcade.Sprite
      p.setScale(2, 1).refreshBody()
    }

    // ---- 玩家 ----
    this.player = this.physics.add.sprite(100, HEIGHT - 60, 'player')
    this.player.setCollideWorldBounds(true)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setGravityY(GRAVITY)

    // ---- 星星 ----
    this.stars = this.physics.add.group()
    this.spawnStars(STAR_COUNT)

    // ---- 碰撞 ----
    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.collider(this.stars, this.platforms)
    this.physics.add.overlap(this.player, this.stars, this.collectStar, undefined, this)

    // ---- 键盘 ----
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
    }

    // ---- 监听 Vue 发来的事件 ----
    eventBus.on(EVENT_KEYS.GAME_RESTART, this.handleRestart)
    eventBus.on(EVENT_KEYS.GAME_PAUSE, this.handlePause)
    eventBus.on(EVENT_KEYS.GAME_RESUME, this.handleResume)

    // ---- 场景销毁时清理 ----
    this.events.on('shutdown', () => {
      eventBus.off(EVENT_KEYS.GAME_RESTART, this.handleRestart)
      eventBus.off(EVENT_KEYS.GAME_PAUSE, this.handlePause)
      eventBus.off(EVENT_KEYS.GAME_RESUME, this.handleResume)
    })

    // ---- 初始分数同步给 Vue ----
    eventBus.emit(EVENT_KEYS.SCORE_UPDATE, this.score)

    // ---- Debug 可视化 ----
    if (this.debug) {
      this.physics.world.createDebugGraphic()
    }
  }

  update(): void {
    if (this.gameOver) return

    const { PLAYER_SPEED, PLAYER_JUMP } = GAME_CONFIG
    const body = this.player.body as Phaser.Physics.Arcade.Body

    // 左右移动
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-PLAYER_SPEED)
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(PLAYER_SPEED)
    } else {
      this.player.setVelocityX(0)
    }

    // 跳跃（仅在地面时）
    if (this.cursors.up.isDown && body.touching.down) {
      this.player.setVelocityY(PLAYER_JUMP)
    }
  }

  // ---- 私有方法 ----

  private spawnStars(count: number): void {
    const { WIDTH } = GAME_CONFIG
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(20, WIDTH - 20)
      const y = Phaser.Math.Between(20, 300)
      const star = this.stars.create(x, y, 'star') as Phaser.Physics.Arcade.Sprite
      star.setBounceY(Phaser.Math.FloatBetween(0.2, 0.5))
    }
  }

  private collectStar: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, star) => {
    const s = star as Phaser.Physics.Arcade.Sprite
    s.disableBody(true, true)

    this.score += 10
    eventBus.emit(EVENT_KEYS.SCORE_UPDATE, this.score)

    // 所有星星收集完毕 → 重新生成一波
    if (this.stars.countActive(true) === 0) {
      this.time.delayedCall(GAME_CONFIG.STAR_RESPAWN_DELAY, () => {
        this.spawnStars(GAME_CONFIG.STAR_COUNT)
      })
    }
  }

  private handlePause = (): void => {
    this.scene.pause()
  }

  private handleResume = (): void => {
    this.scene.resume()
  }

  private handleRestart = (): void => {
    this.score = 0
    this.gameOver = false
    this.scene.restart({ startScore: 0 })
  }
}
