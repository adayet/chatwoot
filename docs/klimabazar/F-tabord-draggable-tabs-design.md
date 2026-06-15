# F-tabord — Przeciąganie (zmiana kolejności) zakładek listy rozmów per-użytkownik

**Data:** 2026-06-15 · **Marker:** `KLIMABAZAR F-tabord` · **Warstwa:** fork frontu (Vue), bez backendu/i18n/migracji

## Cel biznesowy (słowa właściciela)
> „Czy możemy zrobić tak, aby każdy użytkownik mógł sobie przytrzymaniem na danej zakładce zmienić kolejność zakładek?"

Każdy użytkownik może **przytrzymać** zakładkę w rzędzie listy rozmów i przeciągnąć ją na inną pozycję. Kolejność zapisywana **per-użytkownik**.

## Ustalenia (brainstorming 2026-06-15)
- **Zakres:** wszystkie 5 zakładek (Wszystkie/Moje/Nieprzypisane + Rozwiązane/Nierozwiązane) przesuwalne **swobodnie** — można mieszać oś przypisania i statusu. Kolejność z F1 staje się tylko **domyślną** dla nieprzestawionych.
- **Reset:** brak przycisku „przywróć domyślną" (MVP).
- **Persystencja:** per-użytkownik (ui_settings są per-user-per-account).
- **Interakcja:** przytrzymanie (~200 ms) startuje drag; krótki klik nadal przełącza zakładkę.

## Stan zastany (zweryfikowany)
- `ChatTypeTabs.vue` używany **tylko** w `ChatList.vue` (rząd zakładek listy). Renderuje `woot-tabs` (`components/ui/Tabs/Tabs.vue`) → `<ul class="flex">` ze slotem; każda pozycja to `woot-tabs-item` (`TabsItem.vue`) = `<li>`. Podświetlenie aktywnej: `active = (props.index === activeIndex)`; `ChatTypeTabs` liczy `activeTabIndex` = indeks po `key` w `items` → po reorderze pozostaje spójne.
- `vuedraggable@^4.1.0` w `package.json`; kanoniczny wzorzec w `routes/dashboard/conversation/customAttributes/CustomAttributes.vue`: `<Draggable :list item-key handle ghost-class @end>` + slot `#item`, w `@end` odczyt nowej kolejności i `updateUISettings(...)`.
- `useUISettings().updateUISettings({...})` — persystencja per-user. Precedensy kluczy: `conversation_sidebar_items_order`, `contact_sidebar_items_order`, `sidebar_width`.
- F1: `ASSIGNEE_TAB_ORDER = ['all','me','unassigned']` sortuje `assigneeTabItems` w `ChatList.vue:181`. F-rozw dokłada `resolved`/`unresolved` w `listTabItems`.

## Architektura zmiany (marker `KLIMABAZAR F-tabord`)

### 1. Kolejność na poziomie danych — `ChatList.vue`
- Stała `DEFAULT_TAB_ORDER = ['all','me','unassigned','resolved','unresolved']` (F1 + status).
- `listTabItems` (z F-rozw) buduje 5 pozycji, a następnie **sortuje wg zapisanej kolejności użytkownika**:
  - źródło: `uiSettings.value.conversation_tabs_order` (tablica kluczy),
  - klucze obecne w zapisie → wg ich pozycji; klucze spoza zapisu → na koniec w kolejności `DEFAULT_TAB_ORDER` (forward-compat dla przyszłych zakładek),
  - brak zapisu → pełny `DEFAULT_TAB_ORDER`.
- Computed `orderedTabItems` opakowuje `listTabItems` tym sortem; do `ChatTypeTabs` idzie `orderedTabItems`.

### 2. Drag w `ChatTypeTabs.vue`
- Import `Draggable` z `vuedraggable`.
- W template `woot-tabs` slot: `woot-tabs-item` renderowane przez `<Draggable>`:
  - `class="contents"` — wrapper Draggable znika z układu (Tailwind `contents`), `<li>` pozostają flex-itemami `<ul>`,
  - `:delay="200"` + `:delay-on-touch-only="false"` (Sortable: przytrzymanie startuje drag, krótki klik = `onTabClick`),
  - `ghost-class="opacity-40"` (Tailwind, bez custom CSS),
  - `item-key="key"`, lista = lokalny `ref` zsynchronizowany z `props.items` (watch), slot `#item="{ element, index }"` renderuje `woot-tabs-item` z `:index`, `:name`, `:count`.
- Na `@end` emit `reorder` z nową tablicą kluczy (`localItems.map(i => i.key)`).
- `defineEmits(['chatTabChange', 'reorder'])`.
- `activeTabIndex` bez zmian (liczone po kluczu) — po reorderze poprawne.

### 3. Persystencja — `ChatList.vue`
- W `ChatList.vue:69` jest dziś `const { uiSettings } = useUISettings();` → rozszerzyć do `const { uiSettings, updateUISettings } = useUISettings();`.
- Handler `onTabsReorder(keys)` → `updateUISettings({ conversation_tabs_order: keys })`.
- Bind: `<ChatTypeTabs :items="orderedTabItems" :active-tab="activeListTab" @chat-tab-change="updateListTab" @reorder="onTabsReorder" />`.

### Ryzyko implementacyjne i fallback
Współpraca `woot-tabs` + Sortable + `display:contents`. **Plan A** (powyżej) zachowuje natywny wygląd zakładek, mało kodu. Jeśli `contents`/Sortable policzą drop-position źle, **fallback B**: `ChatTypeTabs` renderuje własny flex-row przycisków z `Draggable` (pełna kontrola; ~30 linii Tailwinda z `TabsItem`: aktywny underline + badge), kosztem rozjazdu z upstream `woot-tabs`. Domyślnie A; B tylko gdy A zawiedzie w weryfikacji wizualnej.

## Pliki (rejestr do CUSTOMIZATIONS.md)
| Plik | Zmiana | Kruchość |
|---|---|---|
| `ChatTypeTabs.vue` (F-tabord) | `Draggable` (delay 200 ms = przytrzymanie, `contents`, ghost) wokół `woot-tabs-item`; emit `reorder` z kolejnością kluczy | średnia (komponent współdzielony tab-bara, ale używany tylko w ChatList) — grep `KLIMABAZAR F-tabord` |
| `ChatList.vue` (F-tabord) | `DEFAULT_TAB_ORDER` + `orderedTabItems` (sort wg `uiSettings.conversation_tabs_order`) + `onTabsReorder` → `updateUISettings` | niska–średnia |

## Poza zakresem (YAGNI)
- Przycisk „przywróć domyślną kolejność".
- Reorder z ograniczeniem do grup (ustalono: swobodnie wszystkie 5).
- Synchronizacja kolejności między urządzeniami ponad to, co daje ui_settings (per-user-per-account — wystarcza).
- Backend / migracja / i18n (brak).

## Jak zweryfikować
1. Przytrzymanie (~200 ms) na zakładce i przeciągnięcie zmienia jej pozycję; krótki klik nadal przełącza zakładkę (nie startuje drag).
2. Po odświeżeniu strony kolejność zostaje (zapisana w `conversation_tabs_order`).
3. Inny użytkownik (inne konto/login) ma własną, niezależną kolejność (domyślną, dopóki nie przestawi).
4. Liczniki i podświetlenie aktywnej zakładki działają po reorderze (aktywna = ta sama zakładka, badge zgodny).
5. Domyślnie (bez zapisu) kolejność = Wszystkie/Moje/Nieprzypisane/Rozwiązane/Nierozwiązane.
