# F6 — Spike: zachowanie wątków „rozwiązanych"

**Cel biznesowy (słowa właściciela):** „Jak oznacza się wątek jako rozwiązany, a klient ponownie napisze w danym wątku, to nie wraca do folderu »Wszystkie«. Nie chcę, żeby znikały, tylko żeby były np. lekko wyszarzone."

To **spike** (rozpoznanie przed specem) — bo trzeba najpierw odtworzyć i zdiagnozować, a nie zgadywać. Poniżej gotowe rozpoznanie zrobione 2026-06-10.

## Dekompozycja
- **F6a — reopen po odpowiedzi:** rozwiązany wątek ma wracać do widoku „Wszystkie" (open), gdy klient odpisze.
- **F6b — wyszarzenie zamiast znikania:** rozwiązane mają być widoczne na liście, wyszarzone, nie ukryte. To **front (Vue)** — zmiana filtra/wyświetlania listy. Osobne od F6a.

## Mapa kodu (zweryfikowana w v4.14.1)
- `app/models/message.rb:403` `reopen_conversation` — wywoływane po stworzeniu wiadomości:
  - `return if conversation.muted?` ← **muted nie wraca nigdy**
  - `return unless incoming?` ← reopen tylko dla wiadomości przychodzących
  - dla resolved → `reopen_resolved_conversation` (l. 424)
- `app/models/message.rb:424` `reopen_resolved_conversation`:
  - jeśli `inbox.active_bot?` → `conversation.pending!` (NIE open)
  - elsif `inbox.api?` → `open!`
  - else → `open!`
- `app/models/inbox.rb:173` `active_bot?` = aktywny agent_bot na inboxie LUB hook `dialogflow` enabled.
- `captain_pending_conversation?` zwraca twardo `false` w tej wersji (ścieżka Captain nieaktywna).

## Co już WYKLUCZONE (dane z produkcji 2026-06-10)
- **Brak aktywnych botów** (`agent_bot_inboxes` puste) → ścieżka `pending!` NIE zachodzi.
- Statusy rozmów: **281 open, 51 resolved, 0 pending, 0 snoozed** → nic nie utyka w pending. Potwierdza powyższe.
- Czyli kod idzie w `else → conversation.open!` — wątek *powinien* wracać do open. Skoro (wg właściciela) nie wraca, przyczyna leży **poza** logiką reopen.

## Leading hypothesis (do potwierdzenia w spike'u)
**Ciągłość konwersacji e-mail.** Wszystkie 9 inboxów ma **`lock_to_single_conversation = false`**. Przy `false` Chatwoot dla nowego e-maila od kontaktu potrafi utworzyć **nową** rozmowę zamiast doczepić wiadomość (i zreopenować) do istniejącej rozwiązanej — zależnie od dopasowania nagłówków `In-Reply-To`/`References`. Wtedy:
- odpowiedź klienta nie dolatuje jako `incoming` do starego wątku → stary zostaje `resolved` (nie wraca),
- a ewentualna nowa rozmowa to inny rekord (właściciel widzi „wątek nie wrócił").

**Hipoteza fix bez forka:** ustawić `lock_to_single_conversation = true` na inboxach (ustawienie inboxa w UI / DB) — wtedy wiadomości kontaktu trafiają do jednej rozmowy i ją reopenują. **To trzeba odtworzyć i potwierdzić, zanim uznamy za rozwiązanie.**

## Zadania spike'a (następna sesja, zacznij tu)
1. **Odtwórz** na bezpiecznym przypadku (najlepiej lokalnie/staging, nie na żywej skrzynce): utwórz rozmowę e-mail, rozwiąż ją, wyślij odpowiedź z tego samego adresu jako reply (z nagłówkiem References) ORAZ jako nowy e-mail. Zaobserwuj: dochodzi do tego samego wątku (reopen→open) czy powstaje nowa rozmowa?
2. **Przetestuj `lock_to_single_conversation = true`** na jednym inboxie testowym i powtórz pkt 1. Jeśli to naprawia F6a → fix jest konfiguracyjny (bez forka), do rozważenia per-inbox (uwaga: marketplace allegro@/erli@ mogą chcieć innego zachowania — patrz F7).
3. Sprawdź, czy któreś wątki bywają `muted` (wtedy nigdy nie reopenują) — `SELECT count(*) FROM conversations WHERE muted...` (mute trzymane w Redis/flagu — zweryfikuj mechanizm w `Conversation#muted?`).
4. Dopiero po ustaleniu mechanizmu F6a — **brainstorming → spec**. Jeśli okaże się, że trzeba jednak ruszyć kod (np. zachowanie reopen ma być inne niż natywne) → fork backendu z markerem `KLIMABAZAR`.
5. **F6b (wyszarzenie):** osobno — znajdź komponent listy rozmów (Vue, `app/javascript/.../ConversationList` / karta rozmowy) i sposób filtrowania po statusie; zmień, by resolved były pokazywane wyszarzone zamiast filtrowane out. To zmiana frontu = fork.

## Pułapki
- Nie testuj reopena na żywych skrzynkach klientów — użyj testowego adresu/inboxa.
- Zmiana `lock_to_single_conversation` wpływa na to, jak grupują się przyszłe wiadomości — przemyśl per-inbox (sklep/kontakt vs marketplace).
- Każda realna zmiana kodu: marker `KLIMABAZAR` + wpis w `CUSTOMIZATIONS.md`.
