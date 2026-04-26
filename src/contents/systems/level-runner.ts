/**
 * LevelRunner —— 把 LevelDef 物化成世界里的物理对象，并管理 checkpoint 状态。
 *
 * 管辖范围（MidGround）：
 *   - platforms / hazards / checkpoints / pickups → Arcade StaticGroup，
 *     scene 侧挂 collider/overlap。
 *   - NPC / boss-trigger / level-exit 这类"逻辑标记"用 `markers` 存下来，
 *     不进 StaticGroup；由 DialogueSystem / BossPhase / scene.update() 按 x 查询。
 *
 * 水平无限循环（LevelDef.loop === true）：
 *   - platforms / hazards / checkpoints 被当作"周期块"模板；随相机推进
 *     tickSpawner() 负责前后滑动窗口式地生成 / 销毁副本。
 *   - checkpoint 在每个 chunk 里会得到一个带 `@${k}` 后缀的唯一 id，spawnById
 *     永久保留（即使 chunk 已被回收），保证玩家死后 respawn 回最新触达的那一个。
 *   - pickups / NPCs / boss-triggers / level-exits 仍只在原始坐标出现一次
 *     （它们本来就是单次触发语义；boss / 过关 是关卡作者的显式设计）。
 *
 * **不** 管：
 *   - 视差（ParallaxSystem 管；TileSprite + scrollFactor 天然无限）。
 *   - 玩家重生（RespawnPhase 问 getActiveSpawn()）。
 *   - 碰撞回调 —— scene 侧挂 collider / overlap，回调里调本类 helper。
 */

import * as Phaser from 'phaser'
import type {
  BossTriggerSegmentDef,
  CheckpointSegmentDef,
  HazardSegmentDef,
  LevelDef,
  LevelExitSegmentDef,
  NpcSegmentDef,
  PickupSegmentDef,
  PlatformSegmentDef,
} from '@/contents/types'
import type { BiomeId } from '@/contents/types'

const DATA_CHECKPOINT_ID = 'checkpointId'
const DATA_HAZARD_DAMAGE = 'hazardDamage'
const DATA_PICKUP_ID = 'pickupId'
const DATA_PICKUP_KIND = 'pickupKind'

/** loop 模式下相机 / 物理世界的 X 上界（10 亿像素 ≈ 永远跑不完） */
export const LOOP_WORLD_MAX_X = 1_000_000_000

interface Spawn {
  readonly id: string
  readonly x: number
  readonly y: number
}

/** 按 biome 查平台贴图 key —— BootScene 里生成好，这里按需选 */
const PLATFORM_TEXTURE_BY_BIOME: Record<BiomeId, string> = {
  grass: 'tile-grass',
  stone: 'tile-stone',
  ice: 'tile-ice',
  space: 'tile-space',
}

export class LevelRunner {
  readonly platforms: Phaser.Physics.Arcade.StaticGroup
  readonly hazards: Phaser.Physics.Arcade.StaticGroup
  readonly checkpoints: Phaser.Physics.Arcade.StaticGroup
  readonly pickups: Phaser.Physics.Arcade.StaticGroup

  private def: LevelDef | null = null
  private activeCheckpointId: string | null = null
  private spawnById = new Map<string, Spawn>()

  /** 非物理段（NPC / boss-trigger / level-exit）的原始段数据，按 id 查 */
  private readonly npcs = new Map<string, NpcSegmentDef>()
  private readonly bossTriggers = new Map<string, BossTriggerSegmentDef>()
  private readonly levelExits = new Map<string, LevelExitSegmentDef>()

  /** boss-trigger 是否已触发过（防止多次进入 boss phase） */
  private readonly firedBossTriggers = new Set<string>()

  // ---- 水平无限循环相关状态 ----
  private loopEnabled = false
  private chunkWidth = 0
  /** 周期性 platform / hazard / checkpoint 模板（原始坐标，未加 chunk 偏移） */
  private platformTemplates: PlatformSegmentDef[] = []
  private hazardTemplates: HazardSegmentDef[] = []
  private checkpointTemplates: CheckpointSegmentDef[] = []
  /** chunk 索引 → 该 chunk 下创建的全部 GO，便于整块销毁 */
  private readonly chunkObjects = new Map<number, Phaser.GameObjects.GameObject[]>()

  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.platforms = scene.physics.add.staticGroup()
    this.hazards = scene.physics.add.staticGroup()
    this.checkpoints = scene.physics.add.staticGroup()
    this.pickups = scene.physics.add.staticGroup()
  }

  /** 加载一个关卡。世界 / 相机边界同步设置好，外部再调 cameraDirector.setBounds() */
  load(def: LevelDef): void {
    this.def = def
    this.platforms.clear(true, true)
    this.hazards.clear(true, true)
    this.checkpoints.clear(true, true)
    this.pickups.clear(true, true)
    this.clearAllChunks()
    this.spawnById.clear()
    this.npcs.clear()
    this.bossTriggers.clear()
    this.levelExits.clear()
    this.firedBossTriggers.clear()
    this.platformTemplates = []
    this.hazardTemplates = []
    this.activeCheckpointId = null

    this.loopEnabled = def.loop === true
    this.chunkWidth = def.chunkWidth ?? def.width

    for (const seg of def.segments) {
      switch (seg.type) {
        case 'platform':
          this.platformTemplates.push(seg)
          if (!this.loopEnabled) {
            this.trackChunk(0, this.buildPlatform(seg, def.biome))
          }
          break
        case 'hazard':
          this.hazardTemplates.push(seg)
          if (!this.loopEnabled) {
            this.trackChunk(0, this.buildHazard(seg))
          }
          break
        case 'checkpoint':
          this.checkpointTemplates.push(seg)
          if (!this.loopEnabled) {
            this.trackChunk(0, this.buildCheckpoint(seg))
          }
          break
        case 'pickup':
          this.buildPickup(seg)
          break
        case 'npc':
          this.npcs.set(seg.id, seg)
          break
        case 'boss-trigger':
          this.bossTriggers.set(seg.id, seg)
          break
        case 'level-exit':
          // 关卡作者的显式设计；loop 和非 loop 都尊重它（loop 的关卡不写就行）
          this.levelExits.set(seg.id, seg)
          break
      }
    }

    // loop 模式：预热 chunk 0 + 1，覆盖初始 viewport + 一块缓冲；
    // 后续由 tickSpawner 按相机位置动态 spawn/despawn。
    if (this.loopEnabled) {
      this.spawnChunk(0)
      this.spawnChunk(1)
    }

    // 激活 spawn：
    //   - 非 loop：第一个 checkpoint 的原始 id
    //   - loop：第一个 template 对应 chunk 0 的 `${id}@0` 变体（已在 spawnChunk(0) 里注册进 spawnById）
    if (this.loopEnabled) {
      const firstTpl = this.checkpointTemplates[0]
      if (firstTpl) this.activeCheckpointId = `${firstTpl.id}@0`
    } else {
      const firstCpId = this.def.segments.find((s) => s.type === 'checkpoint')?.id ?? null
      if (firstCpId) this.activeCheckpointId = firstCpId
    }

    // 世界边界
    const worldW = this.loopEnabled ? LOOP_WORLD_MAX_X : def.width
    this.scene.physics.world.setBounds(0, 0, worldW, def.height)
  }

  getDef(): LevelDef {
    if (!this.def) throw new Error('LevelRunner: 关卡尚未 load()')
    return this.def
  }

  isLooping(): boolean {
    return this.loopEnabled
  }

  getChunkWidth(): number {
    return this.chunkWidth
  }

  // -------------------------------------------------------------------------
  // 无限循环：chunk 滑动窗口
  // -------------------------------------------------------------------------

  /**
   * 每帧由 GameplayScene 调（仅 loop 模式生效）。
   * 根据相机视口计算需要的 chunk 索引范围，补齐缺失的 chunk、回收离屏过远的 chunk。
   */
  tickSpawner(scrollX: number, viewWidth: number): void {
    if (!this.loopEnabled || this.chunkWidth <= 0) return
    const W = this.chunkWidth
    const minK = Math.max(0, Math.floor(scrollX / W) - 1)
    const maxK = Math.floor((scrollX + viewWidth) / W) + 1

    // 补缺
    for (let k = minK; k <= maxK; k++) {
      if (!this.chunkObjects.has(k)) this.spawnChunk(k)
    }
    // 回收（只清离开窗口的块；chunk 0 也会被清，因为 loop 模式下它只是模板）
    for (const k of Array.from(this.chunkObjects.keys())) {
      if (k < minK || k > maxK) this.despawnChunk(k)
    }
  }

  private spawnChunk(k: number): void {
    if (this.chunkObjects.has(k)) return
    if (!this.def) return
    const biome = this.def.biome
    const offset = this.loopEnabled ? k * this.chunkWidth : 0
    const created: Phaser.GameObjects.GameObject[] = []
    for (const tpl of this.platformTemplates) {
      const seg: PlatformSegmentDef = { ...tpl, x: tpl.x + offset }
      created.push(...this.buildPlatform(seg, biome))
    }
    for (const tpl of this.hazardTemplates) {
      const seg: HazardSegmentDef = { ...tpl, x: tpl.x + offset }
      created.push(...this.buildHazard(seg))
    }
    for (const tpl of this.checkpointTemplates) {
      const uniqueId = this.loopEnabled ? `${tpl.id}@${k}` : tpl.id
      const seg: CheckpointSegmentDef = { ...tpl, x: tpl.x + offset }
      created.push(...this.buildCheckpoint(seg, uniqueId))
    }
    this.chunkObjects.set(k, created)
  }

  private despawnChunk(k: number): void {
    const list = this.chunkObjects.get(k)
    if (!list) return
    for (const go of list) {
      // 保险：destroy() 会从 StaticGroup 移除物理体；已销毁的重复调用也安全
      if ((go as Phaser.GameObjects.GameObject).scene) go.destroy()
    }
    this.chunkObjects.delete(k)
  }

  private clearAllChunks(): void {
    for (const k of Array.from(this.chunkObjects.keys())) {
      this.despawnChunk(k)
    }
  }

  private trackChunk(k: number, objs: Phaser.GameObjects.GameObject[]): void {
    const list = this.chunkObjects.get(k) ?? []
    list.push(...objs)
    this.chunkObjects.set(k, list)
  }

  // -------------------------------------------------------------------------
  // Checkpoint
  // -------------------------------------------------------------------------

  /** 覆盖式激活；已激活同一 id 则忽略。返回 true 表示确实发生了切换（调用方可据此发事件） */
  setActiveCheckpoint(id: string): boolean {
    if (!this.spawnById.has(id)) return false
    if (this.activeCheckpointId === id) return false
    this.activeCheckpointId = id
    return true
  }

  getActiveCheckpointId(): string | null {
    return this.activeCheckpointId
  }

  /** 取当前出生点；没有关卡 / 没有激活点时回退到 def.spawn 或 (100, 100) */
  getActiveSpawn(): Spawn {
    if (this.activeCheckpointId) {
      const sp = this.spawnById.get(this.activeCheckpointId)
      if (sp) return sp
    }
    const def = this.def
    if (def?.spawn) return { id: '__spawn', x: def.spawn.x, y: def.spawn.y }
    return { id: '__fallback', x: 100, y: 100 }
  }

  // -------------------------------------------------------------------------
  // Hazard 工具
  // -------------------------------------------------------------------------

  getHazardDamage(go: Phaser.GameObjects.GameObject): number {
    const d = (go.getData(DATA_HAZARD_DAMAGE) as number | undefined) ?? 1
    return d
  }

  // -------------------------------------------------------------------------
  // Pickup 工具
  // -------------------------------------------------------------------------

  getPickupMeta(go: Phaser.GameObjects.GameObject): { id: string; kind: string } | null {
    const id = go.getData(DATA_PICKUP_ID) as string | undefined
    const kind = go.getData(DATA_PICKUP_KIND) as string | undefined
    if (!id || !kind) return null
    return { id, kind }
  }

  consumePickup(go: Phaser.GameObjects.GameObject): void {
    // disable body + hide sprite；pickup 只触发一次
    const sprite = go as Phaser.Physics.Arcade.Sprite
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) body.enable = false
    sprite.setActive(false)
    sprite.setVisible(false)
  }

  // -------------------------------------------------------------------------
  // 非物理标记：NPC / boss-trigger / level-exit
  // -------------------------------------------------------------------------

  /** 按 id 查 NPC 定义（demo 里 NpcEntity 构建时用） */
  getNpcDef(id: string): NpcSegmentDef | undefined {
    return this.npcs.get(id)
  }

  /** 遍历所有 NPC 段；demo 侧用来批量构造 NpcEntity */
  forEachNpc(cb: (def: NpcSegmentDef) => void): void {
    this.npcs.forEach(cb)
  }

  /**
   * 把玩家当前 x 查一遍 boss-trigger，返回首个"该触发且未触发"的条目（并标记已触发）。
   * 返回 null = 未命中。
   */
  checkBossTrigger(playerX: number): BossTriggerSegmentDef | null {
    for (const t of this.bossTriggers.values()) {
      if (this.firedBossTriggers.has(t.id)) continue
      if (playerX >= t.x) {
        this.firedBossTriggers.add(t.id)
        return t
      }
    }
    return null
  }

  /** 查 level-exit；scene 侧在 overlap 里调；返回 meta 后可 emit LEVEL_COMPLETED */
  findLevelExitAt(playerX: number, playerY: number, radius = 40): LevelExitSegmentDef | null {
    for (const e of this.levelExits.values()) {
      if (Math.abs(e.x - playerX) <= radius && Math.abs(e.y - playerY) <= radius) {
        return e
      }
    }
    return null
  }

  // -------------------------------------------------------------------------
  // Segment builders
  // -------------------------------------------------------------------------

  private buildPlatform(
    seg: PlatformSegmentDef,
    defaultBiome: BiomeId,
  ): Phaser.GameObjects.GameObject[] {
    const biome = seg.biome ?? defaultBiome
    const textureKey = PLATFORM_TEXTURE_BY_BIOME[biome] ?? 'platform'

    // TileSprite 可以按纹理铺砖，不会像 setScale 那样被拉伸糊掉。但 Arcade 静态体
    // 用 tileSprite 不太顺手；这里用"多块 sprite 拼平台"的方式，保证
    // 视觉是平铺的 tile，物理是连续的静态矩形。
    const TILE_W = 32
    const TILE_H = 16

    const centerX = seg.x + seg.width / 2
    const centerY = seg.y + seg.height / 2

    // 第一块：做成与目标 width×height 等大的静态体，但贴图用 TileSprite 铺
    const body = this.platforms.create(centerX, centerY, textureKey) as Phaser.Physics.Arcade.Sprite
    body.setVisible(false) // 实际贴图由 TileSprite 提供
    body.setDisplaySize(seg.width, seg.height)
    body.refreshBody()

    // 独立 TileSprite 做视觉（不进 platforms group，不参与碰撞）
    const tile = this.scene.add.tileSprite(
      seg.x,
      seg.y,
      seg.width,
      seg.height,
      textureKey,
    )
    tile.setOrigin(0, 0)
    tile.setDepth(0)
    // 记一下 tile 尺寸方便调试
    tile.setData('tileW', TILE_W)
    tile.setData('tileH', TILE_H)

    return [body, tile]
  }

  private buildHazard(seg: HazardSegmentDef): Phaser.GameObjects.GameObject[] {
    const cx = seg.x + seg.width / 2
    const cy = seg.y + seg.height / 2
    const sprite = this.hazards.create(cx, cy, 'hazard') as Phaser.Physics.Arcade.Sprite
    // 危险底图 32×16
    sprite.setScale(seg.width / 32, seg.height / 16).refreshBody()
    sprite.setData(DATA_HAZARD_DAMAGE, seg.damage ?? 1)
    return [sprite]
  }

  /**
   * 构建一个 checkpoint。loop 模式下调用方会传 `uniqueId = ${seg.id}@${k}`，
   * 非 loop 模式直接用 seg.id。
   *
   * 关键不变量：spawnById 永久保留（即使 chunk 后续被 despawn）。这样玩家触达过
   * 的 checkpoint 记录即使视觉消失，respawn 依然能找回世界坐标。
   */
  private buildCheckpoint(
    seg: CheckpointSegmentDef,
    uniqueId: string = seg.id,
  ): Phaser.GameObjects.GameObject[] {
    const sprite = this.checkpoints.create(seg.x, seg.y, 'checkpoint') as Phaser.Physics.Arcade.Sprite
    sprite.setData(DATA_CHECKPOINT_ID, uniqueId)
    // 视觉上：未激活灰一些，激活后亮；初始化时默认都是灰
    sprite.setAlpha(0.5)
    this.spawnById.set(uniqueId, {
      id: uniqueId,
      x: seg.x,
      y: seg.y + (seg.spawnY != null ? seg.spawnY - seg.y : 0),
    })
    return [sprite]
  }

  private buildPickup(seg: PickupSegmentDef): void {
    // 选纹理：按 kind 区分；flight-orb 用黄色 orb，hp-crystal 用红色 crystal
    const texture = seg.kind === 'flight-orb' ? 'pickup-flight' : 'pickup-hp'
    const sprite = this.pickups.create(seg.x, seg.y, texture) as Phaser.Physics.Arcade.Sprite
    sprite.setData(DATA_PICKUP_ID, seg.id)
    sprite.setData(DATA_PICKUP_KIND, seg.kind)
    // 轻微浮动动画（更醒目）
    this.scene.tweens.add({
      targets: sprite,
      y: seg.y - 6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** scene 收到 checkpoint overlap 后调用本函数，顺便更新视觉反馈 */
  handleCheckpointTouched(go: Phaser.GameObjects.GameObject): { id: string; changed: boolean } | null {
    const id = go.getData(DATA_CHECKPOINT_ID) as string | undefined
    if (!id) return null
    const changed = this.setActiveCheckpoint(id)
    if (changed) {
      // 激活态视觉：满不透明；其它 checkpoint 保持半透明
      this.checkpoints.getChildren().forEach((c) => {
        const s = c as Phaser.Physics.Arcade.Sprite
        const cid = s.getData(DATA_CHECKPOINT_ID) as string | undefined
        s.setAlpha(cid === id ? 1 : 0.5)
      })
    }
    return { id, changed }
  }

  destroy(): void {
    this.clearAllChunks()
    this.platforms.clear(true, true)
    this.hazards.clear(true, true)
    this.checkpoints.clear(true, true)
    this.pickups.clear(true, true)
    this.spawnById.clear()
    this.npcs.clear()
    this.bossTriggers.clear()
    this.levelExits.clear()
    this.firedBossTriggers.clear()
    this.platformTemplates = []
    this.hazardTemplates = []
  }
}
