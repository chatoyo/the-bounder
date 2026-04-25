/**
 * 游戏内容常量 —— 全项目唯一源。
 *
 * 归属原则：
 *   - UI 无关、引擎无关的游戏世界数值/标识。
 *   - engine/ 不应 import 本文件（engine 若需要 fallback，走自己的 SHELL_DEFAULTS）。
 *   - runtime/ 不直接 import 具体事件 Key，业务层（scenes / pages）才用。
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
