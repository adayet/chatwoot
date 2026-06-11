# F8 — Karta rozmowy: liczba wiadomości + data ostatniej realnej — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na liście rozmów badge w prawym dolnym rogu pokazuje liczbę realnych wiadomości w wątku (zamiast nieprzeczytanych), a data — czas ostatniej realnej wiadomości (zamiast `last_activity_at`).

**Architecture:** Serializer listy dolicza 2 pola przez istniejący scope `Message.chat` (incoming+outgoing, bez aktywności i notatek prywatnych). Front: nowy neutralny `MessageCountBadge` zastępuje `UnreadBadge` w obu kartach (expanded + legacy), a `TimeAgo` bierze datę z nowego pola. Nieprzeczytane sygnalizuje dalej kropka + pogrubienie (logika `unreadCount` nietknięta).

**Tech Stack:** Rails jbuilder, Vue 3 `<script setup>`, Tailwind. Specy pomijamy (CLAUDE.md „avoid specs unless asked"); weryfikacja = rubocop/eslint + konsola/UI na lokalnym devie (Docker, `http://localhost:3001`).

**Spec:** [F8-card-meta-design.md](F8-card-meta-design.md).

---

## Mapa plików
- Modify: `app/views/api/v1/conversations/partials/_conversation.json.jbuilder` — 2 nowe pola.
- Create: `app/javascript/dashboard/components-next/Conversation/ConversationCard/MessageCountBadge.vue` — neutralny badge liczby wiadomości.
- Modify: `app/javascript/dashboard/components-next/Conversation/ConversationCard/CardContent.vue` — prop + badge.
- Modify: `app/javascript/dashboard/components-next/Conversation/ConversationCard/ConversationCardExpanded.vue` — przekazanie propa + źródło daty.
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue` — badge + źródło daty (karta legacy/condensed).
- Modify: `CUSTOMIZATIONS.md`, `docs/klimabazar/BACKLOG.md`.

Uwaga dev: `docker compose exec -T rails ...` dla Ruby. Rails w dev przeładowuje jbuildery bez restartu; po zmianie odśwież listę w przeglądarce (re-fetch). Front przez Vite HMR.

---

### Task 1: Backend — 2 pola w serializerze listy

**Files:**
- Modify: `app/views/api/v1/conversations/partials/_conversation.json.jbuilder` (po linii `json.unread_count ...`)

- [ ] **Step 1: Dodaj pola po `unread_count`**

Znajdź `json.unread_count conversation.unread_incoming_messages.count` i wstaw bezpośrednio pod nim:

```ruby
# KLIMABAZAR F8: liczba realnych wiadomosci w watku (scope chat = bez aktywnosci i notatek prywatnych)
json.chat_messages_count conversation.messages.chat.count
# KLIMABAZAR F8: czas ostatniej realnej wiadomosci (na date karty zamiast last_activity_at)
json.last_chat_message_at conversation.messages.chat.maximum(:created_at).to_i
```

- [ ] **Step 2: Weryfikacja wartości w konsoli (dev)**

Run:
```bash
docker compose exec -T rails bundle exec rails runner "c = Account.first.conversations.order(:id).last; puts 'display_id=' + c.display_id.to_s; puts 'chat_count=' + c.messages.chat.count.to_s; puts 'last_chat_at=' + c.messages.chat.maximum(:created_at).to_i.to_s; puts 'last_activity_at=' + c.last_activity_at.to_i.to_s" 2>&1 | grep "display_id\|chat_count\|last_chat_at\|last_activity_at"
```
Expected: `chat_count` to liczba realnych wiadomości; `last_chat_at` ≤ `last_activity_at` (data ostatniej realnej wiadomości nie jest późniejsza niż ostatnia aktywność).

- [ ] **Step 3: Weryfikacja JSON z API (dev)**

Run:
```bash
docker compose exec -T rails bundle exec rails runner "include Rails.application.routes.url_helpers; c = Account.first.conversations.order(:id).last; json = ApplicationController.render(partial: 'api/v1/conversations/partials/conversation', locals: { conversation: c }, formats: [:json]); require 'json'; h = JSON.parse(json); puts 'chat_messages_count=' + h['chat_messages_count'].to_s; puts 'last_chat_message_at=' + h['last_chat_message_at'].to_s" 2>&1 | grep "chat_messages_count\|last_chat_message_at"
```
Expected: oba klucze obecne w payloadzie z poprawnymi wartościami. (Jeśli render partiala się nie powiedzie środowiskowo, pomiń ten krok — Step 2 wystarcza; pola w UI zweryfikujesz w Task 5.)

- [ ] **Step 4: Commit**

```bash
git add app/views/api/v1/conversations/partials/_conversation.json.jbuilder
git commit -m "feat(klimabazar): F8 serializer listy - chat_messages_count + last_chat_message_at"
```

---

### Task 2: Frontend — komponent `MessageCountBadge`

**Files:**
- Create: `app/javascript/dashboard/components-next/Conversation/ConversationCard/MessageCountBadge.vue`

- [ ] **Step 1: Utwórz komponent** (neutralny, na wzór `UnreadBadge` ale szary i bez limitu „9+"; pokazuje pełną liczbę gdy ≥ 1)

```vue
<script setup>
// KLIMABAZAR F8: neutralny licznik wszystkich realnych wiadomosci w watku.
// Zastepuje UnreadBadge w kartach listy; UnreadBadge.vue zostaje nietkniety (latwiejszy merge).
defineProps({
  count: { type: Number, default: 0 },
  alignBottom: { type: Boolean, default: false },
});
</script>

<template>
  <span
    v-if="count > 0"
    class="bg-n-slate-3 rounded-full h-4 min-w-4 px-1 w-fit font-medium text-xxs leading-3 text-n-slate-12 inline-grid place-items-center flex-shrink-0"
    :class="{ 'mb-0.5': alignBottom }"
  >
    {{ count }}
  </span>
  <span v-else />
</template>
```

- [ ] **Step 2: Lint**

Run: `docker compose exec -T vite pnpm eslint app/javascript/dashboard/components-next/Conversation/ConversationCard/MessageCountBadge.vue`
Expected: brak błędów. (Jeśli eslint nie jest w kontenerze vite, uruchom lokalnie: `pnpm eslint <plik>`.)

- [ ] **Step 3: Commit**

```bash
git add app/javascript/dashboard/components-next/Conversation/ConversationCard/MessageCountBadge.vue
git commit -m "feat(klimabazar): F8 komponent MessageCountBadge (neutralny licznik wiadomosci)"
```

---

### Task 3: Frontend — karta expanded (`CardContent` + `ConversationCardExpanded`)

**Files:**
- Modify: `app/javascript/dashboard/components-next/Conversation/ConversationCard/CardContent.vue`
- Modify: `app/javascript/dashboard/components-next/Conversation/ConversationCard/ConversationCardExpanded.vue:173-179, 204-209`

- [ ] **Step 1: `CardContent.vue` — import + prop + podmiana badge**

Zamień import (linia 5):
```js
import UnreadBadge from './UnreadBadge.vue';
```
na:
```js
// KLIMABAZAR F8: licznik wiadomosci zamiast nieprzeczytanych
import MessageCountBadge from './MessageCountBadge.vue';
```

Dodaj prop `chatMessagesCount` w `defineProps` (po `unreadCount`):
```js
  unreadCount: { type: Number, default: 0 },
  chatMessagesCount: { type: Number, default: 0 }, // KLIMABAZAR F8
  showExpandedPreview: { type: Boolean, default: false },
```

Zamień użycie badge (linia 45):
```vue
    <UnreadBadge :count="unreadCount" :align-bottom="showExpandedPreview" />
```
na:
```vue
    <MessageCountBadge :count="chatMessagesCount" :align-bottom="showExpandedPreview" />
```

> `unreadCount` zostaje propem — nadal steruje kolorem podglądu (`text-n-slate-12` vs `-11`). Nie ruszamy.

- [ ] **Step 2: `ConversationCardExpanded.vue` — przekaż prop do `CardContent`**

Zamień blok (linie 173–179):
```vue
      <CardContent
        :last-message="lastMessageInChat"
        :voice-call-status="voiceCallData.status"
        :voice-call-direction="voiceCallData.direction"
        :unread-count="unreadCount"
        :show-expanded-preview="false"
      />
```
na:
```vue
      <CardContent
        :last-message="lastMessageInChat"
        :voice-call-status="voiceCallData.status"
        :voice-call-direction="voiceCallData.direction"
        :unread-count="unreadCount"
        :chat-messages-count="chat.chat_messages_count || 0"
        :show-expanded-preview="false"
      />
```

- [ ] **Step 3: `ConversationCardExpanded.vue` — źródło daty w `TimeAgo`**

Zamień (linia 206):
```vue
          :last-activity-timestamp="chat.timestamp"
```
na:
```vue
          :last-activity-timestamp="chat.last_chat_message_at || chat.timestamp"
```

- [ ] **Step 4: Lint**

Run: `docker compose exec -T vite pnpm eslint app/javascript/dashboard/components-next/Conversation/ConversationCard/CardContent.vue app/javascript/dashboard/components-next/Conversation/ConversationCard/ConversationCardExpanded.vue`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add app/javascript/dashboard/components-next/Conversation/ConversationCard/CardContent.vue app/javascript/dashboard/components-next/Conversation/ConversationCard/ConversationCardExpanded.vue
git commit -m "feat(klimabazar): F8 karta expanded - licznik wiadomosci + data ostatniej realnej"
```

---

### Task 4: Frontend — karta legacy/condensed (`ConversationCard.vue`)

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue:10, 241-251`

- [ ] **Step 1: Podmień import badge**

Zamień (linia 10):
```js
import UnreadBadge from 'dashboard/components-next/Conversation/ConversationCard/UnreadBadge.vue';
```
na:
```js
// KLIMABAZAR F8: licznik wiadomosci zamiast nieprzeczytanych
import MessageCountBadge from 'dashboard/components-next/Conversation/ConversationCard/MessageCountBadge.vue';
```

> `unreadCount`/`hasUnread` (linie 39–40) zostają — sterują pogrubieniem/kropką nieprzeczytanych.

- [ ] **Step 2: Źródło daty w `TimeAgo`**

Zamień (linia 242):
```vue
            :last-activity-timestamp="chat.timestamp"
```
na:
```vue
            :last-activity-timestamp="chat.last_chat_message_at || chat.timestamp"
```

- [ ] **Step 3: Podmień badge**

Zamień blok (linie 247–251):
```vue
        <UnreadBadge
          v-if="hasUnread"
          :count="unreadCount"
          class="ltr:ml-auto rtl:mr-auto mt-1"
        />
```
na:
```vue
        <MessageCountBadge
          v-if="(chat.chat_messages_count || 0) > 0"
          :count="chat.chat_messages_count"
          class="ltr:ml-auto rtl:mr-auto mt-1"
        />
```

- [ ] **Step 4: Lint**

Run: `docker compose exec -T vite pnpm eslint app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue
git commit -m "feat(klimabazar): F8 karta legacy - licznik wiadomosci + data ostatniej realnej"
```

---

### Task 5: Weryfikacja na devie + rejestr zmian

**Files:**
- Modify: `CUSTOMIZATIONS.md`, `docs/klimabazar/BACKLOG.md`

- [ ] **Step 1: UI — karta expanded (`http://localhost:3001`)**

Otwórz listę rozmów (szeroki ekran → layout expanded). Sprawdź:
- w prawym dolnym rogu wiersza widać liczbę = liczbie realnych wiadomości w wątku (nie nieprzeczytanych),
- data w prawym górnym = czas ostatniej realnej wiadomości; po samym przypisaniu agenta (bez nowej wiadomości) data NIE skacze.

Test danych: w rozmowie dodaj zdarzenie aktywności bez wiadomości i potwierdź, że data się nie zmienia:
```bash
docker compose exec -T rails bundle exec rails runner "c = Account.first.conversations.order(:id).last; before = c.messages.chat.maximum(:created_at).to_i; c.update!(assignee: Account.first.users.first); puts 'last_chat_at before=' + before.to_s + ' after=' + c.reload.messages.chat.maximum(:created_at).to_i.to_s + ' (rowne = OK)'" 2>&1 | grep "before="
```
Expected: `before` == `after` (przypisanie nie zmienia daty realnej wiadomości).

- [ ] **Step 2: UI — karta legacy/condensed**

Zwęź okno (albo wyłącz „expanded" w ustawieniu layoutu listy), żeby renderowała się karta condensed. Potwierdź to samo: licznik wiadomości w rogu + data ostatniej realnej wiadomości.

- [ ] **Step 3: Wpisy do `CUSTOMIZATIONS.md`** (do tabeli „Rejestr zmian")

```markdown
| `app/views/api/v1/conversations/partials/_conversation.json.jbuilder` (F8, backend-fork: czulszy przy mergach upstreamu) | +`chat_messages_count` (`messages.chat.count`) i `last_chat_message_at` (`messages.chat.maximum(:created_at)`) | F8: liczba realnych wiadomości i czas ostatniej realnej wiadomości dla karty listy | średnia (serializer bywa zmieniany) | konsola: oba pola w renderze partiala; UI: badge i data |
| `MessageCountBadge.vue` (F8, nowy) | neutralny (n-slate) licznik liczby wiadomości; zastępuje `UnreadBadge` w kartach (UnreadBadge nietknięty) | F8: badge = liczba wiadomości wątku | niska (plik własny) | szary badge z liczbą ≥ 1 |
| `CardContent.vue` + `ConversationCardExpanded.vue` (F8) | prop `chatMessagesCount` → `MessageCountBadge`; `TimeAgo` z `last_chat_message_at \|\| timestamp` | F8: karta expanded — licznik + data ostatniej realnej | średnia (karta) | badge=liczba wiadomości; data nie skacze po przypisaniu |
| `components/widgets/conversation/ConversationCard.vue` (F8) | `UnreadBadge`→`MessageCountBadge` (`chat.chat_messages_count`); `TimeAgo` z `last_chat_message_at \|\| timestamp` | F8: karta legacy — licznik + data ostatniej realnej | średnia (karta) | jw. w layoucie condensed |
```

- [ ] **Step 4: Backlog — oznacz F8 jako zrobione** w `docs/klimabazar/BACKLOG.md` (wiersz F8 → ✅, dopisek w sekcji „Postęp").

- [ ] **Step 5: Commit**

```bash
git add CUSTOMIZATIONS.md docs/klimabazar/BACKLOG.md
git commit -m "docs(klimabazar): F8 rejestr zmian + backlog"
```

---

## Po wdrożeniu
- Backend → na prod przez build CI (`git push` → `-R adayet/chatwoot`) + deploy (sygnał właściciela, pętla z `CLAUDE.local.md`). Brak migracji.
- Po deployu: lista re-fetchuje payload → pola dostępne. Sprawdź badge i datę wg „Jak zweryfikować" w `CUSTOMIZATIONS.md`.
- Synchronizacja: definicja „realnej wiadomości" = scope `Message.chat`. Gdyby upstream zmienił `chat`, zweryfikować liczby.

## Opcjonalnie (poza zakresem)
- Pola w pozostałych serializerach (search, rozmowy kontaktu) — gdyby badge/data miały działać też tam.
- Cap „99+" dla bardzo długich wątków (dziś pełna liczba; pill rozszerza się `w-fit`).
