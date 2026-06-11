<script setup>
// KLIMABAZAR F8: neutralny licznik wszystkich realnych wiadomosci w watku.
// Zastepuje UnreadBadge w kartach listy; UnreadBadge.vue zostaje nietkniety (latwiejszy merge).
defineProps({
  count: { type: Number, default: 0 },
  alignBottom: { type: Boolean, default: false },
});
</script>

<template>
  <span
    v-if="count > 1"
    class="bg-n-slate-3 rounded-full h-4 min-w-4 px-1 w-fit font-medium text-xxs leading-3 text-n-slate-12 inline-grid place-items-center flex-shrink-0"
    :class="{ 'mb-0.5': alignBottom }"
  >
    {{ count }}
  </span>
  <span v-else />
</template>
