/**
 * Boss 注册表。BossPhase 按 bossId 查 def 后 new BossEntity(...)。
 */

import type { BossDef } from '@/contents/types'
import { BOSS_SHADOW } from './boss-shadow'

export const BOSS_REGISTRY: Readonly<Record<string, BossDef>> = {
  [BOSS_SHADOW.id]: BOSS_SHADOW,
}
