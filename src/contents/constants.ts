/**
 * 游戏内容常量 —— 全项目唯一源。
 *
 * 归属原则：
 *   - UI 无关、引擎无关的游戏世界数值/标识。
 *   - engine/ 不应 import 本文件（engine 若需要 fallback，走自己的 SHELL_DEFAULTS）。
 *   - runtime/ 不直接 import 具体事件 Key，业务层（scenes / pages）才用。
 *
 * 分组：
 *   1. 标识类 (SCENE_KEYS / EVENT_KEYS / PHASE_IDS / ACTION_IDS / SKILL_IDS /
 *      CAPABILITY_IDS / BIOME_IDS)
 *   2. 游戏世界调参 (GAME_CONFIG / SCROLL_TUNING / PARALLAX_FACTORS)
 *   3. 玩家手感调参 (PLAYER_TUNING / CAMERA_TUNING / POOL_SIZES)
 */

// ---- 场景 Key ----
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  GAMEPLAY: 'GameplayScene',
} as const

// ---- 事件 Key (Phaser <-> Vue 通信) ----
// 命名约定：namespace:verb（小写 + 冒号 + 连字符）。
// 分组顺序：lifecycle → player → level → combat → meta (skill/phase/hud)。
export const EVENT_KEYS = {
  // ---- 生命周期 (Vue → Phaser, 除 GAME_OVER 外) ----
  GAME_OVER: 'game:over',
  GAME_RESTART: 'game:restart',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',

  // ---- 玩家状态 (Phaser → Vue) ----
  PLAYER_HP_CHANGED: 'player:hp-changed',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_DIED: 'player:died',
  PLAYER_RESPAWNED: 'player:respawned',

  // ---- 关卡进度 (Phaser → Vue) ----
  CHECKPOINT_REACHED: 'checkpoint:reached',
  LEVEL_COMPLETED: 'level:completed',
  /**
   * 新关卡 create() 末尾触发。Vue 层的 LevelTransitionOverlay 据此关闭"准备下一关"
   * 面板，也方便未来接入读取进度条 / 淡入动画等过渡 UI。
   */
  LEVEL_STARTED: 'level:started',

  // ---- 拾取 / 交互 (Phaser → Vue) ----
  PICKUP_COLLECTED: 'pickup:collected',

  // ---- 对话 (Phaser → Vue 推进 UI；Vue → Phaser 选择 choice) ----
  DIALOGUE_START: 'dialogue:start',
  DIALOGUE_NODE: 'dialogue:node',
  DIALOGUE_CHOICE_SELECTED: 'dialogue:choice-selected',
  DIALOGUE_ADVANCE: 'dialogue:advance',
  DIALOGUE_END: 'dialogue:end',

  // ---- 战斗 / Boss (Phaser → Vue) ----
  BOSS_SPAWNED: 'boss:spawned',
  BOSS_HP_CHANGED: 'boss:hp-changed',
  BOSS_DEFEATED: 'boss:defeated',
  /**
   * Boss 击破后 ~2s 由 GameplayScene 发出的"结算"事件。Vue 侧的
   * BossVictoryOverlay 据此展开庆祝面板；LEVEL_COMPLETED 随后触发 LevelTransitionOverlay。
   */
  BOSS_VICTORY: 'boss:victory',
  /**
   * Boss 过场视频播放结束（或被跳过）。从 `BossTransitionOverlay` 发出；
   * `GameplayScene.completeLevel` 在 `nextLevelId === 'world-strip-boss'` 时
   * 会等待本事件再 `scene.restart` 进入 boss 场景，替代原本固定 1600ms 的
   * LevelTransitionOverlay 过渡计时。
   */
  BOSS_TRANSITION_ENDED: 'transition:boss-ended',

  // ---- 阶段 / 技能 (Phaser → Vue) ----
  PHASE_CHANGED: 'phase:changed',
  SKILL_UNLOCKED: 'skill:unlocked',
  SKILL_EQUIPPED: 'skill:equipped',
  SKILL_REVOKED: 'skill:revoked',
} as const

// ---- 世界配置（与画幅 / 全局物理相关） ----
export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  GRAVITY: 1100,
  /** 摔出世界下沿多少像素算死亡 */
  FALL_DEATH_MARGIN: 100,
  /** 玩家被自动滚动挤出左侧屏幕多少像素算死亡（压死机制） */
  SCREEN_CRUSH_MARGIN: 16,
} as const

// ---- 自动滚动（"世界向左移动"的核心参数） ----
// 实现方式：相机向右匀速滚动；视觉上等价于"世界匀速向左流过屏幕"。
// 玩家 X 轴被夹在相机可视窗口内（由 ScreenBoundsSystem 维护）。
export const SCROLL_TUNING = {
  /**
   * 关卡默认滚动速度（像素/秒）；单关可以在 LevelDef.scroll.speed 覆盖。
   * 200 的节奏：20 秒过一屏，玩家 MOVE_SPEED=260 仍能挣扎向前。
   */
  DEFAULT_SPEED: 200,
  /** 玩家离左边屏幕边缘多少像素内会"贴墙"被压 */
  LEFT_BOUND_PADDING: 8,
  /** 玩家离右边屏幕边缘多少像素内会被挡住 */
  RIGHT_BOUND_PADDING: 8,
} as const

// ---- 视差系数 ----
// 标准：midground = 1 (世界空间本身)；background 慢于相机；foreground 快于相机。
// 细节再在 LevelDef.background[].scrollFactor 里按层覆盖。
export const PARALLAX_FACTORS = {
  /** 远景（最慢）：山脉 / 深空 */
  SKY: 0.15,
  /** 中远景：云层 / 云雾 */
  FAR: 0.35,
  /** 近景：灌木 / 前景草 */
  NEAR: 1.35,
  /** 超近景：飞过去的粒子 / 花瓣 */
  FOREGROUND: 1.6,
} as const

// ---- 玩家可调参数（"vibe"：跳得软不软、飞得灵不灵，都在这里改） ----
export const PLAYER_TUNING = {
  MAX_HP: 3,
  INVULN_MS: 1000,
  MOVE_SPEED: 260,
  /**
   * 无输入时玩家水平默认前进速度（相对当前世界滚动速度的倍率）。
   * < 1 → 玩家默认比世界慢一点，相机会缓缓把他往左推；按 D/→ 才能真正在屏幕上向右推进。
   * = 1 → 默认与世界同步（屏幕上不动）；= 0 → 老行为（不按键就原地踏步）。
   * 只在 `CameraDirector` 处于 auto-right 模式时生效；follow/locked 模式下为 0。
   */
  BASE_FORWARD_RATIO: 0.8,
  JUMP_VELOCITY: -560,
  /** 松开跳键时若仍在上升，纵速乘以该值 —— 实现"可变跳跃高度" */
  JUMP_CUT_MULTIPLIER: 0.45,
  /** 离开地面后还允许跳的缓冲帧（~60fps） */
  COYOTE_FRAMES: 6,
  /** 落地前提前按跳键的缓冲帧 */
  JUMP_BUFFER_FRAMES: 6,
  /** 最多可在"空中"按跳的次数；1 = 二段跳（1 次地面 + 1 次空中） */
  MAX_AIR_JUMPS: 1,

  BULLET_SPEED: 700,
  BULLET_LIFETIME_MS: 1200,
  FIRE_COOLDOWN_MS: 220,

  // ---- 飞行能力（FlyCapability 用） ----
  /**
   * 飞行时无水平输入的"巡航速度"（= 世界滚动速度 × 该比率）。
   * 1.0 = 在屏幕上悬停不动（玩家与世界同速）；< 1 会被相机推向左缘；
   * > 1 会主动向右跑赢相机。
   */
  FLY_IDLE_RATIO: 1.0,
  /** 飞行水平最高速 相对 巡航速度 的偏移上限 */
  FLY_SPEED_X: 320,
  /** 飞行垂直最高速 */
  FLY_SPEED_Y: 300,
  /** 飞行加速度（按键按下时从 0 到 max 的爬升） */
  FLY_ACCEL: 2200,
  /**
   * 水平 / 垂直 idle 时对"目标速度"的收敛系数（每帧保留的倍数；越大越飘）。
   * vx 的目标是 cruiseSpeed * FLY_IDLE_RATIO，vy 的目标是 0。
   */
  FLY_DAMP: 0.82,
} as const

// ---- 相机调参 ----
export const CAMERA_TUNING = {
  FOLLOW_LERP_X: 0.12,
  FOLLOW_LERP_Y: 0.12,
  DEAD_ZONE_WIDTH: 200,
  DEAD_ZONE_HEIGHT: 140,
} as const

// ---- 对象池尺寸 ----
export const POOL_SIZES = {
  PLAYER_BULLETS: 32,
  ENEMY_BULLETS: 48,
  /** 同时存活的"小飞兵"上限；超过后新 spawn 会返 null */
  FLYING_ENEMIES: 12,
} as const

// ---- 小飞兵 / Flying enemy 调参 ----
// 小体型空中敌人：从右侧视口边外刷出，水平匀速向左漂（世界空间 vx < 0 → 相机同时
// 右滚时玩家看起来是迎面飞来），沿 sin 波做垂直摆动。1 HP 1 接触伤害。
export const FLYING_ENEMY_TUNING = {
  /** 同时存活上限；也是 pool maxSize（与 POOL_SIZES.FLYING_ENEMIES 同步） */
  POOL_SIZE: 12,
  /** 两次 spawn 之间的间隔（ms）；越小越密集 */
  SPAWN_INTERVAL_MS: 1600,
  /** 世界空间水平速度下限（像素/秒，负值 = 向左） */
  VX_MIN: -110,
  /** 世界空间水平速度上限 */
  VX_MAX: -60,
  /** 垂直摆动幅度（像素） */
  SWAY_AMPLITUDE: 28,
  /** 垂直摆动周期（秒） */
  SWAY_PERIOD: 1.5,
  /** spawn 时距相机右边缘的水平外推（像素） */
  SPAWN_MARGIN: 40,
  /** spawn Y 区间（像素，世界空间 → 对 auto-right 关卡相当于屏幕 Y） */
  SPAWN_Y_MIN: 120,
  SPAWN_Y_MAX: 380,
  /** 超过相机左侧 x 多少像素后回池（防止被玩家追回打中） */
  CULL_OFF_LEFT: 80,
  /** 接触玩家伤害 */
  CONTACT_DAMAGE: 1,
} as const

// ---- Phase 阶段 Id（单例 string 字面量用于 FSM / EventBus 载荷） ----
export const PHASE_IDS = {
  RUNNING: 'running',
  RESPAWN: 'respawn',
  DIALOGUE: 'dialogue',
  BOSS: 'boss',
  CUTSCENE: 'cutscene',
  /** 关卡通关短动画 → 载入下一关 */
  LEVEL_END: 'level-end',
} as const

// ---- Action Id（InputSystem 输出的语义动作） ----
export const ACTION_IDS = {
  MOVE_LEFT: 'move-left',
  MOVE_RIGHT: 'move-right',
  MOVE_UP: 'move-up',
  MOVE_DOWN: 'move-down',
  JUMP: 'jump',
  SHOOT: 'shoot',
  INTERACT: 'interact',
  SKILL_2: 'skill-2',
  SKILL_3: 'skill-3',
  /** 对话推进 / 跳过动画 */
  ADVANCE: 'advance',
  /** 对话选项 1 / 2 */
  CHOICE_1: 'choice-1',
  CHOICE_2: 'choice-2',
} as const

// ---- Skill Id ----
export const SKILL_IDS = {
  SHOOT: 'shoot',
  /** 飞行：拾取后解锁，装备时压制 move + jump，启用 4 方向飞行 */
  FLIGHT: 'flight',
} as const

// ---- Capability Id（给 capability 做自我声明 / SkillManager 查表用） ----
export const CAPABILITY_IDS = {
  MOVE: 'move',
  JUMP: 'jump',
  SHOOT: 'shoot',
  FLY: 'fly',
} as const

// ---- Biome Id（LevelRunner 据此选择贴图变体：草地/岩石/冰原/太空） ----
export const BIOME_IDS = {
  GRASS: 'grass',
  STONE: 'stone',
  ICE: 'ice',
  SPACE: 'space',
} as const

// ---- Pickup 类型 Id（PickupSegmentDef.kind / PICKUP_COLLECTED payload） ----
export const PICKUP_IDS = {
  FLIGHT_ORB: 'flight-orb',
  HP_CRYSTAL: 'hp-crystal',
} as const

// ---- Audio asset keys ----
// 约定：key 在 BootScene.preload 里 `this.load.audio(key, url)`，播放侧用
// `this.sound.add(key, ...)`；url 走 Vite 的 `public/` 根（见 public/bgms/*）。
// 音乐文件本身放 public/bgms/*.mp3，菜单音乐由 Vue 页面直接用 HTMLAudio 播放，
// 所以 ASSET_KEYS.AUDIO 这里只收录需要 Phaser 管理的音频。
export const ASSET_KEYS = {
  AUDIO: {
    /** Level 01 BGM —— "Rust City"，GameplayScene 里循环播放 */
    BGM_LEVEL_01: 'bgm-level-01',
  },
} as const

// ---- BGM 资源 URL（Vue 侧 + Phaser 侧共用） ----
// 放在常量表里便于将来统一改路径 / 接入 hashing。
export const BGM_URLS = {
  /** 主菜单（home-page）BGM；Vue 层直接 new Audio(...)  */
  MENU: '/bgms/menu.mp3',
  /** Level 01 BGM；BootScene.preload 里交给 Phaser loader */
  LEVEL_01: '/bgms/1-rust-city.mp3',
} as const

// ---- 音量 / 淡入淡出 调参 ----
export const AUDIO_TUNING = {
  /** 菜单 BGM 默认音量（0-1） */
  MENU_VOLUME: 0.5,
  /** Level 01 BGM 默认音量（0-1） */
  GAME_VOLUME: 0.45,
} as const

// ---- 视频资源 URL（仅供 Vue 层的 <video> overlay 使用，不走 Phaser loader） ----
// 放在 public/videos/ 下；与 BGM_URLS 对应，让将来统一改路径 / 接入 hashing 时
// 有一个集中点。视频 overlay 的生命周期完全在 Vue 侧，不需要 Phaser 预加载。
export const VIDEO_URLS = {
  /** 主菜单 → 游戏之间的第一段过场动画（IntroVideoOverlay 按顺序播放） */
  INTRO_1: '/videos/intro_1.mp4',
  /** 主菜单 → 游戏之间的第二段过场动画 */
  INTRO_2: '/videos/intro_2.mp4',
  /**
   * world-strip-demo 通关后载入 world-strip-boss 之前播放的 boss 过场动画。
   * 由 `BossTransitionOverlay` 播放；播完发 `BOSS_TRANSITION_ENDED` → GameplayScene
   * 接到后 `scene.restart` 进入 boss 场景。
   */
  BOSS_TRANSITION: '/videos/boss_transition.mp4',
} as const

/**
 * 触发 BossTransitionOverlay 的 level id —— 关卡 exit 的 `nextLevelId` 命中此值时，
 * 播放 boss_transition.mp4 代替常规 LevelTransitionOverlay。
 *
 * 与 `LEVEL_WORLD_STRIP_BOSS.id` 保持一致；作为字符串字面量放在这里方便 UI 层
 * 不必 import `data/levels/*`（避免把 LevelDef 构建逻辑拖进 Vue 覆盖层）。
 */
export const BOSS_TRANSITION_LEVEL_ID = 'world-strip-boss'
