# F-rozw — Zakładki „Rozwiązane"/„Nierozwiązane" — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać w poziomym rzędzie zakładek listy rozmów dwie wykluczające się pozycje — „Rozwiązane" i „Nierozwiązane" — z licznikiem rozmów, obok Wszystkie/Moje/Nieprzypisane.

**Architecture:** Rząd zakładek łączy oś przypisania (all/me/unassigned, status=ALL) i oś statusu (resolved / unresolved, assignee=ALL) w jeden wykluczający wybór w `ChatList.vue`. Backend dostaje 1-liniową gałąź `status=unresolved` → `where.not(status: :resolved)` w finderze (obsługuje listę i licznik meta — wspólny finder). Liczniki zakładek liczone niezależnie od aktywnego filtra trzema lekkimi strzałami `meta`.

**Tech Stack:** Vue 3 `<script setup>` (Composition API), Vuex, Rails ActiveRecord finder, i18n (vue-i18n + en.yml/json), lokalny dev w Dockerze (parytet, patrz `CLAUDE.local.md`).

**Uwaga o testach:** zgodnie z `CLAUDE.md` (Avoid writing specs unless explicitly asked, MVP) — bez RSpec/JS unit testów. Weryfikacja: `bundle exec rubocop`, `pnpm eslint`, `rails runner` (backend) i obserwacja w lokalnym Docker dev (`http://localhost:3001`, login `john@acme.inc` / `Password1!`).

**Spec:** `docs/klimabazar/F-rozw-resolved-tabs-design.md`

---

### Task 1: Backend — gałąź `status=unresolved` w finderze

**Files:**
- Modify: `app/finders/conversation_finder.rb:163-167`

- [ ] **Step 1: Dodaj gałąź `unresolved`**

W metodzie `filter_by_status`:

```ruby
def filter_by_status
  return if params[:status] == 'all'
  return @conversations = @conversations.where.not(status: :resolved) if params[:status] == 'unresolved' # KLIMABAZAR F-rozw
  @conversations = @conversations.where(status: params[:status] || DEFAULT_STATUS)
end
```

- [ ] **Step 2: Lint Ruby**

Run: `eval "$(rbenv init -)" && bundle exec rubocop app/finders/conversation_finder.rb`
Expected: brak offense'ów (linia < 150 znaków).

- [ ] **Step 3: Weryfikacja w konsoli (lokalny Docker dev)**

Run:
```bash
docker compose run --rm --no-deps rails bundle exec rails runner '
acc = Account.first
u = acc.users.first
Current.user = u
all = ConversationFinder.new(u, { status: "all" }).perform[:count][:all_count]
res = ConversationFinder.new(u, { status: "resolved" }).perform[:count][:all_count]
unr = ConversationFinder.new(u, { status: "unresolved" }).perform[:count][:all_count]
puts "all=#{all} resolved=#{res} unresolved=#{unr} sum=#{res + unr}"
'
```
Expected: `unresolved` = liczba rozmów ze statusem innym niż resolved; `resolved + unresolved == all`.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(klimabazar): F-rozw - finder obsluguje status=unresolved (not resolved)"
```

---

### Task 2: i18n — etykiety zakładek (en + pl)

**Files:**
- Modify: `app/javascript/dashboard/i18n/locale/en/chatlist.json:17-21`
- Modify: `app/javascript/dashboard/i18n/locale/pl/chatlist.json:17-21`

- [ ] **Step 1: Dodaj klucze w `en/chatlist.json`**

Blok `ASSIGNEE_TYPE_TABS` rozszerz do:

```json
    "ASSIGNEE_TYPE_TABS": {
      "me": "Mine",
      "unassigned": "Unassigned",
      "all": "All",
      "resolved": "Resolved",
      "unresolved": "Unresolved"
    },
```

- [ ] **Step 2: Dodaj klucze w `pl/chatlist.json`**

```json
    "ASSIGNEE_TYPE_TABS": {
      "me": "Moje",
      "unassigned": "Nieprzypisane",
      "all": "Wszystkie",
      "resolved": "Rozwiązane",
      "unresolved": "Nierozwiązane"
    },
```

- [ ] **Step 3: Walidacja JSON**

Run: `node -e "require('./app/javascript/dashboard/i18n/locale/en/chatlist.json'); require('./app/javascript/dashboard/i18n/locale/pl/chatlist.json'); console.log('OK')"`
Expected: `OK` (poprawny JSON w obu plikach).

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(klimabazar): F-rozw - i18n etykiety zakladek Rozwiazane/Nierozwiazane (en+pl)"
```

---

### Task 3: ChatList — niezależne liczniki zakładek (`fetchTabCounts`)

**Files:**
- Modify: `app/javascript/dashboard/components/ChatList.vue` (importy ~l.56; refy ~l.82; metody ~l.388)

- [ ] **Step 1: Zaimportuj `ConversationApi`**

Po linii 56 (`import { ASSIGNEE_TYPE_TAB_PERMISSIONS } ...`) dodaj:

```js
// KLIMABAZAR F-rozw: licznik zakladek przez endpoint meta
import ConversationApi from 'dashboard/api/inbox/conversation';
```

- [ ] **Step 2: Dodaj stałą statusu i ref liczników**

Po linii 82 (`const activeSortBy = ...`) dodaj:

```js
// KLIMABAZAR F-rozw: token filtra "wszystko oprocz rozwiazanych" (nienatywny status)
const UNRESOLVED_STATUS = 'unresolved';
// KLIMABAZAR F-rozw: liczniki zakladek niezalezne od aktywnego filtra (3x meta)
const tabCounts = ref({
  mineCount: 0,
  unAssignedCount: 0,
  allCount: 0,
  resolvedCount: 0,
  unresolvedCount: 0,
});
```

- [ ] **Step 3: Dodaj funkcję `fetchTabCounts`**

Tuż przed `function emitConversationLoaded()` (ok. l.407) dodaj:

```js
// KLIMABAZAR F-rozw: licz rozmowy per zakladka niezaleznie od aktywnego widoku
async function fetchTabCounts() {
  if (hasAppliedFiltersOrActiveFolders.value) return;
  const scope = {
    inboxId: props.conversationInbox || undefined,
    labels: props.label ? [props.label] : undefined,
    teamId: props.teamId || undefined,
    conversationType: props.conversationType || undefined,
  };
  try {
    const [all, resolved, unresolved] = await Promise.all([
      ConversationApi.meta({ ...scope, status: wootConstants.STATUS_TYPE.ALL }),
      ConversationApi.meta({
        ...scope,
        status: wootConstants.STATUS_TYPE.RESOLVED,
      }),
      ConversationApi.meta({ ...scope, status: UNRESOLVED_STATUS }),
    ]);
    tabCounts.value = {
      mineCount: all.data.meta.mine_count || 0,
      unAssignedCount: all.data.meta.unassigned_count || 0,
      allCount: all.data.meta.all_count || 0,
      resolvedCount: resolved.data.meta.all_count || 0,
      unresolvedCount: unresolved.data.meta.all_count || 0,
    };
  } catch (error) {
    // liczniki to kosmetyka – ignoruj bledy
  }
}
```

- [ ] **Step 4: Lint**

Run: `pnpm eslint app/javascript/dashboard/components/ChatList.vue`
Expected: brak błędów (funkcja jeszcze niewywoływana → ostrzeżenie o nieużyciu dopuszczalne, usuwane w Task 4).

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(klimabazar): F-rozw - ChatList fetchTabCounts (niezalezne liczniki)"
```

---

### Task 4: ChatList — 5 zakładek, handler i podświetlenie

**Files:**
- Modify: `app/javascript/dashboard/components/ChatList.vue` (`assigneeTabItems` ~l.182; nowe computed; `resetAndFetchData` ~l.589; `updateAssigneeTab` ~l.620; emitter ~l.817; onMounted ~l.822; template ~l.999)

- [ ] **Step 1: Przełącz `assigneeTabItems` na `tabCounts`**

W `assigneeTabItems` (l.188-192) zmień źródło licznika:

```js
    .map(({ key, count: countKey }) => ({
      key,
      name: t(`CHAT_LIST.ASSIGNEE_TYPE_TABS.${key}`),
      count: tabCounts.value[countKey] || 0, // KLIMABAZAR F-rozw: liczniki niezalezne
    }))
```

- [ ] **Step 2: Dodaj `listTabItems` i `activeListTab`**

Bezpośrednio po bloku `assigneeTabItems` (po l.197) dodaj:

```js
// KLIMABAZAR F-rozw: rzad zakladek = przypisanie + status (jeden wykluczajacy wybor)
const listTabItems = computed(() => [
  ...assigneeTabItems.value,
  {
    key: wootConstants.STATUS_TYPE.RESOLVED,
    name: t('CHAT_LIST.ASSIGNEE_TYPE_TABS.resolved'),
    count: tabCounts.value.resolvedCount,
  },
  {
    key: UNRESOLVED_STATUS,
    name: t('CHAT_LIST.ASSIGNEE_TYPE_TABS.unresolved'),
    count: tabCounts.value.unresolvedCount,
  },
]);

// KLIMABAZAR F-rozw: ktora zakladka podswietlona (status wygrywa nad przypisaniem)
const activeListTab = computed(() => {
  if (activeStatus.value === wootConstants.STATUS_TYPE.RESOLVED) {
    return wootConstants.STATUS_TYPE.RESOLVED;
  }
  if (activeStatus.value === UNRESOLVED_STATUS) {
    return UNRESOLVED_STATUS;
  }
  return activeAssigneeTab.value;
});
```

- [ ] **Step 3: Dodaj handler `updateListTab`**

Bezpośrednio po `updateAssigneeTab` (po l.629) dodaj:

```js
// KLIMABAZAR F-rozw: jeden wykluczajacy rzad – przypisanie LUB status
function updateListTab(selectedTab) {
  const isStatusTab =
    selectedTab === wootConstants.STATUS_TYPE.RESOLVED ||
    selectedTab === UNRESOLVED_STATUS;

  if (isStatusTab) {
    if (activeStatus.value === selectedTab) return;
    activeAssigneeTab.value = wootConstants.ASSIGNEE_TYPE.ALL;
    activeStatus.value = selectedTab;
    // sync dropdownu tylko dla statusu, ktory dropdown zna (unresolved nie istnieje w dropdownie)
    store.dispatch(
      'setChatStatusFilter',
      selectedTab === wootConstants.STATUS_TYPE.RESOLVED
        ? selectedTab
        : wootConstants.STATUS_TYPE.ALL
    );
    resetBulkActions();
    emitter.emit('clearSearchInput');
    resetAndFetchData();
    return;
  }

  // zakladka przypisania -> status musi byc ALL
  if (activeStatus.value !== wootConstants.STATUS_TYPE.ALL) {
    // wracamy z zawezonego statusu (zakladka statusu lub dropdown) -> reset
    activeStatus.value = wootConstants.STATUS_TYPE.ALL;
    store.dispatch('setChatStatusFilter', wootConstants.STATUS_TYPE.ALL);
    activeAssigneeTab.value = selectedTab;
    resetBulkActions();
    emitter.emit('clearSearchInput');
    resetAndFetchData();
    return;
  }

  // czysta zmiana przypisania (status juz ALL) -> natywne zachowanie z per-tab paginacja
  updateAssigneeTab(selectedTab);
}
```

- [ ] **Step 4: Odśwież liczniki w `resetAndFetchData` i emitterze**

W `resetAndFetchData` (l.589) na końcu funkcji, tuż przed zamykającym `}` (po `fetchConversations();` na l.602), dodaj:

```js
  fetchTabCounts(); // KLIMABAZAR F-rozw
```

W handlerze emittera `fetch_conversation_stats` (l.817-820) po `store.dispatch('conversationStats/get', ...)` dodaj:

```js
  fetchTabCounts(); // KLIMABAZAR F-rozw: odswiez liczniki zakladek po zmianie statusu rozmowy
```

- [ ] **Step 5: Podmień bind `ChatTypeTabs` w template**

W template (l.999-1005) zmień:

```html
    <ChatTypeTabs
      v-if="!hasAppliedFiltersOrActiveFolders"
      :items="listTabItems"
      :active-tab="activeListTab"
      is-compact
      @chat-tab-change="updateListTab"
    />
```

- [ ] **Step 6: Lint**

Run: `pnpm eslint app/javascript/dashboard/components/ChatList.vue`
Expected: brak błędów ani ostrzeżeń o nieużytych symbolach.

- [ ] **Step 7: Weryfikacja wizualna (lokalny Docker dev)**

Wejdź na `http://localhost:3001` → Rozmowy. Sprawdź:
1. Rząd zakładek: Wszystkie / Moje / Nieprzypisane / Rozwiązane / Nierozwiązane, każda z liczbą.
2. „Rozwiązane" → tylko rozwiązane; „Nierozwiązane" → reszta. `resolved + unresolved ≈ all`.
3. Kliknięcie zakładki statusu odznacza pozostałe; powrót na Wszystkie/Moje/Nieprzypisane wraca na status=ALL.
4. Wybór „Rozwiązane" w dropdownie statusu podświetla zakładkę „Rozwiązane".
5. Liczniki Moje/Nieprzypisane nie psują się po odwiedzeniu „Rozwiązane".

- [ ] **Step 8: Commit**

```bash
git commit -am "feat(klimabazar): F-rozw - 5 zakladek listy (przypisanie + status) z licznikami"
```

---

### Task 5: Rejestr w CUSTOMIZATIONS.md

**Files:**
- Modify: `CUSTOMIZATIONS.md` (tabela „Rejestr zmian") + `docs/klimabazar/BACKLOG.md`

- [ ] **Step 1: Dodaj wiersze do rejestru w `CUSTOMIZATIONS.md`**

Na końcu tabeli „Rejestr zmian" dodaj:

```markdown
| `app/finders/conversation_finder.rb` (F-rozw, **backend-fork: czulszy przy mergach**) | gałąź `status=unresolved` → `where.not(status: :resolved)`; obsługuje listę i meta-licznik (wspólny finder) | F-rozw: zakładka „Nierozwiązane" = wszystko poza resolved | średnia (finder bywa zmieniany) — grep `KLIMABAZAR F-rozw` | konsola: `ConversationFinder` z `status:'unresolved'` zwraca `count` = liczba ≠ resolved; `resolved + unresolved == all` |
| `ChatList.vue` (F-rozw) | rząd 5 zakładek: Wszystkie/Moje/Nieprzypisane (status=all) + Rozwiązane/Nierozwiązane (assignee=all), wykluczające; `listTabItems`/`activeListTab`/`updateListTab`; liczniki niezależne `fetchTabCounts` (3× `meta`) zamiast singletona `conversationStats` dla badge'y | F-rozw: szybki dostęp do rozwiązanych i nierozwiązanych z poziomu rzędu zakładek | średnia (rząd zakładek + handler) — grep `KLIMABAZAR F-rozw` | rząd ma 5 zakładek z liczbami; status wykluczający; dropdown synchronizuje podświetlenie |
| `i18n/locale/{en,pl}/chatlist.json` (F-rozw) | klucze `ASSIGNEE_TYPE_TABS.resolved`/`.unresolved` | F-rozw: etykiety nowych zakładek | niska | „Rozwiązane"/„Nierozwiązane" w rzędzie zakładek |
```

- [ ] **Step 2: Dodaj wiersz do tabeli w `BACKLOG.md`**

W sekcji „Tabela" dodaj wiersz:

```markdown
| **F-rozw** | ✅ **ZROBIONE** — Zakładki „Rozwiązane"/„Nierozwiązane" w rzędzie listy (obok Wszystkie/Moje/Nieprzypisane), z licznikiem rozmów | Fork — front (Vue) + 1 linia backendu | średnie (rząd zakładek `ChatList`) | Spec/plan: `F-rozw-resolved-tabs-*.md` |
```

- [ ] **Step 3: Commit**

```bash
git commit -am "docs(klimabazar): F-rozw - rejestr CUSTOMIZATIONS.md + BACKLOG"
```

---

## Self-Review (po napisaniu)

- **Pokrycie specu:** finder unresolved (Task 1) ✓; 5 zakładek + handler + podświetlenie (Task 4) ✓; niezależne liczniki (Task 3) ✓; dropdown zostaje + sync (Task 4, `setChatStatusFilter`) ✓; i18n en+pl (Task 2) ✓; rejestr (Task 5) ✓.
- **Brak persystencji statusowej zakładki:** `updateListTab` ustawia `activeStatus` lokalnie, nie zapisuje do `ui_settings` (brak wywołania `saveSelectedFilter`/zapisu preferencji) → po ponownym wejściu landing = F6 ALL. ✓
- **Spójność nazw:** `fetchTabCounts`, `tabCounts`, `listTabItems`, `activeListTab`, `updateListTab`, `UNRESOLVED_STATUS` — używane jednolicie we wszystkich taskach. Klucze licznika (`mineCount`/`unAssignedCount`/`allCount`) zgodne z `countKey` z `ASSIGNEE_TYPE_TAB_PERMISSIONS` (te same, których używał `conversationStats`). ✓
- **Kształt odpowiedzi meta:** `response.data.meta.{mine_count,unassigned_count,all_count}` — zgodny z `meta.json.jbuilder`. ✓
- **Brak placeholderów:** każdy krok ma realny kod/komendę. ✓
