# F6 — Design: zachowanie wątków „rozwiązanych" (widoczność + status na liście)

**Data:** 2026-06-10
**Status:** zatwierdzony projekt (brainstorming), przed planem implementacji
**Poprzednik:** [F6-resolved-conversations-spike.md](F6-resolved-conversations-spike.md) (diagnoza)

## Cel biznesowy
Właściciel: „Jak oznacza się wątek jako rozwiązany, a klient ponownie odpisze, to nie wraca do »Wszystkie«. Nie chcę, żeby znikały, tylko żeby były wyszarzone." Doprecyzowane w trakcie: chce też rozróżniać na liście rozmowy **obsługiwane** (przypisany agent) od **nieobsłużonych** (bez przypisania i bez odpowiedzi).

## Ustalenia ze spike'a (co determinuje zakres)
- **F6a (reopen po odpowiedzi) DZIAŁA** i jest bezwarunkowy: brak botów + brak inboxów API + 0 rozmów `muted` → `reopen_resolved_conversation` zawsze trafia w `else → conversation.open!` ([app/models/message.rb:424](../../app/models/message.rb)). Potwierdzone empirycznie żywym testem (rozmowa 333: resolved 17:00:46 → incoming 17:02:33 → `conversation_opened` → open).
- **Prawdziwy problem to UI:** domyślny filtr listy = `Status: Otwarte`, więc rozwiązane znikają z pola widzenia.
- `lock_to_single_conversation` jest **nieczytane dla kanału e-mail** — fix konfiguracyjny nie istnieje.
- **Forking wątkowania** (reply bez `In-Reply-To`/`References` → nowa rozmowa) zostaje poza F6 → **F7** (ryzykowne dla allegro@/erli@).

**Wniosek:** F6 to wyłącznie zmiany frontu. Backend nietknięty.

## Zakres
### Zmiana 1 — domyślny filtr listy = „Wszystkie" (globalnie, dla każdego użytkownika)
- `app/javascript/dashboard/components/ChatList.vue`:
  - `activeStatus` ref: `wootConstants.STATUS_TYPE.OPEN` → `STATUS_TYPE.ALL` (l. ~76).
  - fallback resetu: `activeStatus.value = status || STATUS_TYPE.OPEN` → `|| STATUS_TYPE.ALL` (l. ~365).
- `app/javascript/dashboard/store/modules/conversations/index.js`: domyślne `chatStatusFilter: wootConstants.STATUS_TYPE.OPEN` → `ALL`.
- Filtr **nie jest utrwalany** per user (to stan komponentu) — użytkownik może przełączyć w UI w trakcie sesji; po przeładowaniu wraca do „Wszystkie".
- Special-foldery (`conversationType` = mention/participating/unattended) mają własną logikę zapytań i nie używają tego defaultu — nie ucierpią.
- Dotyczy wszystkich inboxów (też allegro@/erli@). Listy marketplace będą dłuższe — świadomy wybór („nic nie znika"); użytkownik może zawęzić filtrem.

### Zmiana 2 — kolorowanie wiersza wg „stanu obsługi" + badge statusu
Plik: `app/javascript/dashboard/components/widgets/conversation/ConversationCard.vue` (legacy — wciąż renderowany przez listę; `components-next/` dotyczy bąbelków wiadomości, nie karty listy).

Dane są na froncie (serializer `_conversation.json.jbuilder`): `chat.status`, `chat.meta.assignee` (+ `assignee_type`), `chat.first_reply_created_at`.

Computed `handlingState` z **precedencją** (pierwsze dopasowanie wygrywa):
1. `status === 'resolved'` → **zielony** (n-teal/n-green), badge „Rozwiązane"
2. `status === 'snoozed'` → **neutralny** (n-slate), badge „Uśpione"
3. `status === 'pending'` → **fiolet** (n-violet/dostępny odpowiednik), badge „Oczekujące" (rzadkie — brak botów)
4. open **i** brak `meta.assignee` **i** `first_reply_created_at == 0` → **bursztyn** (n-amber), badge „Nowy" (nieobsłużony)
5. open **i** (`meta.assignee` obecny **lub** `first_reply_created_at > 0`) → **niebieski** (n-blue), badge „W toku"

Aplikacja wizualna:
- root `<li>` (l. ~105) — dodatkowe klasy tła + lewy pasek (`border-l-[3px]` w kolorze stanu); muszą współgrać z istniejącymi klasami hover/selected.
- mały badge w nagłówku wiersza przy nazwie kontaktu (tekst + tło wg stanu).
- Kolory wyłącznie z tokenów `n-<kolor>-<stopień>` z `tailwind.config.js` (dokładne stopnie dobiera plan implementacji). **Bez custom/scoped CSS i inline styli** (CLAUDE.md: Tailwind only).
- `assignee_type === 'AgentBot'`: brak botów → traktujemy jak „w toku" (kubełek 5); nie wprowadzamy osobnego stanu.

## i18n
- Reuse istniejących kluczy statusów dla „Rozwiązane/Uśpione/Oczekujące", jeśli są dostępne w kontekście karty.
- Nowe etykiety „Nowy" i „W toku": klucze w `en.json` (reguła upstream) **oraz** wartości w `pl.json` (odstępstwo świadome — instalacja jest wyłącznie polskojęzyczna; bez tego właściciel zobaczy angielski fallback). Oznaczone markerem KLIMABAZAR; odnotowane w CUSTOMIZATIONS.md.

## Podejście (wybrane: A)
Cała logika i prezentacja w `ConversationCard.vue` (computed + klasy + inline badge), default filtra w `ChatList.vue` + store. Najmniejsza powierzchnia forka → najłatwiejsze re-aplikowanie po mergu upstreamu. Odrzucone: B (composable + osobny komponent badge — więcej plików do pilnowania), C (pole w backendzie — zbędne, dane już na froncie).

## Reguły forka
- Marker `KLIMABAZAR` w każdym dotkniętym fragmencie.
- Wpis w `CUSTOMIZATIONS.md` (rejestr zmian + powód).
- Backend nietknięty → brak migracji.

## Weryfikacja
- **Lokalny Docker (parytet prod, do postawienia)** — odtworzyć 5 stanów na danych seed: nowy/nieobsłużony, w toku (przypisany), w toku (po odpowiedzi), resolved, snoozed; sprawdzić kolory + badge + że default to „Wszystkie".
- F6a reopen: już potwierdzony żywym testem (nie wymaga ponownej weryfikacji).
- Wdrożenie: pętla CI → `pg_dump` → podmiana tagu → `up -d` wg CLAUDE.local.md (bez migracji — krok `db:migrate` zbędny, ale nieszkodliwy).

## Poza zakresem (świadomie)
- F6a reopen — bez zmian (działa).
- Forking wątkowania e-mail (wymuszenie kontynuacji wątku) → **F7**, osobna ryzykowna decyzja (allegro@/erli@).
- Wariant „resolved wyszarzony" — odrzucony na rzecz zielonego (semantyczny).
