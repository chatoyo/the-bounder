/**
 * Dialogue 注册表。DialogueRunner 按 id 从这里取 def。
 */

import type { DialogueDef } from '@/contents/types'
import { DIALOGUE_NPC_SAGE } from './npc-sage'
import { DIALOGUE_NPC_WARRIOR } from './npc-warrior'

export const DIALOGUE_REGISTRY: Readonly<Record<string, DialogueDef>> = {
  [DIALOGUE_NPC_SAGE.id]: DIALOGUE_NPC_SAGE,
  [DIALOGUE_NPC_WARRIOR.id]: DIALOGUE_NPC_WARRIOR,
}
