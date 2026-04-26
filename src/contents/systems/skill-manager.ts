/**
 * SkillManager —— 技能装备层（架在 capability 之上）。
 *
 * 关键解耦：
 *   - capability 是"玩家能做的原子动作"，生命周期跟着 Player。
 *   - skill 是"剧情叙事单位"，可被对话 / boss / 道具 unlock / equip / suppress。
 *   - 同一把"激光"可能由 3 个 capability（充能、射出、冷却动画）组成；
 *     用 SkillDef.capabilities[] 描述，ManagementManager 按需 attach / detach。
 *
 * Phase A 只用到最小子集：shoot 一个 active 技能，直接 equip。
 * Phase C+ 需要：unlock 持久化（走 Pinia）、suppress / grantTemporary（boss 用）。
 */

import { EVENT_KEYS } from '@/contents/constants'
import type {
  CapabilityId,
  SkillDef,
  SkillEquippedPayload,
  SkillId,
  SkillRevokedPayload,
} from '@/contents/types'
import { useEventBus } from '@/runtime'
import type { Capability } from '@/contents/entities/player/capabilities/capability'
import type { Player } from '@/contents/entities/player/player'

const eventBus = useEventBus()

/** 工厂签名：每次 equip 生成一个全新的 capability 实例，避免跨 player 共享状态 */
type CapabilityFactory = () => Capability

export class SkillManager {
  private player: Player

  /** 已注册的 skill 元信息：id → SkillDef */
  private registry = new Map<SkillId, SkillDef>()

  /** capability id → 工厂函数；equip 时按 SkillDef.capabilities 查出来执行 */
  private capabilityFactories = new Map<CapabilityId, CapabilityFactory>()

  /** 玩家已解锁的 skill（"习得过"但不一定现在装着） */
  private unlocked = new Set<SkillId>()
  /** 当前装着的 skill */
  private equipped = new Set<SkillId>()
  /** 被压制的 skill（boss 阶段临时禁用；unsuppress 后可恢复） */
  private suppressed = new Set<SkillId>()

  /** skill id → 该 skill 当前挂上 Player 的 capability id 列表，用于反向卸载 */
  private skillToCaps = new Map<SkillId, CapabilityId[]>()

  constructor(player: Player) {
    this.player = player
  }

  // -------------------------------------------------------------------------
  // 注册
  // -------------------------------------------------------------------------

  registerSkill(def: SkillDef): void {
    this.registry.set(def.id, def)
  }

  registerSkills(defs: Iterable<SkillDef>): void {
    for (const d of defs) this.registerSkill(d)
  }

  registerCapabilityFactory(id: CapabilityId, factory: CapabilityFactory): void {
    this.capabilityFactories.set(id, factory)
  }

  // -------------------------------------------------------------------------
  // 解锁 / 装备
  // -------------------------------------------------------------------------

  unlock(id: SkillId): boolean {
    if (!this.registry.has(id)) return false
    if (this.unlocked.has(id)) return false
    this.unlocked.add(id)
    eventBus.emit(EVENT_KEYS.SKILL_UNLOCKED, { id })
    return true
  }

  /** 装备一个已解锁的 skill。自动解锁（jam 阶段容错：允许未 unlock 直接 equip） */
  equip(id: SkillId): boolean {
    const def = this.registry.get(id)
    if (!def) return false

    if (!this.unlocked.has(id)) this.unlocked.add(id)
    if (this.equipped.has(id)) return false
    if (this.suppressed.has(id)) return false

    const attached: CapabilityId[] = []
    for (const capId of def.capabilities) {
      const factory = this.capabilityFactories.get(capId)
      if (!factory) {
        // 没注册工厂 = 配置错误；记录 warning 但跳过这条 capability
        console.warn(`[SkillManager] 缺少 capability 工厂: ${capId} (skill=${id})`)
        continue
      }
      const cap = factory()
      this.player.attachCapability(cap)
      attached.push(capId)
    }

    this.equipped.add(id)
    this.skillToCaps.set(id, attached)
    eventBus.emit(EVENT_KEYS.SKILL_EQUIPPED, {
      id,
      displayName: def.displayName,
      kind: def.kind,
      hotkey: def.hotkey,
    } satisfies SkillEquippedPayload)
    return true
  }

  /** 卸下一个 skill（保留 unlocked 态）*/
  unequip(id: SkillId): boolean {
    if (!this.equipped.has(id)) return false
    const caps = this.skillToCaps.get(id) ?? []
    for (const capId of caps) {
      this.player.detachCapability(capId)
    }
    this.skillToCaps.delete(id)
    this.equipped.delete(id)
    eventBus.emit(EVENT_KEYS.SKILL_REVOKED, { id } satisfies SkillRevokedPayload)
    return true
  }

  // -------------------------------------------------------------------------
  // 临时压制 / 解压（boss 阶段用）
  // -------------------------------------------------------------------------

  suppress(id: SkillId): void {
    if (this.suppressed.has(id)) return
    this.suppressed.add(id)
    if (this.equipped.has(id)) {
      this.unequip(id)
      // unequip 清掉了 equipped 里的 id；等 unsuppress 再补回来
      // 为了 "复原"，先把 suppressed 里标记已配对的还原 id 记下来
      // 简化：unsuppress 时若 id 在 unlocked 且不在 equipped，自动 equip
    }
  }

  unsuppress(id: SkillId): void {
    if (!this.suppressed.has(id)) return
    this.suppressed.delete(id)
    if (this.unlocked.has(id) && !this.equipped.has(id)) {
      this.equip(id)
    }
  }

  // -------------------------------------------------------------------------
  // 查询
  // -------------------------------------------------------------------------

  isUnlocked(id: SkillId): boolean {
    return this.unlocked.has(id)
  }

  isEquipped(id: SkillId): boolean {
    return this.equipped.has(id)
  }

  getEquipped(): SkillDef[] {
    return Array.from(this.equipped)
      .map((id) => this.registry.get(id))
      .filter((d): d is SkillDef => d != null)
  }

  destroy(): void {
    // 卸掉所有挂着的 capability；registry / factories 本身是配置，保留无妨
    for (const id of Array.from(this.equipped)) {
      this.unequip(id)
    }
    this.unlocked.clear()
    this.equipped.clear()
    this.suppressed.clear()
    this.skillToCaps.clear()
  }
}
