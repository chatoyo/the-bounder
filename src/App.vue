<script setup lang="ts">
</script>

<template>
  <div class="game-ui">
    <RouterView />
  </div>
</template>
<style lang="css" scoped>
@reference "@/style.css";

.game-ui {
  @apply min-h-screen bg-slate-900 text-white;
}
</style>