/**
 * NPC Warrior —— 站在 level-01 末端 / level-02 入口的红甲战士。
 * 单轮独白，无分支；按 E 推进至结束，玩家继续前行。
 */

import type { DialogueDef } from '@/contents/types'

export const DIALOGUE_NPC_WARRIOR: DialogueDef = {
  id: 'npc-warrior',
  startNodeId: 'warn1',
  nodes: {
    warn1: {
      id: 'warn1',
      speaker: '战士',
      text: '前面的洞，是这个世界的尽头之一。\n里头住着一位……住在黑暗里的东西。',
      next: 'warn2',
    },
    warn2: {
      id: 'warn2',
      speaker: '战士',
      text: '你的子弹是能打中它的。\n你的命，是一场足以让它记住你的搏斗。\n去吧。',
      next: null,
    },
  },
}
