# F-tabord — Przeciąganie kolejności zakładek — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umożliwić każdemu użytkownikowi zmianę kolejności 5 zakładek listy rozmów przez przytrzymanie i przeciągnięcie, z zapisem per-użytkownik.

**Architecture:** Kolejność trzymana jako tablica kluczy w `ui_settings.conversation_tabs_order` (per-user). `ChatList` sortuje `listTabItems` wg tego zapisu (`orderedTabItems`) i podaje do `ChatTypeTabs`. `ChatTypeTabs` owija pozycje `woot-tabs-item` w `vuedraggable` (delay 200 ms = przytrzymanie, `display:contents` by nie psuć flexa) i po przeciągnięciu emituje nową kolejność, którą `ChatList` zapisuje przez `updateUISettings`.

**Tech Stack:** Vue 3 `<script setup>`, `vuedraggable@^4.1.0`, `useUISettings` (Vuex-backed ui_settings), Tailwind. Weryfikacja w lokalnym Docker dev (`http://localhost:3001`, `john@acme.inc` / `Password1!`).

**Uwaga o testach:** bez RSpec/JS unit testów (CLAUDE.md: Avoid writing specs unless explicitly asked, MVP). Weryfikacja: `pnpm eslint` + obserwacja w przeglądarce (drag, reload, drugi użytkownik).

**Spec:** `docs/klimabazar/F-tabord-draggable-tabs-design.md`

---

### Task 1: ChatList — kolejność z ui_settings + zapis reorderu

**Files:**
- Modify: `app/javascript/dashboard/components/ChatList.vue` (l.71 destrukturyzacja; po `listTabItems` ~l.224; handler ~przy `updateListTab`; bind template l.1108-1114)

- [ ] **Step 1: Dodaj `updateUISettings` do destrukturyzacji**

W `ChatList.vue:71` zmień:

```js
const { uiSettings, updateUISettings } = useUISettings();
```

- [ ] **Step 2: Dodaj `DEFAULT_TAB_ORDER` i `orderedTabItems`**

Bezpośrednio po bloku `listTabItems` (po `]);`, przed komentarzem `// KLIMABAZAR F-rozw: ktora zakladka podswietlona`) dodaj:

```js
// KLIMABAZAR F-tabord: domyslna kolejnosc zakladek (F1 + status); uzytkownik moze przestawic
const DEFAULT_TAB_ORDER = ['all', 'me', 'unassigned', 'resolved', 'unresolved'];

// KLIMABAZAR F-tabord: kolejnosc zakladek wg zapisu uzytkownika (ui_settings); brak -> domyslna
const orderedTabItems = computed(() => {
  const savedOrder = uiSettings.value.conversation_tabs_order;
  const order = Array.isArray(savedOrder) ? savedOrder : DEFAULT_TAB_ORDER;
  const rank = key => {
    const savedIndex = order.indexOf(key);
    // klucz spoza zapisu (np. nowa zakladka w przyszlosci) -> na koniec, wg kolejnosci domyslnej
    return savedIndex === -1
      ? order.length + DEFAULT_TAB_ORDER.indexOf(key)
      : savedIndex;
  };
  return [...listTabItems.value].sort((a, b) => rank(a.key) - rank(b.key));
});
```

- [ ] **Step 3: Dodaj handler `onTabsReorder`**

Bezpośrednio po funkcji `updateListTab` (po jej zamykającym `}`) dodaj:

```js
// KLIMABAZAR F-tabord: zapisz kolejnosc zakladek per-user
function onTabsReorder(keys) {
  updateUISettings({ conversation_tabs_order: keys });
}
```

- [ ] **Step 4: Podmień bind `ChatTypeTabs` w template**

W template (l.1108-1114) zmień `:items` na `orderedTabItems` i dodaj `@reorder`:

```html
    <ChatTypeTabs
      v-if="!hasAppliedFiltersOrActiveFolders"
      :items="orderedTabItems"
      :active-tab="activeListTab"
      is-compact
      @chat-tab-change="updateListTab"
      @reorder="onTabsReorder"
    />
```

- [ ] **Step 5: Lint**

Run: `pnpm eslint app/javascript/dashboard/components/ChatList.vue`
Expected: 0 errors (ostrzeżenia ogólnoprojektowe dopuszczalne).

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(klimabazar): F-tabord - ChatList sortuje zakladki wg ui_settings + zapis reorderu"
```

---

### Task 2: ChatTypeTabs — przeciąganie zakładek (vuedraggable)

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/ChatTypeTabs.vue` (cały plik — przepisanie script+template)

- [ ] **Step 1: Zastąp zawartość `<script setup>`**

Podmień blok `<script setup>` na (dodane: import `Draggable`, `ref`/`watch`, lokalna kopia `localItems`, emit `reorder`, `onDragEnd`):

```js
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

// KLIMABAZAR F-tabord: lokalna kopia do przeciagania (vuedraggable mutuje liste)
const localItems = ref([...props.items]);
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

// KLIMABAZAR F-tabord: po przeciagnieciu wyemituj nowa kolejnosc kluczy
const onDragEnd = () => {
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
```

- [ ] **Step 2: Zastąp `<template>`**

Podmień blok `<template>` na (pozycje renderowane przez `Draggable` z `contents`, delay 200 ms, ghost Tailwind):

```html
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
      ghost-class="opacity-40"
      @end="onDragEnd"
    >
      <template #item="{ element, index }">
        <woot-tabs-item
          :key="element.key"
          class="text-sm [&_a]:font-medium cursor-grab"
          :index="index"
          :name="element.name"
          :count="element.count"
          is-compact
        />
      </template>
    </Draggable>
  </woot-tabs>
</template>
```

- [ ] **Step 3: Lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/ChatTypeTabs.vue`
Expected: 0 errors.

- [ ] **Step 4: Weryfikacja wizualna (lokalny Docker dev)**

`http://localhost:3001` → Rozmowy. Sprawdź:
1. Krótki klik na zakładce → przełącza widok (jak dotąd).
2. Przytrzymanie (~0,2 s) i przeciągnięcie zakładki → zmienia jej pozycję; ghost półprzezroczysty.
3. Po przeładowaniu strony kolejność zostaje.
4. Liczniki i podświetlenie aktywnej zakładki poprawne po reorderze.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(klimabazar): F-tabord - przeciaganie zakladek listy (vuedraggable, przytrzymanie)"
```

---

### Task 3: Rejestr w CUSTOMIZATIONS.md

**Files:**
- Modify: `CUSTOMIZATIONS.md` (tabela „Rejestr zmian") + `docs/klimabazar/BACKLOG.md`

- [ ] **Step 1: Dodaj wiersze do rejestru w `CUSTOMIZATIONS.md`**

Na końcu tabeli „Rejestr zmian" dodaj:

```markdown
| `components/widgets/ChatTypeTabs.vue` (F-tabord) | `vuedraggable` wokół `woot-tabs-item` (`delay:200`=przytrzymanie startuje drag, krótki klik=przełącz; `class="contents"` nie psuje flexa; `ghost-class="opacity-40"`); emit `reorder` z kolejnością kluczy | F-tabord: użytkownik przeciąga zakładki | średnia (komponent tab-bara, używany tylko w ChatList) — grep `KLIMABAZAR F-tabord` |
| `ChatList.vue` (F-tabord) | `DEFAULT_TAB_ORDER` + `orderedTabItems` (sort wg `uiSettings.conversation_tabs_order`, brak→domyślna) + `onTabsReorder`→`updateUISettings`; bind `:items="orderedTabItems"` + `@reorder` | F-tabord: kolejność zakładek per-user z ui_settings | niska–średnia — grep `KLIMABAZAR F-tabord` |
```

- [ ] **Step 2: Dodaj wiersz do tabeli w `BACKLOG.md`**

W sekcji „Tabela" (po wierszu F-rozw) dodaj:

```markdown
| **F-tabord** | ✅ **ZROBIONE (kod)** — Przeciąganie (przytrzymanie) zmienia kolejność zakładek listy; zapis per-użytkownik | Fork — front (Vue), bez backendu | Niskie–średnie (`ChatTypeTabs`/`ChatList`) | Spec/plan: `F-tabord-draggable-tabs-*.md`. ui_settings `conversation_tabs_order` |
```

- [ ] **Step 3: Commit**

```bash
git commit -am "docs(klimabazar): F-tabord - rejestr CUSTOMIZATIONS.md + BACKLOG"
```

---

## Self-Review (po napisaniu)

- **Pokrycie specu:** kolejność z ui_settings + forward-compat (Task 1 Step 2) ✓; zapis per-user (Task 1 Step 3) ✓; drag z przytrzymaniem + ghost + contents (Task 2) ✓; krótki klik nadal przełącza (delay) ✓; rejestr (Task 3) ✓.
- **Spójność nazw:** `DEFAULT_TAB_ORDER`, `orderedTabItems`, `onTabsReorder`, `conversation_tabs_order`, emit `reorder`, `localItems`, `onDragEnd` — użyte jednolicie w obu plikach. `orderedTabItems` opakowuje istniejące `listTabItems` (F-rozw). ✓
- **Brak placeholderów:** każdy krok ma pełny kod/komendę. ✓
- **Fallback B** (własny flex-row) nieujęty jako task — wchodzi tylko, jeśli Task 2 Step 4 wykaże złe działanie `contents`/Sortable; wtedy korekta `ChatTypeTabs` w ramach tego samego taska.
