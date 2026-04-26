<script setup lang="ts">
/**
 * DialogueOverlay —— 对话 UI 覆盖层。
 *
 * 工作方式：
 *   - 订阅 DIALOGUE_START / DIALOGUE_NODE / DIALOGUE_END 决定 "开/关/换节点"。
 *   - 点击选项 → 发 DIALOGUE_CHOICE_SELECTED；键盘 1/2 同理由 InputSystem 走
 *     ACTION_IDS.CHOICE_1/2（DialoguePhase 监听 input 也能发，但 UI 自己发一遍
 *     没关系 —— DialogueRunner 按 dialogueId+nodeId 过滤重复）。
 *   - 点"继续" / 按回车 → 发 DIALOGUE_ADVANCE。
 *
 * 不直接渲染任何游戏状态；所有数据从事件里拿。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { EVENT_KEYS } from '@/contents/constants'
import type {
  DialogueNodePayload,
  DialogueStartPayload,
} from '@/contents/types'
import { useEventBus } from '@/runtime'

interface ChoiceVM {
  label: string
  index: number
}

const eventBus = useEventBus()

const visible = ref(false)
const speaker = ref('')
const text = ref('')
const choices = ref<ChoiceVM[]>([])
const dialogueId = ref('')
const nodeId = ref('')

const hasChoices = computed(() => choices.value.length > 0)

const onStart = (payload: unknown) => {
  const p = payload as DialogueStartPayload
  visible.value = true
  dialogueId.value = p.dialogueId
  nodeId.value = p.nodeId
  speaker.value = p.speaker
  text.value = p.text
  choices.value = []
}

const onNode = (payload: unknown) => {
  const p = payload as DialogueNodePayload
  dialogueId.value = p.dialogueId
  nodeId.value = p.nodeId
  speaker.value = p.speaker
  text.value = p.text
  choices.value = p.choices ?? []
}

const onEnd = (_payload: unknown) => {
  // 可以做淡出；jam 里先硬切
  visible.value = false
  speaker.value = ''
  text.value = ''
  choices.value = []
}

const selectChoice = (index: number) => {
  eventBus.emit(EVENT_KEYS.DIALOGUE_CHOICE_SELECTED, {
    dialogueId: dialogueId.value,
    nodeId: nodeId.value,
    choiceIndex: index,
  })
}

const advance = () => {
  if (hasChoices.value) return
  eventBus.emit(EVENT_KEYS.DIALOGUE_ADVANCE)
}

const onKeyDown = (e: KeyboardEvent) => {
  if (!visible.value) return
  if (e.key === '1') {
    if (choices.value[0]) selectChoice(0)
    e.preventDefault()
  } else if (e.key === '2') {
    if (choices.value[1]) selectChoice(1)
    e.preventDefault()
  } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
    if (!hasChoices.value) {
      advance()
      e.preventDefault()
    }
  }
}

onMounted(() => {
  eventBus.on(EVENT_KEYS.DIALOGUE_START, onStart)
  eventBus.on(EVENT_KEYS.DIALOGUE_NODE, onNode)
  eventBus.on(EVENT_KEYS.DIALOGUE_END, onEnd)
  window.addEventListener('keydown', onKeyDown, { capture: true })
})

onUnmounted(() => {
  eventBus.off(EVENT_KEYS.DIALOGUE_START, onStart)
  eventBus.off(EVENT_KEYS.DIALOGUE_NODE, onNode)
  eventBus.off(EVENT_KEYS.DIALOGUE_END, onEnd)
  window.removeEventListener('keydown', onKeyDown, { capture: true })
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="dialogue-overlay" @click="advance">
      <div class="dialogue-overlay__box" @click.stop>
        <div class="dialogue-overlay__speaker">{{ speaker }}</div>
        <div class="dialogue-overlay__text">{{ text }}</div>

        <div v-if="hasChoices" class="dialogue-overlay__choices">
          <button
            v-for="c in choices"
            :key="c.index"
            class="dialogue-overlay__choice"
            @click="selectChoice(c.index)"
          >
            <span class="dialogue-overlay__choice-key">{{ c.index + 1 }}</span>
            <span>{{ c.label }}</span>
          </button>
        </div>

        <div v-else class="dialogue-overlay__hint">按 Enter / 空格 / E 继续</div>
      </div>
    </div>
  </Transition>
</template>

<style lang="css" scoped>
@reference "@/style.css";

.dialogue-overlay {
  @apply pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center pb-6 pt-20;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
}

.dialogue-overlay__box {
  @apply w-[88%] max-w-3xl rounded-xl border border-yellow-400/40 bg-slate-900/92 p-5 text-white shadow-2xl backdrop-blur-sm;
}

.dialogue-overlay__speaker {
  @apply mb-2 text-sm font-bold tracking-wide text-yellow-300;
}

.dialogue-overlay__text {
  @apply mb-4 whitespace-pre-line text-lg leading-relaxed;
}

.dialogue-overlay__choices {
  @apply flex flex-col gap-2;
}

.dialogue-overlay__choice {
  @apply flex items-center gap-3 rounded-md border border-slate-600/60 bg-slate-800/80 px-3 py-2 text-left text-base transition hover:border-yellow-300/80 hover:bg-slate-700/90;
}

.dialogue-overlay__choice-key {
  @apply flex h-6 w-6 flex-none items-center justify-center rounded bg-yellow-400 text-sm font-bold text-slate-900;
}

.dialogue-overlay__hint {
  @apply text-right text-xs text-slate-400;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(24px);
}
</style>
