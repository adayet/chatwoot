<!-- KLIMABAZAR F-podpis: nieedytowalny podgląd stopki pod polem edycji -->
<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  signature: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
</script>

<template>
  <div class="mt-2">
    <span class="block mb-1 text-xs text-n-slate-11">
      {{ t('CONVERSATION.FOOTER.SIGNATURE_PREVIEW_LABEL') }}
    </span>
    <div
      class="rounded-md border border-n-strong bg-white px-3 py-2 max-h-40 overflow-y-auto select-none"
    >
      <div
        v-dompurify-html="signature"
        class="origin-top-left scale-90 w-[111%] pointer-events-none"
      />
    </div>
  </div>
</template>
