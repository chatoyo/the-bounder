<script setup lang="ts">
/**
 * GameHud —— Phase A 的 Vue HUD：血量 + 技能槽。
 *
 * 只依赖 EventBus 事件（PLAYER_HP_CHANGED / SKILL_EQUIPPED / SKILL_REVOKED）。
 * 不直接读任何 Phaser / 游戏逻辑状态 —— 保持单向：Phaser → Vue。
 *
 * 技能槽采用"固定热键"布局（J / K / L）：未装备的槽显示占位，装备后显示名字。
 * 这样玩家看一眼就知道"哪个键有什么技能"，不会因技能顺序变化而错按。
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ACTION_IDS, EVENT_KEYS, PLAYER_TUNING } from '@/contents'
import type {
  ActionId,
  PlayerHpChangedPayload,
  SkillEquippedPayload,
  SkillId,
  SkillRevokedPayload,
} from '@/contents'
import { useEventBus } from '@/runtime'

interface EquippedEntry {
  id: SkillId
  displayName: string
}

const eventBus = useEventBus()

const hp = ref<number>(PLAYER_TUNING.MAX_HP)
const maxHp = ref<number>(PLAYER_TUNING.MAX_HP)

/** hotkey (ActionId) → 装备的技能信息；HUD 只按 hotkey 显示，与装备顺序无关 */
const equippedByHotkey = reactive(new Map<ActionId, EquippedEntry>())

/** 固定热键槽位。新增 active 技能时扩这里；Phase A 先占 J/K/L 三槽 */
const SLOT_LAYOUT: { hotkey: ActionId; keyLabel: string }[] = [
  { hotkey: ACTION_IDS.SHOOT, keyLabel: 'J' },
  { hotkey: ACTION_IDS.SKILL_2, keyLabel: 'K' },
  { hotkey: ACTION_IDS.SKILL_3, keyLabel: 'L' },
]

const slots = computed(() =>
  SLOT_LAYOUT.map((s) => ({
    ...s,
    skill: equippedByHotkey.get(s.hotkey),
  })),
)

// ---- EventBus handlers ----

const onHpChanged = (payload: unknown) => {
  const p = payload as PlayerHpChangedPayload
  hp.value = p.current
  maxHp.value = p.max
}

const onSkillEquipped = (payload: unknown) => {
  const p = payload as SkillEquippedPayload
  if (!p.hotkey) return // passive 技能不占 HUD 槽位
  equippedByHotkey.set(p.hotkey, { id: p.id, displayName: p.displayName })
}

const onSkillRevoked = (payload: unknown) => {
  const p = payload as SkillRevokedPayload
  // 反查 hotkey：找到 id 匹配的槽就清掉
  for (const [hk, entry] of equippedByHotkey.entries()) {
    if (entry.id === p.id) {
      equippedByHotkey.delete(hk)
      break
    }
  }
}

onMounted(() => {
  eventBus.on(EVENT_KEYS.PLAYER_HP_CHANGED, onHpChanged)
  eventBus.on(EVENT_KEYS.SKILL_EQUIPPED, onSkillEquipped)
  eventBus.on(EVENT_KEYS.SKILL_REVOKED, onSkillRevoked)
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.PLAYER_HP_CHANGED, onHpChanged)
  eventBus.off(EVENT_KEYS.SKILL_EQUIPPED, onSkillEquipped)
  eventBus.off(EVENT_KEYS.SKILL_REVOKED, onSkillRevoked)
})
</script>

<template>
  <div class="game-hud">
    <!-- 血量 -->
    <div class="game-hud__hp" :aria-label="`Player HP: ${hp}/${maxHp}`">
      <span
        v-for="i in maxHp"
        :key="i"
        class="game-hud__heart"
        :class="{ 'game-hud__heart--empty': i > hp }"
      >
        ♥
      </span>
    </div>

    <!-- 技能槽 -->
    <div class="game-hud__skills">
      <div
        v-for="slot in slots"
        :key="slot.hotkey"
        class="game-hud__skill"
        :class="{ 'game-hud__skill--empty': !slot.skill }"
      >
        <span class="game-hud__skill-key">{{ slot.keyLabel }}</span>
        <span class="game-hud__skill-name">
          {{ slot.skill?.displayName ?? '—' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.game-hud {
  @apply pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-white;
}

.game-hud__hp {
  @apply flex gap-1 text-3xl leading-none drop-shadow;
}

.game-hud__heart {
  @apply text-red-500 transition-opacity duration-150;
}

.game-hud__heart--empty {
  @apply text-gray-500/60;
}

.game-hud__skills {
  @apply flex gap-2;
}

.game-hud__skill {
  @apply flex items-center gap-2 rounded-md border border-slate-500/60 bg-slate-900/70 px-2 py-1 text-sm backdrop-blur-sm;
}

.game-hud__skill--empty {
  @apply border-slate-700/60 text-slate-500;
}

.game-hud__skill-key {
  @apply flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-xs font-bold text-slate-200;
}

.game-hud__skill--empty .game-hud__skill-key {
  @apply bg-slate-800 text-slate-500;
}

.game-hud__skill-name {
  @apply whitespace-nowrap;
}
</style>
