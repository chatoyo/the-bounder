/**
 * NPC Sage 的开场独白 —— 起点处的紫袍老人。
 *
 * 节点结构：
 *   intro1 → intro2 → question (choice) → [takeOrb | leaveOrb]
 *
 * "takeOrb" 分支通过 grant-skill + equip-skill 命令直接给玩家飞行；"leaveOrb"
 * 分支不给，玩家要自己去拿 mid-level 的 flight-orb（也能通关）。
 */

import { SKILL_IDS } from '@/contents/constants'
import type { DialogueDef } from '@/contents/types'

export const DIALOGUE_NPC_SAGE: DialogueDef = {
  id: 'npc-sage',
  startNodeId: 'intro1',
  nodes: {
    intro1: {
      id: 'intro1',
      speaker: '旅者',
      text:
        '风在背后追着你，旅人。\n这片大地正从你身后一寸寸被吞噬。\n你必须一直向前，不能回头。',
      next: 'intro2',
    },
    intro2: {
      id: 'intro2',
      speaker: '旅者',
      text:
        '你天生会二段跳 —— 这是祖辈留给你的能力。\n前方的峡谷深不见底，但跨过去的人，都不是跳过去的。\n他们，是飞过去的。',
      next: 'question',
    },
    question: {
      id: 'question',
      speaker: '旅者',
      text: '我这里有一枚飞行珠。要现在给你吗？\n（你也可以自己去途中捡起另一枚。）',
      choices: [
        {
          label: '收下（立即解锁飞行：按 L 切换）',
          next: 'farewell_take',
          commands: [
            { type: 'grant-skill', id: SKILL_IDS.FLIGHT },
            { type: 'equip-skill', id: SKILL_IDS.FLIGHT },
          ],
        },
        {
          label: '我自己走一程（途中会见到另一枚）',
          next: 'farewell_leave',
        },
      ],
    },
    farewell_take: {
      id: 'farewell_take',
      speaker: '旅者',
      text: '愿你不要被追上。\n（你感到脚下一轻 —— 现在按 L 可以自由飞行了。）',
      next: null,
    },
    farewell_leave: {
      id: 'farewell_leave',
      speaker: '旅者',
      text: '那便去罢。\n当腾不过的沟出现时，就是它该找到你的时候。',
      next: null,
    },
  },
}
