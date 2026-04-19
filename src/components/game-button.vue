<script setup lang="ts">
interface Props {
  label: string
  variant?: 'primary' | 'secondary'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
})
</script>

<template>
  <button
    class="min-w-48 cursor-pointer rounded-lg px-8 py-3 text-lg font-semibold tracking-wide transition-all duration-200"
    :class="[
      variant === 'primary'
        ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 active:bg-amber-600'
        : 'border border-slate-500 bg-transparent text-slate-300 hover:border-slate-400 hover:text-white active:bg-slate-800',
    ]"
  >
    {{ label }}
  </button>
</template>
<!-- 怎么这么像是shadcn？你真想玩这个？ -->