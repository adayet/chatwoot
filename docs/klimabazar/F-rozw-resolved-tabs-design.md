# F-rozw — Pozycje „Rozwiązane" i „Nierozwiązane" w nawigacji Rozmów

**Data:** 2026-06-15 · **Marker:** `KLIMABAZAR F-rozw` · **Warstwa:** fork frontu (Vue) + 1 linia backendu

## Cel biznesowy (słowa właściciela)
> „Brakuje mi jeszcze w Rozmowach zakładki »Rozwiązane« (oznaczone jako rozwiązane) oraz »Nierozwiązane« (wszystkie poza rozwiązanymi)."

Dwie nowe, stałe pozycje w lewej nawigacji rozmów — obok „Wszystkie / Wzmianki / Udział / Bez odpowiedzi" — każda z **licznikiem rozmów** (badge). Szybki dostęp do rozwiązanych i nierozwiązanych bez grzebania w dropdownie statusu.

## Ustalenia (brainstorming 2026-06-15)
- **Forma:** pozycje w lewym sidebarze pod „Rozmowy" (dzieci pozycji `Conversation`), nie przełącznik nad listą.
- **Badge:** liczba **rozmów** w danym widoku (np. Rozwiązane: 51, Nierozwiązane: 281).
- **„Nierozwiązane" = wszystko oprócz rozwiązanych** (open + pending + snoozed). Na prod efektywnie = open (0 pending/snoozed), ale semantyka „nie-resolved".
- **Układ:** dodać obok obecnych podzakładek (nie zastępować Wzmianki/Udział/Bez odpowiedzi).
- **Status zablokowany:** na tych widokach dropdown statusu ukryty, status na stałe = widok. Zakładki przypisania (Wszystkie/Moje/Nieprzypisane) i sort (F9) zostają aktywne — „Moje rozwiązane" ma sens.

## Stan zastany (zweryfikowany w v4.14.1)
- Pozycje nawigacji: `Sidebar.vue:296` — dzieci `Conversation` to wpisy `{ name, label, to, activeOn }` prowadzące przez trasy do `ConversationView` → `ChatList`.
- Trasy: `routes/dashboard/conversation/conversation.routes.js` — wzorzec `conversation_mentions` / `conversation_unattended` / `conversation_participating` (+ warianty `…_through_…` dla otwartej rozmowy), props `{ conversationType }`.
- Filtr statusu (backend): `ConversationFinder#filter_by_status` (`app/finders/conversation_finder.rb:163`) — `'all'` = bez filtra, inaczej `where(status: …)`. **Brak „nierozwiązane".** Status **nie** jest walidowany allowlistą.
- Enterprise nadpisuje finder tylko w `conversations_base_query` (SLA) — gałąź `unresolved` w OSS bezpieczna.
- Liczniki: endpoint `meta` (`conversations_controller#meta` → `perform_meta_only`) zwraca `all_count` dla danego filtra; **ten sam finder** liczy listę i meta. Frontowy `ConversationApi.meta({status})` to lekki strzał (store `conversationStats` używa go dla bieżącego filtra — singleton).
- Dropdown statusu: `ChatListHeader.vue:157` → `ConversationBasicFilter.vue` — osobne sekcje status (l.~170) i sort (l.~182).

## Architektura zmiany

### 1. Backend — obsługa `status=unresolved` (1 linia, marker `KLIMABAZAR F-rozw`)
`app/finders/conversation_finder.rb`, `filter_by_status`:
```ruby
def filter_by_status
  return if params[:status] == 'all'
  return @conversations = @conversations.where.not(status: :resolved) if params[:status] == 'unresolved' # KLIMABAZAR F-rozw
  @conversations = @conversations.where(status: params[:status] || DEFAULT_STATUS)
end
```
Obsługuje **i listę, i meta-licznik** (wspólny finder). „resolved" jest natywny — bez zmian backendu dla niego.

### 2. Trasy — nowe widoki (marker `KLIMABAZAR F-rozw`)
`conversation.routes.js`: 4 trasy wzorowane na unattended:
- `conversation_resolved` → `props: () => ({ status: 'resolved' })`
- `conversation_through_resolved` → `{ status: 'resolved', conversationId }`
- `conversation_unresolved` → `props: () => ({ status: 'unresolved' })`
- `conversation_through_unresolved` → `{ status: 'unresolved', conversationId }`

Ścieżki: `accounts/:accountId/resolved/conversations[/:conversationId]`, analogicznie `unresolved`.

### 3. `ChatList` — honorowanie wymuszonego statusu
`ChatList.vue`: nowy props `status` (string, opcjonalny). Gdy obecny:
- `activeStatus` ustawiany z propsa i **nie** czytany z zapisanej preferencji F6 (props wygrywa); **nie** persystowany do `ui_settings` (nie zmienia globalnego defaultu).
- przekazanie do `ChatListHeader` flagi `lockStatus = !!props.status`, by ukryć sekcję statusu w `ConversationBasicFilter` (sort zostaje).
- watcher na zmianę propsa (przejście resolved↔unresolved bez remountu) → reset listy i refetch.

### 4. `ConversationBasicFilter` — ukrycie sekcji statusu
Nowy props `lockStatus` (domyślnie false). Gdy true — sekcja statusu (l.~170) nierenderowana, sort (F9) bez zmian.

### 5. Sidebar — dwie pozycje + liczniki
`Sidebar.vue`, dzieci `Conversation`, po „Unattended":
```js
{ name: 'Resolved',   label: t('SIDEBAR.RESOLVED_CONVERSATIONS'),
  activeOn: ['conversation_through_resolved'],
  to: accountScopedRoute('conversation_resolved'),   count: <licznik resolved> },
{ name: 'Unresolved', label: t('SIDEBAR.UNRESOLVED_CONVERSATIONS'),
  activeOn: ['conversation_through_unresolved'],
  to: accountScopedRoute('conversation_unresolved'), count: <licznik unresolved> },
```
(Respektuje istniejący filtr `KLIMABAZAR_HIDDEN_SIDEBAR` z F3 — nowe pozycje nie są na liście ukrytych.)

### 6. Liczniki (count-fetch) — mały dedykowany mechanizm
`conversationStats` to singleton (jeden zestaw dla bieżącego filtra) — nie utrzyma dwóch stałych badge'ów. Dodać lekki fetch obok niego:
- w `Sidebar.vue` (lub mały composable `useResolvedCounts`) na montażu i przy zmianie `accountId`: `ConversationApi.meta({ status: 'resolved' })` i `({ status: 'unresolved' })`, oba `all_count` → reaktywne `resolvedCount` / `unresolvedCount` podawane jako `count` do pozycji.
- MVP: bez live-push (lekka nieświeżość akceptowalna, jak przy unread counts). Odświeżenie na montażu sidebara + zmianie konta.

### 7. i18n
`SIDEBAR.RESOLVED_CONVERSATIONS` / `SIDEBAR.UNRESOLVED_CONVERSATIONS` — w `en.json` (zgodnie z regułą tłumaczeń: tylko `en`) **oraz** w `pl/*.json` (fork jest właścicielem `pl` — patrz rejestr i18n pl w CUSTOMIZATIONS.md).
- pl: „Rozwiązane" / „Nierozwiązane". en: „Resolved" / „Unresolved".

## Pliki (rejestr do CUSTOMIZATIONS.md)
| Plik | Zmiana | Kruchość |
|---|---|---|
| `app/finders/conversation_finder.rb` | gałąź `unresolved` → `where.not(status: :resolved)` | średnia (backend-fork) |
| `conversation.routes.js` | 4 trasy resolved/unresolved | niska |
| `ChatList.vue` | props `status` (forced, niepersystowany) + `lockStatus` do nagłówka | średnia |
| `ChatListHeader.vue` | przekazanie `lockStatus` do BasicFilter | niska |
| `ConversationBasicFilter.vue` | props `lockStatus` ukrywa sekcję statusu | niska |
| `Sidebar.vue` | 2 pozycje + liczniki (fetch meta) | średnia |
| `i18n {en,pl} sidebar` | 2 klucze etykiet | niska |

## Poza zakresem (YAGNI)
- Live-push liczników przez websocket (akceptujemy nieświeżość; jak unread counts).
- Blokada zakładek przypisania (zostają aktywne — feature, nie bug).
- Liczniki dla pozostałych pozycji (Wszystkie/Wzmianki/…) — nie objęte prośbą.

## Jak zweryfikować
1. Sidebar „Rozmowy" pokazuje „Rozwiązane" i „Nierozwiązane" pod „Bez odpowiedzi", każda z liczbą.
2. „Rozwiązane" → lista tylko `resolved`; suma = badge. „Nierozwiązane" → lista bez `resolved` (open+pending+snoozed); suma = badge. Razem ≈ wszystkie rozmowy.
3. Na obu widokach dropdown statusu schowany; sort (F9) i zakładki przypisania działają („Moje rozwiązane" filtruje poprawnie).
4. Otwarcie rozmowy z widoku zachowuje aktywną pozycję w nawigacji (trasa `…_through_…`).
5. Etykiety po polsku.
