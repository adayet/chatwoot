# F6 — zachowanie wątków „rozwiązanych" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domyślny filtr listy rozmów = „Wszystkie" dla każdego użytkownika, a każdy wiersz koloruje się i dostaje badge wg stanu obsługi (nowy / w toku / rozwiązane / uśpione / oczekujące).

**Architecture:** Czysto front (Vue). Bez zmian backendu, bez migracji. Cała logika stanu i prezentacja w jednym komponencie wiersza (`ConversationCard.vue`); zmiana defaultu filtra w `ChatList.vue` + store. Dane już są na froncie (`chat.status`, `chat.meta.assignee`, `chat.first_reply_created_at`). Podejście A ze specu (minimalna powierzchnia forka).

**Tech Stack:** Vue 3 `<script setup>`, Vuex, Tailwind (tokeny `n-*` z `theme/colors.js`), vue-i18n.

**Spec:** [F6-design.md](F6-design.md) · **Diagnoza:** [F6-resolved-conversations-spike.md](F6-resolved-conversations-spike.md)

---

## Prerekwizyt środowiska
Weryfikacja wizualna wymaga uruchomionego dashboardu z danymi. Wystarczy lokalny dev (`pnpm dev` / `overmind start -f Procfile.dev` + `bundle exec rails db:seed`) albo docelowy Docker parytetu prod (CLAUDE.local.md — do ustawienia). Wybór środowiska przy wykonaniu. Reopen (F6a) już potwierdzony na prod — nie wymaga ponownego testu.

## Mapa plików
- Modify: `app/javascript/dashboard/components/ChatList.vue` — default `activeStatus` + fallback resetu (Zadanie 1).
- Modify: `app/javascript/dashboard/store/modules/conversations/index.js` — default `chatStatusFilter` (Zadanie 1).
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue` — computed `handlingState` + klasy + badge (Zadania 2–3).
- Modify: `app/javascript/dashboard/i18n/locale/en/chatlist.json` + `…/pl/chatlist.json` — etykiety badge (Zadanie 4).
- Modify: `CUSTOMIZATIONS.md` — wpis rejestru forka (Zadanie 5).

---

### Zadanie 1: Domyślny filtr listy = „Wszystkie"

**Files:**
- Modify: `app/javascript/dashboard/components/ChatList.vue:76` i `:365`
- Modify: `app/javascript/dashboard/store/modules/conversations/index.js:15`

- [ ] **Step 1: Zmień default ref `activeStatus` w ChatList.vue (l. 76)**

Z:
```js
const activeStatus = ref(wootConstants.STATUS_TYPE.OPEN);
```
Na:
```js
// KLIMABAZAR F6: domyslnie pokazuj wszystkie statusy (nie tylko otwarte)
const activeStatus = ref(wootConstants.STATUS_TYPE.ALL);
```

- [ ] **Step 2: Zmień fallback w `setFiltersFromUISettings` (l. 365)**

Z:
```js
  activeStatus.value = status || wootConstants.STATUS_TYPE.OPEN;
```
Na:
```js
  // KLIMABAZAR F6: brak zapisanej preferencji -> Wszystkie
  activeStatus.value = status || wootConstants.STATUS_TYPE.ALL;
```

- [ ] **Step 3: Zmień default store `chatStatusFilter` (index.js l. 15)**

Z:
```js
  chatStatusFilter: wootConstants.STATUS_TYPE.OPEN,
```
Na:
```js
  // KLIMABAZAR F6: domyslny filtr listy = Wszystkie
  chatStatusFilter: wootConstants.STATUS_TYPE.ALL,
```

- [ ] **Step 4: Lint zmienionych plików**

Run: `pnpm eslint app/javascript/dashboard/components/ChatList.vue app/javascript/dashboard/store/modules/conversations/index.js`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add app/javascript/dashboard/components/ChatList.vue app/javascript/dashboard/store/modules/conversations/index.js
git commit -m "feat(klimabazar): domyslny filtr listy rozmow = Wszystkie (F6)"
```

---

### Zadanie 2: Computed `handlingState` w ConversationCard.vue

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue` (sekcja `<script setup>`, po istniejących computed, ~l. 64)

- [ ] **Step 1: Dodaj mapę stanów i computed po `showLabelsSection` (po l. 64)**

```js
// KLIMABAZAR F6: kolorowanie wiersza + badge wg stanu obslugi
const HANDLING_STATES = {
  new: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.NEW',
    tone: 'bg-n-amber-2',
    border: 'border-l-2 border-l-n-amber-9',
    badge: 'bg-n-amber-3 text-n-amber-11',
  },
  inProgress: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.IN_PROGRESS',
    tone: 'bg-n-blue-2',
    border: 'border-l-2 border-l-n-blue-9',
    badge: 'bg-n-blue-3 text-n-blue-11',
  },
  resolved: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.RESOLVED',
    tone: 'bg-n-teal-2',
    border: 'border-l-2 border-l-n-teal-9',
    badge: 'bg-n-teal-3 text-n-teal-11',
  },
  snoozed: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.SNOOZED',
    tone: 'bg-n-slate-2',
    border: 'border-l-2 border-l-n-slate-8',
    badge: 'bg-n-slate-3 text-n-slate-11',
  },
  pending: {
    labelKey: 'CHAT_LIST.HANDLING_STATE.PENDING',
    tone: 'bg-n-iris-2',
    border: 'border-l-2 border-l-n-iris-9',
    badge: 'bg-n-iris-3 text-n-iris-11',
  },
};

const handlingStateKey = computed(() => {
  const { status } = props.chat;
  if (status === 'resolved') return 'resolved';
  if (status === 'snoozed') return 'snoozed';
  if (status === 'pending') return 'pending';
  // open: rozroznienie nieobsluzony vs w toku
  const hasAssignee = Boolean(props.chat.meta?.assignee?.id);
  const hasReplied = Number(props.chat.first_reply_created_at) > 0;
  return hasAssignee || hasReplied ? 'inProgress' : 'new';
});

const handlingState = computed(() => HANDLING_STATES[handlingStateKey.value]);

// tlo tylko gdy wiersz nie jest aktywny/zaznaczony (zeby nie nadpisywac tych stanow)
const handlingToneClass = computed(() =>
  props.isActiveChat || props.selected ? '' : handlingState.value.tone
);
```

- [ ] **Step 2: Lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue`
Expected: brak błędów (mogą pojawić się ostrzeżenia o nieużytych `handlingState`/`handlingToneClass` do czasu Zadania 3 — to OK, użyjemy ich w template).

- [ ] **Step 3: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue
git commit -m "feat(klimabazar): wylicz stan obslugi rozmowy w karcie (F6)"
```

---

### Zadanie 3: Zastosuj tło, lewy pasek i badge w template

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue` (template, root `<div>` l. 104–115 oraz po `<h4>` l. 176)

- [ ] **Step 1: Zamień `:class` root `<div>` (l. 106–112) z obiektu na tablicę**

Z:
```html
    :class="{
      'active animate-card-select bg-n-background !border-n-surface-1':
        isActiveChat,
      'selected bg-n-slate-2 !border-n-surface-1': selected,
      'px-0': compact,
      'px-3': !compact,
    }"
```
Na:
```html
    :class="[
      {
        'active animate-card-select bg-n-background !border-n-surface-1':
          isActiveChat,
        'selected bg-n-slate-2 !border-n-surface-1': selected,
        'px-0': compact,
        'px-3': !compact,
      },
      handlingState.border,
      handlingToneClass,
    ]"
```

- [ ] **Step 2: Dodaj badge zaraz po `<h4>` z nazwą kontaktu (po l. 176)**

Wstaw bezpośrednio po zamykającym `</h4>` (l. 176), przed `<VoiceCallStatus …>`:
```html
      <span
        class="inline-flex items-center mx-2 mt-1 px-1.5 py-0.5 rounded-md text-xxs font-medium leading-3 w-fit"
        :class="handlingState.badge"
      >
        {{ $t(handlingState.labelKey) }}
      </span>
```

- [ ] **Step 3: Lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue`
Expected: brak błędów ani ostrzeżeń o nieużytych zmiennych.

- [ ] **Step 4: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue
git commit -m "feat(klimabazar): koloruj wiersz + badge statusu na liscie (F6)"
```

---

### Zadanie 4: Etykiety i18n (en + pl)

**Files:**
- Modify: `app/javascript/dashboard/i18n/locale/en/chatlist.json` (po bloku `CHAT_STATUS_FILTER_ITEMS`, ~l. 38)
- Modify: `app/javascript/dashboard/i18n/locale/pl/chatlist.json` (analogicznie)

- [ ] **Step 1: Dodaj blok `HANDLING_STATE` w en/chatlist.json**

Bezpośrednio po zamknięciu `"CHAT_STATUS_FILTER_ITEMS": { … },` dodaj:
```json
    "HANDLING_STATE": {
      "NEW": "New",
      "IN_PROGRESS": "In progress",
      "RESOLVED": "Resolved",
      "SNOOZED": "Snoozed",
      "PENDING": "Pending"
    },
```

- [ ] **Step 2: Dodaj blok `HANDLING_STATE` w pl/chatlist.json**

W tym samym miejscu (po `CHAT_STATUS_FILTER_ITEMS`):
```json
    "HANDLING_STATE": {
      "NEW": "Nowy",
      "IN_PROGRESS": "W toku",
      "RESOLVED": "Rozwiązane",
      "SNOOZED": "Uśpione",
      "PENDING": "Oczekujące"
    },
```

- [ ] **Step 3: Walidacja JSON**

Run: `node -e "require('./app/javascript/dashboard/i18n/locale/en/chatlist.json'); require('./app/javascript/dashboard/i18n/locale/pl/chatlist.json'); console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 4: Commit**

```bash
git add app/javascript/dashboard/i18n/locale/en/chatlist.json app/javascript/dashboard/i18n/locale/pl/chatlist.json
git commit -m "feat(klimabazar): etykiety stanu obslugi na liscie (en+pl) (F6)"
```

> Uwaga: edycja `pl.json` to świadome odstępstwo od reguły upstream „tylko en" — instalacja jest PL-only, bez tego badge wyświetli się po angielsku. Odnotowane w Zadaniu 5.

---

### Zadanie 5: Wpis w CUSTOMIZATIONS.md

**Files:**
- Modify: `CUSTOMIZATIONS.md`

- [ ] **Step 1: Dopisz wpis F6 w sekcji zmian (dopasuj format do istniejących wpisów w pliku)**

Treść wpisu:
```markdown
### F6 — widoczność i status rozmów na liście (front)
- **Pliki:** `ChatList.vue`, `store/modules/conversations/index.js`, `ConversationCard.vue`, `i18n/locale/{en,pl}/chatlist.json`
- **Co:** domyślny filtr listy = „Wszystkie" (zamiast „Otwarte"); kolorowanie tła + lewy pasek + badge wg stanu obsługi (nowy/w toku/rozwiązane/uśpione/oczekujące).
- **Dlaczego:** rozwiązane wątki znikały z pola widzenia; właściciel chce je widzieć i odróżniać nieobsłużone od obsługiwanych. Reopen (F6a) działa natywnie — nie zmieniany.
- **Marker:** `KLIMABAZAR F6` w kodzie. Pliki JSON i18n bez markera (JSON nie wspiera komentarzy) — udokumentowane tutaj.
- **Odstępstwo:** edycja `pl.json` mimo reguły „tylko en" (instalacja PL-only).
```

- [ ] **Step 2: Commit**

```bash
git add CUSTOMIZATIONS.md
git commit -m "docs(klimabazar): rejestr zmian F6 (lista rozmow)"
```

---

### Zadanie 6: Weryfikacja w uruchomionym dashboardzie

**Files:** brak (weryfikacja manualna)

- [ ] **Step 1: Uruchom dashboard z danymi**

Run: `overmind start -f Procfile.dev` (lub Docker parytetu) + w razie potrzeby `bundle exec rails db:seed`.
Otwórz listę rozmów.

- [ ] **Step 2: Sprawdź domyślny filtr**

Oczekiwane: po wejściu na listę filtr statusu pokazuje „Wszystkie" (widać rozmowy we wszystkich statusach, w tym rozwiązane).

- [ ] **Step 3: Sprawdź 5 stanów wizualnie**

Oczekiwane na wierszach:
- rozmowa open, nieprzypisana, bez odpowiedzi → tło bursztynowe + lewy pasek + badge „Nowy".
- rozmowa open, przypisana **lub** po odpowiedzi agenta → tło niebieskie + badge „W toku".
- rozmowa resolved → tło zielone (teal) + badge „Rozwiązane".
- rozmowa snoozed → tło neutralne (slate) + badge „Uśpione".
- (opcjonalnie, jeśli da się wytworzyć) pending → tło fioletowe (iris) + badge „Oczekujące".
- Aktywny/zaznaczony wiersz: tło stanu ustępuje stanowi active/selected (brak konfliktu), lewy pasek może zniknąć — to OK.
- Tryb ciemny: tła i tekst badge czytelne (tokeny `n-*` auto-adaptują).

- [ ] **Step 4: Lint całości**

Run: `pnpm eslint app/javascript/dashboard/components/ChatList.vue app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue app/javascript/dashboard/store/modules/conversations/index.js`
Expected: brak błędów.

---

## Opcjonalnie (poza zakresem, jeśli użytkownik poprosi)
- Unit test (vitest) logiki `handlingStateKey` (czysta funkcja stanu) — pominięty zgodnie z CLAUDE.md („Avoid writing specs unless explicitly asked").

## Po zakończeniu — deploy (CLAUDE.local.md)
`git push` → CI buduje `ghcr.io/adayet/chatwoot:<sha>` → `pg_dump` → podmiana tagu w `/opt/chatwoot/docker-compose.yaml` → `docker compose pull rails sidekiq && docker compose up -d` (migracja zbędna — brak zmian DB). NIGDY `down -v`.
