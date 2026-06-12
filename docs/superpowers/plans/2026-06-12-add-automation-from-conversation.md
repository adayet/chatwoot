# „Dodaj nową automatyzację" z listy konwersacji — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać do menu kontekstowego konwersacji (prawy przycisk) pozycję „Dodaj nową automatyzację", która otwiera modal reguły automatyzacji z prefillem: zdarzenie `conversation_created`, warunki `email`/`mail_subject` z konwersacji, akcja `add_label` (pusta).

**Architecture:** Reużycie istniejącego, samowystarczalnego modala `AddAutomationRule.vue`. Jedna instancja montowana w `ChatList.vue` (provider menu kontekstowego). Przepływ: context menu → emit → `ConversationItem` → wstrzyknięte `openAutomationFromConversation(source)` → `ChatList` buduje prefill i woła `open(prefill)`; zapis przez `automations/create`.

**Tech Stack:** Vue 3 (`<script setup>` + Options API w istniejących plikach), Vuex, vue-i18n, Tailwind. Fork `klimabazar` — każda zmiana z markerem `KLIMABAZAR`.

**Uwaga o testach:** Zgodnie z `CLAUDE.md` tego repo („Avoid writing specs unless explicitly asked", MVP/happy-path) **nie piszemy testów**. Weryfikacja ręczna w lokalnym dev Docker (parytet): `http://localhost:3001`, login `john@acme.inc` / `Password1!`. `john` jest adminem konta seed.

**Spec:** `docs/superpowers/specs/2026-06-12-add-automation-from-conversation-design.md`

---

## Struktura plików

| Plik | Rola | Akcja |
|---|---|---|
| `app/javascript/dashboard/i18n/locale/en/conversation.json` | etykieta EN pozycji menu | Modify |
| `app/javascript/dashboard/i18n/locale/pl/conversation.json` | etykieta PL pozycji menu | Modify |
| `app/javascript/dashboard/routes/dashboard/settings/automation/AddAutomationRule.vue` | modal — `open(prefill)` opcjonalny | Modify |
| `app/javascript/dashboard/components/widgets/conversation/contextMenu/Index.vue` | nowa pozycja menu (admin) + emit | Modify |
| `app/javascript/dashboard/components/ConversationItem.vue` | most: emit menu → inject | Modify |
| `app/javascript/dashboard/components/ChatList.vue` | montaż modala + provide + prefill + zapis | Modify |
| `CUSTOMIZATIONS.md` | wpis do rejestru zmian forka | Modify |

---

## Task 1: i18n — etykieta pozycji menu (EN + PL)

**Files:**
- Modify: `app/javascript/dashboard/i18n/locale/en/conversation.json` (blok `CARD_CONTEXT_MENU`, ~l.185–186)
- Modify: `app/javascript/dashboard/i18n/locale/pl/conversation.json` (blok `CARD_CONTEXT_MENU`, ~l.184–185)

- [ ] **Step 1: Dodaj klucz EN**

W pliku `en/conversation.json`, w obiekcie `CARD_CONTEXT_MENU`, tuż po linii z `"COPY_LINK_SUCCESS": ...` dodaj nowy klucz (pamiętaj o przecinku po poprzedniej linii):

```json
      "COPY_LINK_SUCCESS": "Conversation link copied to clipboard",
      "ADD_AUTOMATION": "Add new automation",
```

- [ ] **Step 2: Dodaj klucz PL**

W pliku `pl/conversation.json`, w obiekcie `CARD_CONTEXT_MENU`, analogicznie po `"COPY_LINK_SUCCESS"`:

```json
      "COPY_LINK_SUCCESS": "Link do rozmowy skopiowany do schowka",
      "ADD_AUTOMATION": "Dodaj nową automatyzację",
```

- [ ] **Step 3: Walidacja JSON**

Run:
```bash
cd /Users/azalenski/dev/chatwoot
python3 -c "import json; json.load(open('app/javascript/dashboard/i18n/locale/en/conversation.json')); json.load(open('app/javascript/dashboard/i18n/locale/pl/conversation.json')); print('JSON OK')"
```
Expected: `JSON OK`

- [ ] **Step 4: Commit**

```bash
git commit -am "i18n(klimabazar): F-auto - etykieta 'Dodaj nowa automatyzacje' (en+pl)"
```

---

## Task 2: `AddAutomationRule.vue` — `open(prefill)` opcjonalny

**Files:**
- Modify: `app/javascript/dashboard/routes/dashboard/settings/automation/AddAutomationRule.vue:47-51`

Obecny kod:
```js
const open = () => {
  automation.value = structuredClone(START_VALUE);
  manifestCustomAttributes();
  formRef.value?.open();
};
```

- [ ] **Step 1: Rozszerz `open` o opcjonalny argument prefill**

Zamień metodę `open` na:

```js
// KLIMABAZAR F-auto: opcjonalny prefill (otwarcie z listy konwersacji);
// brak argumentu = zachowanie jak dotychczas (otwarcie z Ustawien).
const open = prefill => {
  automation.value = prefill
    ? structuredClone(prefill)
    : structuredClone(START_VALUE);
  manifestCustomAttributes();
  formRef.value?.open();
};
```

- [ ] **Step 2: Weryfikacja kompatybilności wstecznej (lint)**

Run:
```bash
cd /Users/azalenski/dev/chatwoot && pnpm eslint app/javascript/dashboard/routes/dashboard/settings/automation/AddAutomationRule.vue
```
Expected: brak błędów (0 problems).
Uzasadnienie: wywołanie z `Index.vue` to `addDialogRef.value?.open()` (bez argumentu) → `prefill` = `undefined` → gałąź `START_VALUE`, identyczne zachowanie.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(klimabazar): F-auto - AddAutomationRule.open(prefill) opcjonalny"
```

---

## Task 3: Pozycja w menu kontekstowym (tylko admin)

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/contextMenu/Index.vue`

- [ ] **Step 1: Dodaj klucz do obiektu `MENU`**

W obiekcie `MENU` (l.15–27), po `COPY_LINK: 'copy-link',` dodaj:

```js
  COPY_LINK: 'copy-link',
  ADD_AUTOMATION: 'add-automation', // KLIMABAZAR F-auto
};
```

- [ ] **Step 2: Dodaj zdarzenie do `emits`**

W tablicy `emits` (l.69–80), po `'deleteConversation',` dodaj `'addAutomation',`:

```js
    'deleteConversation',
    'addAutomation',
    'close',
```

- [ ] **Step 3: Dodaj definicję opcji w `data()`**

W `data()` (po `copyLinkOption`, ~l.173–177) dodaj:

```js
      copyLinkOption: {
        key: MENU.COPY_LINK,
        icon: 'copy',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.COPY_LINK'),
      },
      // KLIMABAZAR F-auto
      addAutomationOption: {
        key: MENU.ADD_AUTOMATION,
        icon: 'automation',
        label: this.$t('CONVERSATION.CARD_CONTEXT_MENU.ADD_AUTOMATION'),
      },
```

- [ ] **Step 4: Dodaj pozycję w template (tylko admin)**

W template, w bloku admina (obecnie tylko DELETE, l.398–405), dodaj pozycję automatyzacji nad DELETE. Zamień ten blok:

```html
    <template v-if="isAdmin && isAllowed([MENU.DELETE])">
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
      <MenuItem
        :option="deleteOption"
        variant="icon"
        @click.stop="deleteConversation"
      />
    </template>
```

na:

```html
    <!-- KLIMABAZAR F-auto: tworzenie automatyzacji z prefillem z konwersacji -->
    <template v-if="isAdmin">
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
      <MenuItem
        :option="addAutomationOption"
        variant="icon"
        @click.stop="$emit('addAutomation')"
      />
    </template>
    <template v-if="isAdmin && isAllowed([MENU.DELETE])">
      <hr class="m-1 rounded border-b border-n-weak dark:border-n-weak" />
      <MenuItem
        :option="deleteOption"
        variant="icon"
        @click.stop="deleteConversation"
      />
    </template>
```

- [ ] **Step 5: Lint**

Run:
```bash
cd /Users/azalenski/dev/chatwoot && pnpm eslint app/javascript/dashboard/components/widgets/conversation/contextMenu/Index.vue
```
Expected: 0 problems.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(klimabazar): F-auto - pozycja menu 'Dodaj automatyzacje' (admin)"
```

---

## Task 4: `ConversationItem.vue` — most emit → inject

**Files:**
- Modify: `app/javascript/dashboard/components/ConversationItem.vue`

- [ ] **Step 1: Wstrzyknij handler z providera**

W bloku `inject` (l.24–36), po `const deleteConversation = inject('deleteConversation');` dodaj:

```js
const deleteConversation = inject('deleteConversation');
// KLIMABAZAR F-auto
const openAutomationFromConversation = inject(
  'openAutomationFromConversation'
);
```

- [ ] **Step 2: Dodaj handler**

Po funkcji `onDeleteConversation` (l.175–178) dodaj:

```js
const onDeleteConversation = () => {
  deleteConversation(props.source.id);
  closeContextMenu();
};

// KLIMABAZAR F-auto
const onAddAutomation = () => {
  openAutomationFromConversation(props.source);
  closeContextMenu();
};
```

- [ ] **Step 3: Podepnij zdarzenie w template**

W `<ConversationContextMenu>` (l.224–242), po `@delete-conversation="onDeleteConversation"` dodaj:

```html
      @delete-conversation="onDeleteConversation"
      @add-automation="onAddAutomation"
      @close="closeContextMenu"
```

- [ ] **Step 4: Lint**

Run:
```bash
cd /Users/azalenski/dev/chatwoot && pnpm eslint app/javascript/dashboard/components/ConversationItem.vue
```
Expected: 0 problems.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(klimabazar): F-auto - ConversationItem przekazuje addAutomation do providera"
```

---

## Task 5: `ChatList.vue` — montaż modala, provide, prefill, zapis

**Files:**
- Modify: `app/javascript/dashboard/components/ChatList.vue`

Dostępne w pliku: `store` (l.71), `useAlert` (l.22), `t` (l.68), `provide` (import l.2), `ref` (import l.2).

- [ ] **Step 1: Import modala**

Po imporcie `ConversationResolveAttributesModal` (l.18) dodaj:

```js
import ConversationResolveAttributesModal from 'dashboard/components-next/ConversationWorkflow/ConversationResolveAttributesModal.vue';
// KLIMABAZAR F-auto
import AddAutomationRule from 'dashboard/routes/dashboard/settings/automation/AddAutomationRule.vue';
```

- [ ] **Step 2: Ref na modal + prefill builder + provide + zapis**

Bezpośrednio przed blokiem `provide('selectConversation', ...)` (l.851) dodaj:

```js
// KLIMABAZAR F-auto: tworzenie automatyzacji z prefillem z konwersacji
const automationFormRef = ref(null);

const buildAutomationPrefill = conversation => {
  const email = conversation.meta?.sender?.email;
  const subject = conversation.additional_attributes?.mail_subject;

  const conditions = [];
  if (email) {
    conditions.push({
      attribute_key: 'email',
      filter_operator: 'equal_to',
      values: email,
      query_operator: 'and',
      custom_attribute_type: '',
    });
  }
  if (subject) {
    conditions.push({
      attribute_key: 'mail_subject',
      filter_operator: 'equal_to',
      values: subject,
      query_operator: 'and',
      custom_attribute_type: '',
    });
  }
  if (!conditions.length) return null; // brak danych → pusty formularz

  conditions[conditions.length - 1].query_operator = null;
  return {
    name: null,
    description: null,
    event_name: 'conversation_created',
    conditions,
    actions: [{ action_name: 'add_label', action_params: [] }],
  };
};

const openAutomationFromConversation = conversation => {
  const prefill = buildAutomationPrefill(conversation);
  automationFormRef.value?.open(prefill);
};

const onSaveAutomationFromConversation = async payload => {
  try {
    await store.dispatch('automations/create', payload);
    useAlert(t('AUTOMATION.ADD.API.SUCCESS_MESSAGE'));
    automationFormRef.value?.close();
  } catch (error) {
    useAlert(t('AUTOMATION.ADD.API.ERROR_MESSAGE'));
  }
};

provide('openAutomationFromConversation', openAutomationFromConversation);
```

- [ ] **Step 3: Zamontuj modal w template**

W template, po `<ConversationResolveAttributesModal ... />` (kończy się ~l.1006, tuż przed `</div>`) dodaj:

```html
    <ConversationResolveAttributesModal
      ref="resolveAttributesModalRef"
      @submit="handleResolveWithAttributes"
    />
    <!-- KLIMABAZAR F-auto -->
    <AddAutomationRule
      ref="automationFormRef"
      @save-automation="onSaveAutomationFromConversation"
    />
  </div>
```

- [ ] **Step 4: Lint**

Run:
```bash
cd /Users/azalenski/dev/chatwoot && pnpm eslint app/javascript/dashboard/components/ChatList.vue
```
Expected: 0 problems.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(klimabazar): F-auto - ChatList montuje modal automatyzacji + prefill z konwersacji"
```

---

## Task 6: Weryfikacja ręczna (lokalny Docker) + rejestr w CUSTOMIZATIONS.md

**Files:**
- Modify: `CUSTOMIZATIONS.md` (rejestr zmian)

- [ ] **Step 1: Uruchom lokalny dev (jeśli nie działa)**

Run:
```bash
cd /Users/azalenski/dev/chatwoot && docker compose up -d && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/
```
Expected: `200` (vite HMR podchwyci zmiany Vue na żywo).

- [ ] **Step 2: Test ścieżki happy-path (konwersacja e-mail)**

W przeglądarce `http://localhost:3001`, login `john@acme.inc` / `Password1!`:
1. Na liście konwersacji prawy przycisk na konwersacji z kanału e-mail.
2. Sprawdź pozycję **„Dodaj nową automatyzację"** (na dole, nad „Usuń rozmowę").
3. Kliknij → otwiera się modal reguły, tryb create.
4. Zweryfikuj prefill: zdarzenie „Konwersacja utworzona"; warunek `Email` = adres nadawcy; warunek `Email subject` = temat; akcja „Add a Label" bez wybranej etykiety.
5. Wybierz etykietę, zapisz → alert sukcesu, modal się zamyka.
6. Wejdź w *Ustawienia → Automatyzacja* → reguła jest na liście.

Expected: wszystkie punkty spełnione.

- [ ] **Step 3: Test braku danych (kanał bez maila/tematu)**

1. Prawy przycisk na konwersacji czatu na stronie (bez maila).
2. „Dodaj nową automatyzację" → modal otwiera się z **pustym** formularzem (domyślny warunek `status`).

Expected: brak błędów w konsoli, pusty formularz.

- [ ] **Step 4: Test uprawnień (nie-admin)**

Zaloguj się agentem nie-adminem (lub czasowo zmień rolę). Prawy przycisk → pozycji „Dodaj nową automatyzację" **nie ma**.

Expected: pozycja ukryta dla nie-admina.

- [ ] **Step 5: Wpis do rejestru `CUSTOMIZATIONS.md`**

W tabeli „Rejestr zmian" dodaj wiersz:

```
| `contextMenu/Index.vue` + `ConversationItem.vue` + `ChatList.vue` + `AddAutomationRule.vue` (F-auto) | menu kontekstowe konwersacji: pozycja „Dodaj nową automatyzację" (tylko admin) → modal reguły z prefillem (zdarzenie `conversation_created`, warunki `email`/`mail_subject` z konwersacji, akcja `add_label` pusta); reużycie modala z Ustawień, zapis przez `automations/create`; `open(prefill)` opcjonalny | szybsze tworzenie reguł anty-spam z poziomu listy | średnia (pliki upstream: menu/karta/lista) — grep `KLIMABAZAR F-auto` | prawy przycisk na konwersacji e-mail → pozycja widoczna → modal z prefillem email+temat i pustą akcją label; zapis → reguła w Ustawieniach |
```

- [ ] **Step 6: Commit**

```bash
git commit -am "docs(klimabazar): F-auto - wpis do rejestru CUSTOMIZATIONS.md"
```

---

## Self-review (pokrycie spec)

- Pozycja menu „Dodaj nową automatyzację" → Task 1 (i18n), Task 3 (menu).
- Tylko admin → Task 3 (`v-if="isAdmin"`).
- Bez przekierowania, reużycie modala → Task 5 (montaż w `ChatList`), Task 2 (`open(prefill)`).
- Prefill: `conversation_created` + `email`/`mail_subject` + `add_label` pusty → Task 5 (`buildAutomationPrefill`).
- Przypadki brzegowe (brak tematu / brak danych = pusty formularz) → Task 5 (warunkowe `push`, `null` → START_VALUE w Task 2).
- Łączenie `and` + ostatni `null` → Task 5.
- Zapis przez `automations/create` (mirror z Index.vue) → Task 5 (`onSaveAutomationFromConversation`).
- Markery `KLIMABAZAR` → wszystkie taski.
- Wpis do `CUSTOMIZATIONS.md` → Task 6.
- Bez zmian backendu/Enterprise → potwierdzone (czysto front, reużycie OSS store).
