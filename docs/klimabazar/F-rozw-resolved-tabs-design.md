# F-rozw — Zakładki „Rozwiązane" i „Nierozwiązane" w rzędzie zakładek listy

**Data:** 2026-06-15 · **Marker:** `KLIMABAZAR F-rozw` · **Warstwa:** fork frontu (Vue) + 1 linia backendu

## Cel biznesowy (słowa właściciela)
> „Brakuje mi jeszcze w Rozmowach zakładki »Rozwiązane« (oznaczone jako rozwiązane) oraz »Nierozwiązane« (wszystkie poza rozwiązanymi)."
> „…w zakładkach obok »Wszystkie«, »Moje«, »Nieprzypisane« też dodaj."

Dwie nowe zakładki w **poziomym rzędzie nad listą** (ten sam co Wszystkie/Moje/Nieprzypisane, F1), z licznikiem rozmów. Jeden rząd, wybór wykluczający.

## Ustalenia (brainstorming 2026-06-15)
- **Lokalizacja:** TYLKO poziomy rząd zakładek (`ChatTypeTabs`). Bez lewego sidebara, bez nowych tras.
- **Wybór wykluczający:** jeden rząd, 5 zakładek — Wszystkie / Moje / Nieprzypisane / Rozwiązane / Nierozwiązane. Kliknięcie jednej zastępuje pozostałe (nie da się „Moje + Rozwiązane" z poziomu rzędu).
- **Badge:** liczba **rozmów** w danej zakładce.
- **„Nierozwiązane" = wszystko oprócz rozwiązanych** (open + pending + snoozed). Na prod ≈ open (0 pending/snoozed).
- **Dropdown statusu zostaje** w nagłówku; wybór statusu synchronizuje podświetlenie zakładki, gdy pasuje.

## Mapowanie zakładek na filtr (oś przypisania × oś statusu)
Rząd łączy dwie osie w jeden wykluczający wybór:

| Zakładka | `assigneeType` | `status` |
|---|---|---|
| Wszystkie | all | all |
| Moje | me | all |
| Nieprzypisane | unassigned | all |
| **Rozwiązane** | all | **resolved** |
| **Nierozwiązane** | all | **unresolved** |

Czyli zakładki przypisania działają na „wszystkie statusy" (zgodnie z domyślnym F6=ALL), a zakładki statusu na „wszyscy przypisani".

## Stan zastany (zweryfikowany w v4.14.1)
- `ChatList.vue:258` `conversationFilters` — params z osobnych refów `activeAssigneeTab` (`ChatList.vue:78`) + `activeStatus` (`ChatList.vue:80`).
- `ChatList.vue:182` `assigneeTabItems` — buduje zakładki (key/name/count), liczniki z singletona `conversationStats.value[countKey]` (`mineCount`/`unAssignedCount`/`allCount`).
- `ChatList.vue:620` `updateAssigneeTab` — zmiana zakładki przypisania (per-tab paginacja, bez resetu); `ChatList.vue:631` `onBasicFilterChange` — zmiana statusu/sortu z dropdownu → `resetAndFetchData`.
- `ChatTypeTabs` renderowany przy `!hasAppliedFiltersOrActiveFolders` (`ChatList.vue:999`), `@chat-tab-change="updateAssigneeTab"`. Komponent generyczny (items: key/name/count) — bez zmian.
- Liczniki: `conversationStats` store fetchuje `ConversationApi.meta(params)` dla **bieżącego** filtra (singleton) — daje mine/unassigned/all dla jednego statusu.
- Backend: `ConversationFinder#filter_by_status` (`app/finders/conversation_finder.rb:163`) — `'all'`=bez filtra, inaczej `where(status: …)`. **Brak „unresolved".** Status nie jest walidowany allowlistą. Endpoint `meta` (`perform_meta_only`) używa tego samego findera → poprawka findera obsłuży i listę, i licznik.
- Enterprise nadpisuje finder tylko w `conversations_base_query` (SLA) — gałąź `unresolved` w OSS bezpieczna.

## Architektura zmiany

### 1. Backend — obsługa `status=unresolved` (1 linia, `KLIMABAZAR F-rozw`)
`app/finders/conversation_finder.rb`, `filter_by_status`:
```ruby
def filter_by_status
  return if params[:status] == 'all'
  return @conversations = @conversations.where.not(status: :resolved) if params[:status] == 'unresolved' # KLIMABAZAR F-rozw
  @conversations = @conversations.where(status: params[:status] || DEFAULT_STATUS)
end
```
Obsługuje listę i meta-licznik (wspólny finder). „resolved" jest natywny.

### 2. `ChatList` — model 5 zakładek (jeden wykluczający rząd)
- **Stałe:** `STATUS_TAB_KEYS = { RESOLVED: 'resolved', UNRESOLVED: 'unresolved' }`.
- **`activeTab` (computed)** — która zakładka podświetlona:
  - `activeStatus === 'resolved'` → `'resolved'`
  - `activeStatus === 'unresolved'` → `'unresolved'`
  - w przeciwnym razie → `activeAssigneeTab` (all/me/unassigned). Statusy spoza zakładek (open/pending/snoozed z dropdownu) → podświetlona zakładka przypisania.
- **`listTabItems` (computed)** — `assigneeTabItems` + dwie pozycje statusu na końcu:
  - `{ key:'resolved', name: t('CHAT_LIST.ASSIGNEE_TYPE_TABS.resolved'), count: resolvedCount }`
  - `{ key:'unresolved', name: t('CHAT_LIST.ASSIGNEE_TYPE_TABS.unresolved'), count: unresolvedCount }`
- **`updateListTab(key)` (nowy handler)** zastępuje `updateAssigneeTab` w bindzie:
  - `key ∈ {all,me,unassigned}` → `activeStatus='all'`, deleguje do dotychczasowej logiki przypisania (`updateAssigneeTab(key)`).
  - `key==='resolved'` → `activeAssigneeTab='all'`, `activeStatus='resolved'`, `resetAndFetchData()`.
  - `key==='unresolved'` → `activeAssigneeTab='all'`, `activeStatus='unresolved'`, `resetAndFetchData()`.
  - Dla resolved synchronizacja dropdownu: `dispatch('setChatStatusFilter','resolved')`. Dla unresolved **bez** sync (dropdown nie ma tej opcji — kosmetyka; `conversationFilters` czyta lokalny `activeStatus`, nie store).
  - Wybór statusowej zakładki **nie** jest persystowany do `ui_settings` (po ponownym wejściu landing = F6 ALL/Wszystkie).
- Template: `<ChatTypeTabs :items="listTabItems" :active-tab="activeTab" @chat-tab-change="updateListTab" />`.

### 3. Liczniki zakładek — niezależny fetch (zastępuje singleton dla badge'y)
`conversationStats` jest singletonem dla bieżącego statusu → na widoku „Rozwiązane" (status=resolved) liczniki Moje/Nieprzypisane pokazałyby resolved-scoped. Dlatego liczniki zakładek liczymy niezależnie od wyboru:
- `fetchTabCounts()` — 3 lekkie `ConversationApi.meta(params)` ze scope bieżącego kontekstu (inboxId/labels/teamId z `conversationFilters`):
  - `meta({status:'all'})` → `mineCount`/`unAssignedCount`/`allCount` (Wszystkie/Moje/Nieprzypisane),
  - `meta({status:'resolved'})` → `all_count` → `resolvedCount`,
  - `meta({status:'unresolved'})` → `all_count` → `unresolvedCount`.
- Wołane: na montażu i po każdym fetchu listy (debounce jak w `conversationStats`). `listTabItems` czyta z tych reaktywnych liczników (nie z `conversationStats`).
- Scope: meta uwzględnia inbox/label/team, by liczby zgadzały się z widzianym kontekstem.

### 4. i18n
`CHAT_LIST.ASSIGNEE_TYPE_TABS.resolved` / `.unresolved` w `en.json` (reguła: tylko `en`) oraz `pl/chatlist.json` (fork jest właścicielem `pl`).
- pl: „Rozwiązane" / „Nierozwiązane". en: „Resolved" / „Unresolved".

## Pliki (rejestr do CUSTOMIZATIONS.md)
| Plik | Zmiana | Kruchość |
|---|---|---|
| `app/finders/conversation_finder.rb` | gałąź `unresolved` → `where.not(status: :resolved)` | średnia (backend-fork, czulszy przy mergach) |
| `ChatList.vue` | `activeTab`/`listTabItems`/`updateListTab` (5 zakładek), `fetchTabCounts` (3× meta), bind `ChatTypeTabs` | średnia |
| `i18n {en,pl} chatlist` | 2 klucze `ASSIGNEE_TYPE_TABS.resolved/unresolved` | niska |

## Decyzje i kompromisy (MVP)
- **Paginacja:** zmiana na zakładkę statusu idzie przez `resetAndFetchData` (reset stron) — spójne z dotychczasowym zachowaniem zmiany statusu z dropdownu (też resetuje). Per-tab persystencja stron dotyczy tylko zakładek przypisania (bez zmian).
- **`activeAssigneeTabCount`** (heurystyka paginacji, `ChatList.vue:231`) liczy po `activeAssigneeTab`; na zakładkach statusu = licznik „all". Akceptowalne (to tylko optymalizacja pokazania strony 1).
- **Świeżość liczników:** odświeżane na montażu i po fetchu listy; brak osobnego live-push przez websocket (rozwiązanie/reopen i tak wywołują refetch listy → liczniki się odświeżą).

## Poza zakresem (YAGNI)
- Lewy sidebar / nowe trasy (porzucone — była pierwsza wersja specu).
- Łączenie „Moje + Rozwiązane" z poziomu rzędu (wybór wykluczający — świadoma decyzja właściciela). Nadal osiągalne filtrem zaawansowanym.
- Ukrywanie/blokada dropdownu statusu (zostaje aktywny).

## Jak zweryfikować
1. Rząd zakładek pokazuje 5 pozycji: Wszystkie / Moje / Nieprzypisane / Rozwiązane / Nierozwiązane, każda z liczbą.
2. „Rozwiązane" → lista tylko `resolved`; „Nierozwiązane" → lista bez `resolved` (open+pending+snoozed). Liczby zgodne z badge'ami; resolved + unresolved ≈ wszystkie.
3. Kliknięcie zakładki statusu zeruje pozostałe podświetlenia (wykluczające); kliknięcie Wszystkie/Moje/Nieprzypisane wraca na status=ALL.
4. Wybór „Rozwiązane" w dropdownie statusu podświetla zakładkę „Rozwiązane" (sync).
5. Liczniki Moje/Nieprzypisane pozostają poprawne (status=all) także po odwiedzeniu „Rozwiązane" (niezależny fetch).
6. Etykiety po polsku.
