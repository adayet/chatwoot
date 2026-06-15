<script setup>
import { computed, ref, watch } from 'vue';
import Draggable from 'vuedraggable';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import wootConstants from 'dashboard/constants/globals';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  activeTab: {
    type: String,
    default: wootConstants.ASSIGNEE_TYPE.ME,
  },
});

const emit = defineEmits(['chatTabChange', 'reorder']);

// KLIMABAZAR F-tabord: wymus tryb fallback Sortable — `delay` (przytrzymanie) NIE dziala
// z natywnym HTML5 drag-and-drop, tylko z fallbackiem (pointer/mouse)
const useFallbackDrag = true;

// KLIMABAZAR F-tabord: lokalna kopia do przeciagania (vuedraggable mutuje liste)
const localItems = ref([...props.items]);

// KLIMABAZAR F-tabord: klucz zakladki "zlapanej" (po delayu) -> sygnal uniesienia
const choosingKey = ref(null);
watch(
  () => props.items,
  newItems => {
    localItems.value = [...newItems];
  }
);

const activeTabIndex = computed(() => {
  return localItems.value.findIndex(item => item.key === props.activeTab);
});

const onTabChange = selectedTabIndex => {
  if (selectedTabIndex >= 0 && selectedTabIndex < localItems.value.length) {
    const selectedItem = localItems.value[selectedTabIndex];
    if (selectedItem.key !== props.activeTab) {
      emit('chatTabChange', selectedItem.key);
    }
  }
};

// KLIMABAZAR F-tabord: zakladka zlapana (po delayu) -> uniesienie
const onChoose = evt => {
  choosingKey.value = localItems.value[evt.oldIndex]?.key ?? null;
};

const onUnchoose = () => {
  choosingKey.value = null;
};

// KLIMABAZAR F-tabord: po przeciagnieciu wyemituj nowa kolejnosc kluczy
const onDragEnd = () => {
  choosingKey.value = null;
  emit(
    'reorder',
    localItems.value.map(item => item.key)
  );
};

const keyboardEvents = {
  'Alt+KeyN': {
    action: () => {
      if (props.activeTab === wootConstants.ASSIGNEE_TYPE.ALL) {
        onTabChange(0);
      } else {
        const nextIndex = (activeTabIndex.value + 1) % localItems.value.length;
        onTabChange(nextIndex);
      }
    },
  },
};

useKeyboardEvents(keyboardEvents);
</script>

<template>
  <woot-tabs
    :index="activeTabIndex"
    class="w-full px-3 -mt-1 py-0 [&_ul]:p-0 h-10"
    @change="onTabChange"
  >
    <Draggable
      v-model="localItems"
      item-key="key"
      class="contents"
      :delay="200"
      :delay-on-touch-only="false"
      :force-fallback="useFallbackDrag"
      ghost-class="opacity-40"
      @choose="onChoose"
      @unchoose="onUnchoose"
      @end="onDragEnd"
    >
      <template #item="{ element, index }">
        <woot-tabs-item
          :key="element.key"
          class="text-sm [&_a]:font-medium cursor-grab transition-all duration-150"
          :class="{
            'scale-110 relative z-10 shadow-md rounded-md bg-n-alpha-2':
              element.key === choosingKey,
          }"
          :index="index"
          :name="element.name"
          :count="element.count"
          is-compact
        />
      </template>
    </Draggable>
  </woot-tabs>
</template>
