/**
 * 游戏内容层共享类型。
 *
 * 只放"UI 无关、跨文件"的类型定义；单文件自用的局部类型就地声明。
 * 事件载荷必须在这里有名字（AGENTS.md §6 "Typed events"）。
 */

import type {
  ACTION_IDS,
  BIOME_IDS,
  CAPABILITY_IDS,
  PHASE_IDS,
  PICKUP_IDS,
  SCENE_KEYS,
  SKILL_IDS,
} from './constants'

// ---------------------------------------------------------------------------
// 通用 ID 联合类型（由 constants 里的 as const 对象反推）
// ---------------------------------------------------------------------------

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS]
export type PhaseId = (typeof PHASE_IDS)[keyof typeof PHASE_IDS]
export type ActionId = (typeof ACTION_IDS)[keyof typeof ACTION_IDS]
export type SkillId = (typeof SKILL_IDS)[keyof typeof SKILL_IDS]
export type CapabilityId = (typeof CAPABILITY_IDS)[keyof typeof CAPABILITY_IDS]
export type BiomeId = (typeof BIOME_IDS)[keyof typeof BIOME_IDS]
export type PickupId = (typeof PICKUP_IDS)[keyof typeof PICKUP_IDS]

// ---------------------------------------------------------------------------
// 场景入参
// ---------------------------------------------------------------------------

/** GameplayScene 启动时可携带的上下文（来自上一个场景 / 重启 / 关卡切换） */
export interface IGameplaySceneData {
  /** 重启时可以指定从哪个 checkpoint 开始；默认走 level.checkpoints[0] */
  startCheckpointId?: string
  /** 切换到的关卡 id；不传则用缺省关卡 */
  levelId?: string
  /** 进入本关时玩家已解锁的 skill 集合（跨关卡持久化，例如飞行） */
  unlockedSkills?: SkillId[]
}

// ---------------------------------------------------------------------------
// 视差背景 / 前景图层
// ---------------------------------------------------------------------------

/**
 * 一层视差图（TileSprite）。
 *
 * 实现：LevelRunner 按列表顺序从深到浅创建 TileSprite，
 * 统一设 `scrollFactorX = scrollFactor` + `scrollFactorY = 0`，每帧无须干预。
 * 相机向右滚 → Phaser 自动按 scrollFactor 平移。
 */
export interface ParallaxLayerDef {
  /** 使用哪张纹理（需预先生成/加载） */
  readonly textureKey: string
  /** 水平视差系数；0 = 完全静止，1 = 与 midground 同速，>1 = 超前 */
  readonly scrollFactor: number
  /**
   * 图层在屏幕中的 Y（像素；以 camera 顶端为 0）。
   * 不填则按 `anchor` 自动：'top' → 0，'bottom' → (世界高 - 纹理高)，'middle' → 居中。
   */
  readonly y?: number
  readonly anchor?: 'top' | 'middle' | 'bottom'
  /** 可选色染（0xRRGGBB） */
  readonly tint?: number
  /** 额外透明度 0..1 */
  readonly alpha?: number
  /** 图层 depth；数字越大越靠前。缺省 PARALLAX_DEPTHS 分配 */
  readonly depth?: number
}

// ---------------------------------------------------------------------------
// 滚动模式
// ---------------------------------------------------------------------------

/**
 * 关卡滚动配置。
 * - 'auto-right'：相机匀速向右滚（"世界向左流过"）；玩家被夹在屏幕内。
 * - 'follow'：传统跟随玩家；用于 boss 房 / 早期教学场景。
 * - 'locked'：相机钉死；用于对话 / 过场。
 */
export type ScrollMode = 'auto-right' | 'follow' | 'locked'

export interface LevelScrollDef {
  readonly mode: ScrollMode
  /** auto-right 模式的滚动速度（像素/秒），缺省 SCROLL_TUNING.DEFAULT_SPEED */
  readonly speed?: number
}

// ---------------------------------------------------------------------------
// 关卡数据 —— 声明式段落（discriminated union）
// ---------------------------------------------------------------------------

// 世界物件（midground；参与物理）
// ---------------------------------------------------------------------------

export interface PlatformSegmentDef {
  type: 'platform'
  x: number
  y: number
  width: number
  height: number
  /** 可选 biome 覆盖；不填继承 LevelDef.biome */
  biome?: BiomeId
}

export interface HazardSegmentDef {
  type: 'hazard'
  x: number
  y: number
  width: number
  height: number
  /** 本次碰撞扣血量，默认 1 */
  damage?: number
}

export interface CheckpointSegmentDef {
  type: 'checkpoint'
  id: string
  x: number
  y: number
  /** 复活时玩家脚底放在这个 Y 下方（默认取 checkpoint.y 本身） */
  spawnY?: number
}

/** NPC 段：预占位，demo/Phase B 里物化成 NpcEntity */
export interface NpcSegmentDef {
  type: 'npc'
  id: string
  x: number
  y: number
  /** 交互时启动的对话 tree id（查表在 data/dialogues/） */
  dialogueId: string
  /** 贴图变体；不填用缺省 NPC */
  sprite?: 'sage' | 'merchant' | 'warrior'
}

/** 拾取物段：玩家踩到即消失，触发 PICKUP_COLLECTED 事件 */
export interface PickupSegmentDef {
  type: 'pickup'
  id: string
  kind: PickupId
  x: number
  y: number
}

/** Boss 触发段：玩家进入 x 之后切到 BossPhase，同时停止自动滚动 */
export interface BossTriggerSegmentDef {
  type: 'boss-trigger'
  id: string
  /** 触发 x（玩家 sprite.x 超过这个值即切入 boss phase） */
  x: number
  /** Boss 数据 id；查 data/bosses/ */
  bossId: string
}

/** 关卡终点：接触后切 LEVEL_COMPLETED + 过渡到下一关 */
export interface LevelExitSegmentDef {
  type: 'level-exit'
  id: string
  x: number
  y: number
  /** 下一关 id；'credits' / null 表示结局 */
  nextLevelId?: string
}

export type SegmentDef =
  | PlatformSegmentDef
  | HazardSegmentDef
  | CheckpointSegmentDef
  | NpcSegmentDef
  | PickupSegmentDef
  | BossTriggerSegmentDef
  | LevelExitSegmentDef

export interface LevelDef {
  readonly id: string
  /**
   * 关卡总宽度（像素）。非 loop 模式作相机 / 世界边界；loop 模式下是"单个重复块"的宽度
   * （除非用 `chunkWidth` 覆盖）。
   */
  readonly width: number
  readonly height: number
  /** 关卡主题；LevelRunner 据此选贴图变体 */
  readonly biome: BiomeId
  /** 滚动策略；缺省 'auto-right' */
  readonly scroll?: LevelScrollDef
  /**
   * 水平无限循环 flag。true 时 LevelRunner 把 platforms / hazards / checkpoints
   * 当作"周期块"，随相机推进滑动窗口式地前后生成；checkpoint 在每个 chunk 获得
   * `${id}@${k}` 的唯一 id，spawnById 永久保留用于 respawn。
   *
   * pickups / npcs / boss-triggers / level-exits 仍然只在原始坐标出现一次
   * （它们本来就是单次触发语义）。"无限关卡"与"会不会转场到下一关"是正交的：
   *   - 想纯粹无限跑：关卡就别写 level-exit。
   *   - 想跑一段再转场：正常写 level-exit，会在触碰后跳转 nextLevelId。
   */
  readonly loop?: boolean
  /**
   * loop 模式下的单块宽度。缺省 = `width`。把它设得小于 `width` 会在 [0, chunkWidth)
   * 范围内重复，超出的 segment 会在原始 x 位置生成但不会循环。
   */
  readonly chunkWidth?: number
  /** 玩家初始出生点（若不指定，则使用首个 checkpoint） */
  readonly spawn?: { x: number; y: number }
  /** 背景视差图层（从远到近）；midground 本身不在这里描述 */
  readonly background?: readonly ParallaxLayerDef[]
  /** 前景视差图层（从近到超近） */
  readonly foreground?: readonly ParallaxLayerDef[]
  /** 实际游戏物件 */
  readonly segments: readonly SegmentDef[]
}

/** LevelRunner 构建完关卡后对外暴露的实例数据 */
export interface LoadedLevel {
  readonly def: LevelDef
  readonly platforms: Phaser.Physics.Arcade.StaticGroup
  readonly hazards: Phaser.Physics.Arcade.StaticGroup
  readonly checkpoints: Phaser.Physics.Arcade.StaticGroup
  readonly pickups: Phaser.Physics.Arcade.StaticGroup
  /** NPC / Boss trigger / Level exit 都是逻辑性段，按需通过 helper 查询 */
}

// ---------------------------------------------------------------------------
// 技能数据
// ---------------------------------------------------------------------------

export type SkillKind = 'passive' | 'active'

export interface SkillDef {
  readonly id: SkillId
  readonly displayName: string
  readonly kind: SkillKind
  /** 激活该技能时挂载的 capability id 列表 */
  readonly capabilities: readonly CapabilityId[]
  /** 仅 active 技能生效：触发该 capability 的 Action Id */
  readonly hotkey?: ActionId
  /**
   * 装备该 skill 时自动压制的其它 skill id。
   * 例：flight 压制 shoot 与 move+jump 的组合（用于 Phase B+ 机制）。
   * Phase A 只声明、不强制；SkillManager 会在 equip 时顺带 suppress。
   */
  readonly suppresses?: readonly SkillId[]
}

// ---------------------------------------------------------------------------
// 对话数据（Phase B 用；先把类型铺上去，运行时稳） ----
// ---------------------------------------------------------------------------

export interface DialogueChoice {
  readonly label: string
  /** 选完后跳到哪个 node；若为 null 直接结束对话 */
  readonly next: string | null
  /** 选择副作用（例如 grant-skill） */
  readonly commands?: readonly DialogueCommand[]
}

export type DialogueCommand =
  | { readonly type: 'grant-skill'; readonly id: SkillId }
  | { readonly type: 'equip-skill'; readonly id: SkillId }
  | { readonly type: 'heal'; readonly amount: number }
  | { readonly type: 'set-flag'; readonly key: string; readonly value: boolean }

export interface DialogueNode {
  readonly id: string
  readonly speaker: string
  readonly text: string
  /** 进入本节点时执行的命令 */
  readonly onEnter?: readonly DialogueCommand[]
  /** 若有 choices 则等待玩家选择；否则按 next（或 advance 按键）推进 */
  readonly choices?: readonly DialogueChoice[]
  readonly next?: string | null
}

export interface DialogueDef {
  readonly id: string
  readonly startNodeId: string
  readonly nodes: Readonly<Record<string, DialogueNode>>
}

// ---------------------------------------------------------------------------
// Boss 数据（骨架；具体攻击模式由 BossEntity 内部实现）
// ---------------------------------------------------------------------------

export interface BossDef {
  readonly id: string
  readonly displayName: string
  readonly maxHp: number
  /** Boss 初始出现的世界 x / y（通常是 boss 房中央） */
  readonly spawnX: number
  readonly spawnY: number
  /** 视觉变体（placeholder 时期决定颜色/形状） */
  readonly sprite?: 'hulk' | 'wisp' | 'serpent'
}

// ---------------------------------------------------------------------------
// 事件载荷（所有 Phaser → Vue / Vue → Phaser 的典型 payload）
// ---------------------------------------------------------------------------

export interface PlayerHpChangedPayload {
  current: number
  max: number
}

export interface PlayerDamagedPayload {
  amount: number
  remaining: number
}

export interface PlayerDiedPayload {
  /** 'hazard' | 'fall' | 'enemy' | 'crush'（被屏幕左缘挤死） */
  cause: 'hazard' | 'fall' | 'enemy' | 'crush'
}

export interface PlayerRespawnedPayload {
  checkpointId: string
  x: number
  y: number
}

export interface CheckpointReachedPayload {
  id: string
  x: number
}

export interface LevelCompletedPayload {
  levelId: string
  nextLevelId?: string
}

export interface PickupCollectedPayload {
  id: string
  kind: PickupId
  x: number
  y: number
}

export interface DialogueStartPayload {
  dialogueId: string
  speaker: string
  text: string
  nodeId: string
}

export interface DialogueNodePayload {
  dialogueId: string
  nodeId: string
  speaker: string
  text: string
  choices?: { label: string; index: number }[]
}

export interface DialogueChoiceSelectedPayload {
  dialogueId: string
  nodeId: string
  choiceIndex: number
}

export interface DialogueEndPayload {
  dialogueId: string
}

export interface BossSpawnedPayload {
  bossId: string
  displayName: string
  maxHp: number
}

export interface BossHpChangedPayload {
  bossId: string
  current: number
  max: number
}

export interface BossDefeatedPayload {
  bossId: string
}

export interface PhaseChangedPayload {
  from: PhaseId | null
  to: PhaseId
}

export interface SkillEquippedPayload {
  id: SkillId
  displayName: string
  kind: SkillKind
  /** 绑定的 hotkey（仅 active 技能有） */
  hotkey?: ActionId
}

export interface SkillRevokedPayload {
  id: SkillId
}
