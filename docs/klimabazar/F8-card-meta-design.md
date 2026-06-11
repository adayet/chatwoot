# F8 — Karta rozmowy: liczba wiadomości w wątku + data ostatniej realnej wiadomości — Design

Status: zatwierdzony 2026-06-11. Następny krok: plan implementacji (writing-plans).

## Cel

Zmiana wyglądu wiersza na liście rozmów (oba layouty kart):

1. **Badge w prawym dolnym rogu** = liczba **realnych** wiadomości w wątku (przychodzące + wychodzące, **bez** zdarzeń systemowych typu „przypisano agenta" i **bez** notatek prywatnych). Zastępuje dotychczasowy numeryczny licznik nieprzeczytanych.
2. **Data (prawy górny róg)** = czas **ostatniej realnej wiadomości** w wątku (przychodzącej lub wychodzącej, bez notatki prywatnej), zamiast obecnego `last_activity_at` (który skacze przy dowolnej aktywności, np. przypisaniu agenta).

## Kontekst / stan obecny (ustalone z kodu)

- Serializer listy `app/views/api/v1/conversations/partials/_conversation.json.jbuilder`:
  - `json.timestamp = conversation.last_activity_at.to_i` → to pole zasila datę (`TimeAgo`).
  - `json.unread_count = conversation.unread_incoming_messages.count` → zasila badge (`UnreadBadge`).
  - payload niesie tylko **ostatnią** wiadomość (`messages: [last]`) oraz `last_non_activity_message` (ostatnia non-activity, ale **zawiera** notatki prywatne) — **brak** liczby wiadomości i **brak** czystego „czasu ostatniej realnej wiadomości".
- Nieprzeczytane na liście są **globalne**, nie per-user: liczone względem pojedynczej kolumny `agent_last_seen_at`. Gdy ktokolwiek otworzy rozmowę — badge znika wszystkim. Numeryczny licznik jest więc redundantny z niebieską kropką + pogrubieniem wiersza.
- `Message` ma gotowy scope **`chat`** = `where.not(message_type: :activity).where(private: false)` — dokładnie „realne wiadomości" (bez aktywności, bez notatek prywatnych). Technicznie obejmuje też typ `template`, ale na kanałach mailowych Klimabazaru ich nie ma → liczba = przychodzące + wychodzące.
- `ConversationItem.vue` renderuje warunkowo (`showExpanded`): kartę **expanded** (`components-next/.../ConversationCardExpanded.vue` → `CardContent.vue`) albo **legacy/condensed** (`components/widgets/conversation/ConversationCard.vue`). Obie używają `chat.timestamp` na datę i `UnreadBadge` (teal) na badge. Zmiana dotyka **obu** kart (spójnie z F2/F6).

## Architektura zmiany

### Backend (1 plik, fork, marker KLIMABAZAR)
`app/views/api/v1/conversations/partials/_conversation.json.jbuilder` — 2 nowe pola:

```ruby
json.chat_messages_count conversation.messages.chat.count
json.last_chat_message_at conversation.messages.chat.maximum(:created_at).to_i
```

- `chat_messages_count` — pkt 1 (scope `chat`).
- `last_chat_message_at` — pkt 2; `maximum(:created_at)` nie wymaga ładowania rekordu; `nil → 0` gdy brak realnych wiadomości.

Koszt: 2 dodatkowe lekkie zapytania na rozmowę w liście — spójne z tym, co partial już robi (`unread_count`, `last_non_activity_message`, `messages.last`). Skala Klimabazaru mała → akceptowalne.

### Frontend (fork, marker KLIMABAZAR)

**Nowy komponent** `components-next/Conversation/ConversationCard/MessageCountBadge.vue` — presentacyjny, neutralny styl (`n-slate`, nie teal-alert), pokazywany gdy `count >= 1`, obsługa przepełnienia jak `UnreadBadge` (`>9`). `UnreadBadge.vue` **zostaje nietknięty** (łatwiejszy merge) — po prostu nieużywany w kartach.

**Karta expanded** — `CardContent.vue` dostaje obecnie tylko `unreadCount` (Number), nie cały `chat`. Dodaj prop `chatMessagesCount` (Number) i zamień `<UnreadBadge :count="unreadCount" .../>` na `<MessageCountBadge :count="chatMessagesCount" :align-bottom="showExpandedPreview" />`. `ConversationCardExpanded.vue`: przekaż `:chat-messages-count="chat.chat_messages_count"` do `CardContent` oraz zmień `TimeAgo :last-activity-timestamp` z `chat.timestamp` → `chat.last_chat_message_at || chat.timestamp`.

**Karta legacy** — `components/widgets/conversation/ConversationCard.vue`: analogicznie podmień `UnreadBadge` → `MessageCountBadge` (źródło `chat.chat_messages_count`) i `TimeAgo` źródło daty → `chat.last_chat_message_at || chat.timestamp`.

**Nieprzeczytane** — sygnał zostaje bez zmian: niebieska kropka + pogrubienie wiersza (logika `unreadCount > 0` nietknięta). Usuwamy tylko redundantny numer.

## Przepływ danych

`_conversation.json.jbuilder` → `chat.chat_messages_count` / `chat.last_chat_message_at` w storze rozmów → props karty (`chat`) → `MessageCountBadge` (badge) i `TimeAgo` (data).

## Edge cases / degradacja

- 0 realnych wiadomości (sama aktywność): `chat_messages_count = 0` → badge ukryty; `last_chat_message_at = 0` → data fallback `chat.timestamp`, dalej `created_at`.
- Inne serializery (wyszukiwarka, rozmowy kontaktu) nie dostają nowych pól → badge ukryty, data fallback. Łagodna degradacja, MVP — poza zakresem.

## Poza zakresem (YAGNI)

- Brak zmian w podglądzie wiadomości i w `last_non_activity_message`.
- Brak zmian w mechanice nieprzeczytanych.
- Pola dodawane tylko do serializera listy inboxa (nie do search/contact/enterprise partiali).

## Pliki

- Modify: `app/views/api/v1/conversations/partials/_conversation.json.jbuilder` (backend)
- Create: `app/javascript/dashboard/components-next/Conversation/ConversationCard/MessageCountBadge.vue`
- Modify: `app/javascript/dashboard/components-next/Conversation/ConversationCard/CardContent.vue`
- Modify: `app/javascript/dashboard/components-next/Conversation/ConversationCard/ConversationCardExpanded.vue`
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue`
- Modify: `CUSTOMIZATIONS.md` (rejestr) + `docs/klimabazar/BACKLOG.md` (F8)

## Wdrożenie

Backend → feature dojdzie na prod przez build CI + deploy (sygnał właściciela, pętla z `CLAUDE.local.md`). Brak migracji. Weryfikacja na lokalnym devie przed pushem.
