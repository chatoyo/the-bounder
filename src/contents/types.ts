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
  /**
   * 是否由上一关 completeLevel → scene.restart 跳转而来。Vue 侧的
   * LevelTransitionOverlay 需要这个标记来决定过渡面板的淡出时机：只有真正"从上
   * 一关转场过来"时才要等 LEVEL_STARTED 再关面板。
   */
  fromTransition?: boolean
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
  /**
   * 隐藏默认的 biome TileSprite 视觉，只保留不可见的碰撞体。
   * 用于"美术已经把地面画在世界底图里"的关卡（见 WorldStripSystem）。
   */
  invisible?: boolean
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

/**
 * Boss 触发段：玩家进入 x 之后切到 BossPhase。
 *
 * 注：BossPhase 不再停止自动滚动 —— 世界保持流动，boss 从屏幕右侧"登场"并跟随
 * 相机保持在视口内。boss 被击破后进入 2s 静默 + BOSS_VICTORY 结算面板，再走
 * LEVEL_COMPLETED → LevelTransitionOverlay → 载入 `nextLevelId`。
 */
export interface BossTriggerSegmentDef {
  type: 'boss-trigger'
  id: string
  /** 触发 x（玩家 sprite.x 超过这个值即切入 boss phase） */
  x: number
  /** Boss 数据 id；查 data/bosses/ */
  bossId: string
  /**
   * boss 被击破后要载入的下一关 id；不填则沿用老行为：
   * - loop 关卡：停留继续跑（不触发结算）；
   * - 非 loop 关卡：从 segments 里找第一个 `level-exit` 的 nextLevelId 兜底。
   */
  nextLevelId?: string
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

export interface LevelStartedPayload {
  levelId: string
  /** 显示用关卡名；来自 LevelDef.id 的人性化转写（缺省等于 id） */
  displayName?: string
  /** 是否由上一关转场过来（首次进入 = false，scene.restart 过来 = true） */
  fromTransition: boolean
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

/**
 * BOSS 击破后 ~2s 的"结算面板"入参。
 * nextLevelId 缺省时面板展示"无后续关卡"文案（loop 关卡 + 未指定 nextLevelId 的
 * boss-trigger 会落到此分支，但实际上 GameplayScene 也不会 emit 这个事件）。
 */
export interface BossVictoryPayload {
  bossId: string
  displayName: string
  nextLevelId?: string
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

// ---------------------------------------------------------------------------
// World-strip 循环（变宽图片拼接 + 每图独立地面轮廓）
// ---------------------------------------------------------------------------
//
// 场景：美术提供一串长条底图（固定高度，变宽），每两张相邻图片之间有一段像素
// 级的 overlap（后一张盖在前一张右边缘之上）。跑酷关卡按顺序放它们；最后一张
// 放完后循环回第一张。每张图片在自己的本地 x 空间里声明若干"地面段"
// （section：[startX, endX) + groundHeight），这些段被翻译成不可见的 AABB
// 碰撞矩形给玩家踩。
//
// 翻译规则：
//   - 图 i 在 chunk 空间里占据 [leftX_i, rightX_i) = [leftX_i, leftX_i + width_i)
//   - 图 i 之后紧接的图 i+1 从 leftX_i + width_i - overlapNext_i 开始；图 i+1
//     会盖在图 i 的右侧 overlapNext_i 像素上。
//   - 因此图 i 的"所有权"范围只到 leftX_{i+1}；落在 [leftX_{i+1}, rightX_i) 的
//     section 会被自动裁掉（视觉上被下一张图覆盖）。
//   - 最后一张图的所有权范围到 chunkWidth（即回到图 0 前的最后一像素）。
//
// buildWorldStripLevel() 把上述 WorldStripLoopDef 编译成 LevelDef（loop=true,
// chunkWidth=sum(width - overlapNext)）+ 一组 invisible platform segments。
// WorldStripSystem 负责按 chunk 实例化实际的 Phaser.GameObjects.Image。

/** 一段地面轮廓（在本地图片坐标系里，原点为图片左上角）。 */
export interface WorldStripGroundSection {
  /** 本图内的局部 x 起点（包含） */
  readonly startX: number
  /** 本图内的局部 x 终点（不含） */
  readonly endX: number
  /** 地面厚度（从图片底边向上，像素）。玩家脚底的 y = image.y + (height - groundHeight) */
  readonly groundHeight: number
}

/** World-strip 中的一张图片。 */
export interface WorldStripImageDef {
  /** Phaser 贴图 key（BootScene 里生成或 load.image 加载） */
  readonly textureKey: string
  /**
   * 可选：真实素材 URL（例如 `/pics/1.png`）。
   *   - 有值：BootScene.preload 里 `this.load.image(textureKey, url)` 加载；
   *     WorldStripSystem 会用 `setDisplaySize(width, strip.height)` 将贴图
   *     缩放到声明的 width × height（处理原图分辨率 ≠ 显示尺寸的情况）。
   *   - 无值：回退到 BootScene.generateWorldStripTextures 生成占位纹理。
   */
  readonly url?: string
  /** 在关卡世界里的显示宽度（像素）。可以 < 或 > 贴图原生宽度 —— 会被缩放。 */
  readonly width: number
  /**
   * 本图右边缘被下一张图盖住的像素数（显示空间）。下一张图从
   * `thisImage.leftX + width - overlapNext` 开始。
   * 最后一张图的 overlapNext 决定循环回到第一张图时的接缝。
   */
  readonly overlapNext: number
  /**
   * 地面段列表（在本图的显示坐标系内；即若贴图会被缩放，section.x / endX / groundHeight
   * 用的是缩放后的像素数）。落在图 i+1 覆盖范围内的段会被自动裁剪或丢弃。
   */
  readonly sections: readonly WorldStripGroundSection[]
}

/** 一整圈 world-strip 循环。 */
export interface WorldStripLoopDef {
  /** 对应生成的 LevelDef.id */
  readonly id: string
  /** 所有图片共享的高度（像素） */
  readonly height: number
  /** 按显示顺序的图片列表。最后一张之后循环回第一张。 */
  readonly images: readonly WorldStripImageDef[]
  /** 可选：覆盖 LevelDef.scroll（默认 auto-right, speed=SCROLL_TUNING.DEFAULT_SPEED） */
  readonly scroll?: LevelScrollDef
  /** 可选：LevelDef.biome（隐藏平台时 biome 只影响"无关的" fallback，一般填 grass 即可） */
  readonly biome?: BiomeId
  /** 可选：玩家初始 spawn；不填由 builder 基于第一张图的第一个 section 自动推导 */
  readonly spawn?: { readonly x: number; readonly y: number }
  /**
   * 可选：额外 segments（boss-trigger / pickup / npc / level-exit / 多余 checkpoint…）。
   * 这些会原样附加到 LevelDef.segments 末尾，坐标用 chunk 空间（= 第 0 圈的世界 x）。
   * 注意 boss-trigger 的 `firedBossTriggers` 去重是幂等的：loop 关卡里一局只触发一次，
   * 之后的圈次不再生成 boss。
   */
  readonly extraSegments?: readonly SegmentDef[]
}

/** build 之后每张图在 chunk 空间的摆放信息。 */
export interface WorldStripPlacement {
  readonly imageIdx: number
  readonly textureKey: string
  readonly width: number
  /** 图片左上角在 chunk 空间的 x */
  readonly leftX: number
  /** 图片右边缘（不含）在 chunk 空间的 x = leftX + width */
  readonly rightX: number
  /** 本图"实际生效"的 x 区间：[ownedStartX, ownedEndX)。地面段都会裁到这里。 */
  readonly ownedStartX: number
  readonly ownedEndX: number
}

/** buildWorldStripLevel() 的产物：LevelDef + 摆放元数据（后者给 WorldStripSystem 用）。 */
export interface BuiltWorldStripLevel {
  readonly level: LevelDef
  readonly strip: WorldStripLoopDef
  readonly placements: readonly WorldStripPlacement[]
  readonly chunkWidth: number
}
