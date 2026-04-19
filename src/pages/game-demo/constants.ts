/**
 * 游戏 Demo 常量定义
 * 所有资源 Key、场景 Key、游戏配置集中管理
 */

// ---- 场景 Key ----
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  GAME: 'GameScene',
} as const

// ---- 事件 Key (Phaser <-> Vue 通信) ----
export const EVENT_KEYS = {
  SCORE_UPDATE: 'score:update',
  GAME_OVER: 'game:over',
  GAME_RESTART: 'game:restart',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
} as const

// ---- 游戏配置 ----
export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  STAR_COUNT: 12,
  STAR_RESPAWN_DELAY: 1500,
  PLAYER_SPEED: 300,
  PLAYER_JUMP: -600,
  GRAVITY: 800,
} as const
