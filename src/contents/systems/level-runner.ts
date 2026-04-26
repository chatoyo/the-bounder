/**
 * LevelRunner —— 把 LevelDef 物化成世界里的物理对象，并管理 checkpoint 状态。
 *
 * 管辖范围（MidGround）：
 *   - platforms / hazards / checkpoints / pickups → Arcade StaticGroup，
 *     scene 侧挂 collider/overlap。
 *   - NPC / boss-trigger / level-exit 这类"逻辑标记"用 `markers` 存下来，
 *     不进 StaticGroup；由 DialogueSystem / BossPhase / scene.update() 按 x 查询。
 *
 * **不** 管：
 *   - 视差（ParallaxSystem 管）。
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
    this.spawnById.clear()
    this.npcs.clear()
    this.bossTriggers.clear()
    this.levelExits.clear()
    this.firedBossTriggers.clear()
    this.activeCheckpointId = null

    for (const seg of def.segments) {
      switch (seg.type) {
        case 'platform':
          this.buildPlatform(seg, def.biome)
          break
        case 'hazard':
          this.buildHazard(seg)
          break
        case 'checkpoint':
          this.buildCheckpoint(seg)
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
          this.levelExits.set(seg.id, seg)
          break
      }
    }

    // 激活 spawn：优先 def.spawn → 否则第一个 checkpoint
    const firstCpId = this.def.segments.find((s) => s.type === 'checkpoint')?.id ?? null
    if (firstCpId) this.activeCheckpointId = firstCpId

    // 世界边界
    this.scene.physics.world.setBounds(0, 0, def.width, def.height)
  }

  getDef(): LevelDef {
    if (!this.def) throw new Error('LevelRunner: 关卡尚未 load()')
    return this.def
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

  private buildPlatform(seg: PlatformSegmentDef, defaultBiome: BiomeId): void {
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
  }

  private buildHazard(seg: HazardSegmentDef): void {
    const cx = seg.x + seg.width / 2
    const cy = seg.y + seg.height / 2
    const sprite = this.hazards.create(cx, cy, 'hazard') as Phaser.Physics.Arcade.Sprite
    // 危险底图 32×16
    sprite.setScale(seg.width / 32, seg.height / 16).refreshBody()
    sprite.setData(DATA_HAZARD_DAMAGE, seg.damage ?? 1)
  }

  private buildCheckpoint(seg: CheckpointSegmentDef): void {
    const sprite = this.checkpoints.create(seg.x, seg.y, 'checkpoint') as Phaser.Physics.Arcade.Sprite
    sprite.setData(DATA_CHECKPOINT_ID, seg.id)
    // 视觉上：未激活灰一些，激活后亮；初始化时默认都是灰
    sprite.setAlpha(0.5)
    this.spawnById.set(seg.id, { id: seg.id, x: seg.x, y: seg.y + (seg.spawnY != null ? seg.spawnY - seg.y : 0) })
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
    this.platforms.clear(true, true)
    this.hazards.clear(true, true)
    this.checkpoints.clear(true, true)
    this.pickups.clear(true, true)
    this.spawnById.clear()
    this.npcs.clear()
    this.bossTriggers.clear()
    this.levelExits.clear()
    this.firedBossTriggers.clear()
  }
}
