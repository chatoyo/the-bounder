/**
 * 技能注册表 —— 把"剧情里谈到的技能名"映射到"挂载哪些 capability"。
 *
 * 命名约定：
 *   - passive 技能（move / jump）不走 SkillManager —— 它们是玩家与生俱来的能力，
 *     Player 构造完直接 attachCapability。
 *   - active 技能 / 拾取奖励 / boss 压制对象 都走 SkillManager.equip。
 *
 * 扩展路径（jam 中最常见）：
 *   1. SKILL_IDS 加新 id
 *   2. CAPABILITY_IDS 加对应 capability id
 *   3. 在这里加 SkillDef
 *   4. GameplayScene.create() 里 registerCapabilityFactory(id, () => new XxxCapability(...))
 *   5. 剧情侧触发 skillManager.unlock(id) + equip(id)
 */

import { ACTION_IDS, CAPABILITY_IDS, SKILL_IDS } from '@/contents/constants'
import type { SkillDef, SkillId } from '@/contents/types'

export const SKILL_REGISTRY: Readonly<Record<SkillId, SkillDef>> = {
  [SKILL_IDS.SHOOT]: {
    id: SKILL_IDS.SHOOT,
    displayName: '射击',
    kind: 'active',
    capabilities: [CAPABILITY_IDS.SHOOT],
    hotkey: ACTION_IDS.SHOOT,
  },
  [SKILL_IDS.FLIGHT]: {
    id: SKILL_IDS.FLIGHT,
    displayName: '飞行',
    kind: 'active',
    capabilities: [CAPABILITY_IDS.FLY],
    hotkey: ACTION_IDS.SKILL_3,
    // 飞行并不真正卸载 shoot，但逻辑上标记一下未来若要互斥可以用
    // suppresses: [],
  },
}
