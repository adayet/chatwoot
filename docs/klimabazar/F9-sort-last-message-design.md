# F9 — Domyślne sortowanie listy po ostatniej wiadomości — Design

Status: zatwierdzony 2026-06-11. Następny krok: plan implementacji (writing-plans).

## Cel

Lista rozmów ma domyślnie sortować się po **ostatniej realnej wiadomości w wątku** (przychodzącej lub wychodzącej), a nie po `last_activity_at` (które skacze przy aktywności typu przypisanie agenta, zmiana statusu czy notatka prywatna). Nowy sort jest domyślny dla wszystkich i wybieralny z menu sortowania.

## Definicja „ostatniej wiadomości"

`MAX(created_at)` wiadomości w scope `Message.chat` = `where.not(message_type: :activity).where(private: false)` — czyli incoming/outgoing, bez zdarzeń systemowych i bez notatek prywatnych. Spójne z polem `last_chat_message_at` dodanym w F8 (serializer listy).

## Stan obecny (z kodu)

- Sortowanie w dwóch warstwach:
  - **Backend:** `app/finders/conversation_finder.rb` (`SORT_OPTIONS`, domyślny `last_activity_at_desc`) → scope'y w `app/models/concerns/sort_handler.rb` (`sort_on_last_activity_at` itd.) — dla paginacji.
  - **Front:** `store/modules/conversations/helpers.js` (`SORT_OPTIONS` + `sortConfig` komparatory, fallback `last_activity_at_desc`) — dla live-update listy.
- Domyślny sort na froncie: `activeSortBy` (ChatList.vue l.79, init `LAST_ACTIVITY_AT_DESC`), a zapisany wybór per-user w `uiSettings.conversations_filter_by.order_by` (odczyt w `setFiltersFromUISettings`, l.~393–399; jest tam już marker KLIMABAZAR F6).
- Brak natywnej opcji „po ostatniej wiadomości". Pole `last_chat_message_at` jest już w payloadzie listy (F8).

## Architektura zmiany

### Backend (fork, marker KLIMABAZAR)

1. `app/models/concerns/sort_handler.rb` — nowy scope `sort_on_last_message_at(sort_direction = :desc)`:
   - `reorder` po podzapytaniu skorelowanym `MAX(messages.created_at)` z `messages.chat`, `NULLS LAST` (rozmowy bez realnej wiadomości na dół).
   - Styl spójny z istniejącymi scope'ami w tym pliku.
2. `app/finders/conversation_finder.rb`:
   - `SORT_OPTIONS += { 'last_message_at_asc' => %w[sort_on_last_message_at asc], 'last_message_at_desc' => %w[sort_on_last_message_at desc] }`.
   - **Domyślny** (l.~207): `SORT_OPTIONS[params[:sort_by]] || SORT_OPTIONS['last_message_at_desc']`.

### Front (fork, marker KLIMABAZAR)

3. `wootConstants` (`SORT_BY_TYPE`) — `LAST_MESSAGE_AT_DESC` i `LAST_MESSAGE_AT_ASC`.
4. `store/modules/conversations/helpers.js`:
   - `SORT_OPTIONS += last_message_at_asc/desc → ['sortOnLastMessageAt', dir]`.
   - `sortConfig.sortOnLastMessageAt` — porównanie po `last_chat_message_at`; brak wartości (null/0) → na dół niezależnie od kierunku.
   - `sortComparator` fallback → `SORT_OPTIONS.last_message_at_desc`.
5. `ChatList.vue`:
   - `activeSortBy` init (l.79) → `LAST_MESSAGE_AT_DESC`.
   - fallback w `setFiltersFromUISettings` (gdy brak/niepoprawny `order_by`) → `LAST_MESSAGE_AT_DESC`.
   - dodać pozycję do menu sortowania (lista opcji sortu).
6. `i18n dashboard/.../chatlist.json` (en + pl) — `SORT_ORDER_ITEMS.last_message_at_desc/asc.TEXT`:
   - pl: „Ostatnia wiadomość: od najnowszych" / „Ostatnia wiadomość: od najstarszych".
   - en: „Last message: Newest first" / „Last message: Oldest first".

### Wymuszenie na wszystkich (deploy, jednorazowo)

Po deployu — komenda w konsoli na prod czyszcząca zapisany sort, żeby każdy zszedł na nowy domyślny (dalej może wybrać własny z dropdowna, który zapisze się normalnie). Dokładny model/klucz `ui_settings` potwierdzony w planie; intencja: usunąć `conversations_filter_by.order_by` ze wszystkich rekordów `ui_settings`.

## Zachowanie / edge cases

- Rozmowa bez realnej wiadomości (sama aktywność): `last_chat_message_at` null/0 → na dole listy (NULLS LAST i komparator).
- `last_activity_at >= last_chat_message_at` zawsze (chat ⊆ wszystkie wiadomości) — backendowy scope zapewnia poprawną paginację (nie tylko reorder załadowanej strony).
- Użytkownik może nadal wybrać dowolny sort z menu; po wyborze zapisuje się per-user jak dotąd.

## Poza zakresem (YAGNI)

- Zdenormalizowana kolumna `last_message_at` + migracja/callback (ścieżka wydajnościowa przy dużym wzroście; teraz podzapytanie wystarcza dla skali Klimabazaru ~281 otwartych).
- Zmiana semantyki `last_activity_at` (używane też w auto-resolve, F8 fallback) — nie ruszamy.

## Wdrożenie

Backend + front (vue). Build CI + deploy (sygnał właściciela). **Brak migracji.** Po deployu: jednorazowy reset zapisanego sortu + weryfikacja kolejności listy (rozmowa z nową notatką/przypisaniem nie wskakuje na górę; nowa realna wiadomość wskakuje).
