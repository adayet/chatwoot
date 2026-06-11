# F9 — Domyślne sortowanie po ostatniej wiadomości — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lista rozmów sortuje się domyślnie po czasie ostatniej realnej wiadomości w wątku (incoming/outgoing, bez aktywności i notatek prywatnych), z opcją wybieralną w menu sortowania; wymuszone na wszystkich użytkownikach.

**Architecture:** Backend dodaje scope `sort_on_last_message_at` (podzapytanie `MAX(created_at)` wiadomości chat) i ustawia go domyślnym w `ConversationFinder`. Front dodaje stałą, komparator (po `last_chat_message_at` z F8), nowe domyślne i pozycję w dropdownie + i18n. Przy deployu jednorazowy reset zapisanego sortu w `ui_settings`.

**Tech Stack:** Rails (concern scope, Arel SQL), Vue 3, vue-i18n. Specy pomijamy (CLAUDE.md); weryfikacja = rubocop/eslint + konsola/UI na devie (`http://localhost:3001`).

**Spec:** [F9-sort-last-message-design.md](F9-sort-last-message-design.md).

---

## Mapa plików
- Modify: `app/models/concerns/sort_handler.rb` — scope `sort_on_last_message_at`.
- Modify: `app/finders/conversation_finder.rb` — SORT_OPTIONS + domyślny.
- Modify: `app/javascript/dashboard/constants/globals.js` — `SORT_BY_TYPE`.
- Modify: `app/javascript/dashboard/store/modules/conversations/helpers.js` — komparator + SORT_OPTIONS + fallback.
- Modify: `app/javascript/dashboard/components/ChatList.vue` — domyślne (l.79, l.401).
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationBasicFilter.vue` — domyślny (l.37) + opcje dropdowna.
- Modify: `app/javascript/dashboard/i18n/locale/en/chatlist.json` + `pl/chatlist.json` — etykiety.
- Modify: `CUSTOMIZATIONS.md`, `docs/klimabazar/BACKLOG.md`.

Uwaga dev: Ruby przez `docker compose exec -T rails ...`; front przez Vite HMR (odśwież listę po zmianie backendu/store).

---

### Task 1: Backend — scope + domyślny sort

**Files:**
- Modify: `app/models/concerns/sort_handler.rb`
- Modify: `app/finders/conversation_finder.rb`

- [ ] **Step 1: Dodaj scope `sort_on_last_message_at`** w `sort_handler.rb` (w bloku `class_methods do`, po `sort_on_waiting_since`)

```ruby
    # KLIMABAZAR F9: sortowanie po ostatniej realnej wiadomosci (chat = bez aktywnosci i notatek prywatnych)
    def sort_on_last_message_at(sort_direction = :desc)
      order(generate_sql_query(
              '(SELECT MAX(messages.created_at) FROM messages ' \
              'WHERE messages.conversation_id = conversations.id ' \
              'AND messages.message_type <> 2 AND messages.private = false) ' \
              "#{sort_direction.to_s.upcase} NULLS LAST, conversations.last_activity_at DESC"
            ))
    end
```

> `message_type <> 2` = nie-activity (incoming/outgoing/template), `private = false` — zgodne ze scope `Message.chat` i polem `last_chat_message_at` (F8). `sort_direction` pochodzi z `SORT_OPTIONS` (zawsze `asc`/`desc`), jak w pozostałych scope'ach.

- [ ] **Step 2: Dodaj opcje i zmień domyślny** w `conversation_finder.rb`

W `SORT_OPTIONS`, po linii `'priority_desc_created_at_asc' => %w[sort_on_priority_created_at desc],` dodaj:
```ruby
    'last_message_at_asc' => %w[sort_on_last_message_at asc], # KLIMABAZAR F9
    'last_message_at_desc' => %w[sort_on_last_message_at desc], # KLIMABAZAR F9
```

W metodzie `conversations` zmień domyślny fallback:
```ruby
    sort_by, sort_order = SORT_OPTIONS[params[:sort_by]] || SORT_OPTIONS['last_message_at_desc'] # KLIMABAZAR F9
```

- [ ] **Step 3: Weryfikacja w konsoli (dev)**

Run:
```bash
docker compose exec -T rails bundle exec rails runner "acc=Account.first; ids=acc.conversations.sort_on_last_message_at(:desc).limit(5).pluck(:id); puts 'sort_on_last_message_at OK ids=' + ids.inspect; f=ConversationFinder.new(acc.users.first, { assignee_type: 'all', status: 'open' }); puts 'finder domyslny dziala, liczba=' + f.perform[:conversations].size.to_s" 2>&1 | grep -E "sort_on_last_message_at OK|finder domyslny"
```
Expected: scope zwraca id-ki bez błędu SQL; finder z domyślnym sortem zwraca listę.

- [ ] **Step 4: Lint + Commit**

```bash
docker compose exec -T rails bundle exec rubocop -a app/models/concerns/sort_handler.rb app/finders/conversation_finder.rb
git commit -am "feat(klimabazar): F9 backend - sort_on_last_message_at + domyslny sort listy"
```

---

### Task 2: Front — stała + komparator + domyślne + dropdown

**Files:**
- Modify: `app/javascript/dashboard/constants/globals.js`
- Modify: `app/javascript/dashboard/store/modules/conversations/helpers.js`
- Modify: `app/javascript/dashboard/components/ChatList.vue`
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationBasicFilter.vue`

- [ ] **Step 1: `globals.js` — dodaj typy** (w `SORT_BY_TYPE`, po `PRIORITY_DESC_CREATED_AT_ASC`)

```js
    PRIORITY_DESC_CREATED_AT_ASC: 'priority_desc_created_at_asc',
    LAST_MESSAGE_AT_ASC: 'last_message_at_asc', // KLIMABAZAR F9
    LAST_MESSAGE_AT_DESC: 'last_message_at_desc', // KLIMABAZAR F9
```

- [ ] **Step 2: `helpers.js` — SORT_OPTIONS + komparator + fallback**

W `SORT_OPTIONS` (po `priority_desc_created_at_asc`):
```js
  priority_desc_created_at_asc: ['sortOnPriorityCreatedAt', 'desc'],
  last_message_at_asc: ['sortOnLastMessageAt', 'asc'], // KLIMABAZAR F9
  last_message_at_desc: ['sortOnLastMessageAt', 'desc'], // KLIMABAZAR F9
```

W `sortConfig` dodaj komparator (po `sortOnLastActivityAt`):
```js
  // KLIMABAZAR F9: sort po ostatniej realnej wiadomosci (pole z F8); brak wiadomosci -> na dol
  sortOnLastMessageAt: (a, b, sortDirection) => {
    const av = a.last_chat_message_at || 0;
    const bv = b.last_chat_message_at || 0;
    if (!av || !bv) return (bv ? 1 : 0) - (av ? 1 : 0);
    return getSortOrderFunction(sortDirection)(av, bv);
  },
```

W `sortComparator` zmień fallback:
```js
  const [sortMethod, sortDirection] =
    SORT_OPTIONS[sortKey] || SORT_OPTIONS.last_message_at_desc; // KLIMABAZAR F9
```

- [ ] **Step 3: `ChatList.vue` — domyślne**

Linia 79:
```js
const activeSortBy = ref(wootConstants.SORT_BY_TYPE.LAST_MESSAGE_AT_DESC); // KLIMABAZAR F9
```
W `setFiltersFromUISettings` (fallback, ~l.401) zamień `LAST_ACTIVITY_AT_DESC` na:
```js
    : wootConstants.SORT_BY_TYPE.LAST_MESSAGE_AT_DESC; // KLIMABAZAR F9
```

- [ ] **Step 4: `ConversationBasicFilter.vue` — domyślny + opcje**

Linia ~37 (fallback): zamień `wootConstants.SORT_BY_TYPE.LAST_ACTIVITY_AT_DESC` na `wootConstants.SORT_BY_TYPE.LAST_MESSAGE_AT_DESC` (// KLIMABAZAR F9).

W liście opcji sortu (`chatSortOptions`, tam gdzie zaczynają się pozycje `last_activity_at_*`) dodaj na początku:
```js
    {
      label: t('CHAT_LIST.SORT_ORDER_ITEMS.last_message_at_desc.TEXT'),
      value: 'last_message_at_desc',
    },
    {
      label: t('CHAT_LIST.SORT_ORDER_ITEMS.last_message_at_asc.TEXT'),
      value: 'last_message_at_asc',
    },
```

- [ ] **Step 5: Lint + Commit**

```bash
docker compose exec -T vite pnpm exec eslint --fix app/javascript/dashboard/constants/globals.js app/javascript/dashboard/store/modules/conversations/helpers.js app/javascript/dashboard/components/ChatList.vue app/javascript/dashboard/components/widgets/conversation/ConversationBasicFilter.vue
git commit -am "feat(klimabazar): F9 front - sort po ostatniej wiadomosci (domyslny + dropdown)"
```

---

### Task 3: i18n etykiety sortu

**Files:**
- Modify: `app/javascript/dashboard/i18n/locale/en/chatlist.json`
- Modify: `app/javascript/dashboard/i18n/locale/pl/chatlist.json`

- [ ] **Step 1: Dodaj klucze** w obu plikach, w obiekcie `CHAT_LIST.SORT_ORDER_ITEMS` (obok `last_activity_at_desc`)

en (`en/chatlist.json`):
```json
      "last_message_at_desc": { "TEXT": "Last message: Newest first" },
      "last_message_at_asc": { "TEXT": "Last message: Oldest first" },
```
pl (`pl/chatlist.json`):
```json
      "last_message_at_desc": { "TEXT": "Ostatnia wiadomość: od najnowszych" },
      "last_message_at_asc": { "TEXT": "Ostatnia wiadomość: od najstarszych" },
```

> Wstaw jako prawidłowy JSON (przecinki!). Struktura jak istniejące `last_activity_at_desc: { "TEXT": ... }`.

- [ ] **Step 2: Walidacja JSON + parytet pl**

Run:
```bash
python3 -c "import json; json.load(open('app/javascript/dashboard/i18n/locale/en/chatlist.json')); json.load(open('app/javascript/dashboard/i18n/locale/pl/chatlist.json')); print('JSON OK')"
python3 scripts/klimabazar/check_i18n_pl.py chatlist.json
```
Expected: `JSON OK` oraz `OK` (pl ma oba nowe klucze, brak braków).

- [ ] **Step 3: Commit**

```bash
git commit -am "i18n(klimabazar): F9 etykiety sortu - ostatnia wiadomosc (en+pl)"
```

---

### Task 4: Weryfikacja na devie + rejestr

**Files:**
- Modify: `CUSTOMIZATIONS.md`, `docs/klimabazar/BACKLOG.md`

- [ ] **Step 1: Test backendu — kolejność reaguje na wiadomość, nie na aktywność**

Run:
```bash
docker compose exec -T rails bundle exec rails runner "
acc=Account.first
top=acc.conversations.sort_on_last_message_at(:desc).first
puts 'top przed: display_id=' + top.display_id.to_s
other=acc.conversations.where.not(id: top.id).sort_on_last_message_at(:desc).first
other.update!(assignee: acc.users.first) # aktywnosc, nie wiadomosc
again=acc.conversations.sort_on_last_message_at(:desc).first
puts 'top po przypisaniu innej: display_id=' + again.display_id.to_s + ' (== przed = OK)'
" 2>&1 | grep "top "
```
Expected: top się NIE zmienia po samym przypisaniu (aktywność nie wpływa na sort).

- [ ] **Step 2: UI (`http://localhost:3001`)**

Twardy refresh listy. Sprawdź: domyślny sort to „Ostatnia wiadomość: od najnowszych" (menu sortowania), rozmowa z nową notatką/przypisaniem NIE wskakuje na górę, a nowa realna wiadomość — tak. Opcja widoczna i wybieralna w dropdownie.

- [ ] **Step 3: Wpisy do `CUSTOMIZATIONS.md`** (tabela „Rejestr zmian")

```markdown
| `app/models/concerns/sort_handler.rb` + `app/finders/conversation_finder.rb` (F9, **backend-fork: czulszy przy mergach**) | scope `sort_on_last_message_at` (MAX(created_at) wiadomości chat, NULLS LAST) + nowy **domyślny** sort listy = `last_message_at_desc` | F9: lista domyślnie po ostatniej realnej wiadomości, nie po `last_activity_at` | średnia (finder/sort bywają zmieniane) | konsola: scope sortuje, finder default; aktywność nie zmienia kolejności |
| `globals.js` + `helpers.js` + `ChatList.vue` + `ConversationBasicFilter.vue` (F9) | `SORT_BY_TYPE.LAST_MESSAGE_AT_*` + komparator po `last_chat_message_at` (F8) + nowe domyślne + pozycja w dropdownie sortu | F9: front spójny z backendem (live-update + wybór) | średnia (kilka plików) | dropdown ma „Ostatnia wiadomość"; domyślnie aktywny |
| `i18n chatlist.json` en+pl (F9) | etykiety `SORT_ORDER_ITEMS.last_message_at_desc/asc` | F9: nazwa opcji sortu | niska | etykieta w menu po polsku |
```

- [ ] **Step 4: Backlog F9** — dopisz wiersz do `docs/klimabazar/BACKLOG.md` (F9 = domyślny sort po ostatniej wiadomości; fork backend+front; status „zrobione, czeka na deploy").

- [ ] **Step 5: Commit**

```bash
git commit -am "docs(klimabazar): F9 rejestr + backlog"
```

---

### Task 5: Wymuszenie na wszystkich (krok deployu, jednorazowo)

**Files:** brak (operacja na prod po deployu).

- [ ] **Step 1: Po deployu — reset zapisanego sortu w `ui_settings`** (na prod)

Run (na serwerze prod, w konsoli rails):
```ruby
User.find_each do |u|
  s = u.ui_settings || {}
  filt = s['conversations_filter_by']
  next unless filt.is_a?(Hash) && filt.key?('order_by')
  filt.delete('order_by')
  u.update_column(:ui_settings, s)
end
```
Expected: zapisane preferencje sortu wyczyszczone → wszyscy lądują na nowym domyślnym; dalej mogą wybrać własny z dropdowna (zapisze się normalnie).

> Uruchamiać po deployu nowego obrazu. Na devie można przetestować tę samą komendę przed prod.

---

## Po wdrożeniu
- Backend+front → na prod przez build CI (`git push` → `-R adayet/chatwoot`) + deploy (sygnał właściciela). **Brak migracji.**
- Po deployu: wykonać Task 5 (reset `ui_settings`) + weryfikacja kolejności listy.
- Synchronizacja: definicja „realnej wiadomości" = `message_type <> 2 AND private = false` (spójna z `Message.chat` i `last_chat_message_at` z F8).

## Opcjonalnie (poza zakresem)
- Zdenormalizowana kolumna `last_message_at` + migracja/callback (wydajność przy dużym wzroście).
