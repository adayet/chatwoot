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

## ROZSTRZYGNIĘCIE (2026-06-10, sesja 2) — hipoteza OBALONA, reopen działa

Rozpoznanie kodu + read-only diagnostyka prod. **Hipoteza `lock_to_single_conversation` jest błędna dla e-maila, a reopen F6a działa poprawnie.**

**1. `lock_to_single_conversation` NIE dotyczy kanału e-mail.** Flaga jest czytana tylko w kanałach social/telco (twilio, whatsapp, sms, telegram, line, instagram, facebook, tiktok, voice) oraz w `ConversationBuilder` (web widget/API). Mailboxy e-mail jej nie konsultują:
- IMAP — `app/mailboxes/imap/imap_mailbox.rb:92` `find_conversation_by_in_reply_to || find_conversation_by_reference_ids || Conversation.create!` (wątkowanie wyłącznie po nagłówkach `In-Reply-To`/`References`).
- Forward/reply-address — `Mailbox::ConversationFinder` (strategie ReceiverUuid → InReplyTo → References → NewConversation).
- Outgoing maile zapisują `source_id = Message-ID` (`app/services/email/send_on_email_service.rb:13`), więc reply klienta z `In-Reply-To` na ten Message-ID trafia do starego wątku.
→ **Ustawienie `lock_to_single_conversation=true` nie zmieni zachowania e-maila. Fix konfiguracyjny nie istnieje.**

**2. Reopen jest bezwarunkowy i działa.** `reopen_conversation` jest wpięty `after_create_commit` (`app/models/message.rb:137,324,403`). Na prod: **0 botów, 0 inboxów API, 0 rozmów `muted`** (Redis scan `CONVERSATION::*::MUTED` = 0) → `reopen_resolved_conversation` zawsze trafia w `else → conversation.open!`. Nie da się go nie odpalić, jeśli incoming wyląduje na rozmowie.

**3. Dane prod potwierdzają (read-only, 2026-06-10):**
- 9 inboxów, wszystkie `Channel::Email`, wszystkie `lock=false`.
- **`reporting_events`: 0 rozwiązanych rozmów e-mail ma incoming PO zdarzeniu `conversation_resolved`** → kiedy reply doleciał na rozmowę, zawsze ją zreopenował.
- 48/51 resolved kończy się na incoming = normalne (agent rozwiązał po przeczytaniu, bez odpowiedzi przez Chatwoota / kontakt telefoniczny).
- Multi-conv kontakty to głównie maile automatyczne (InPost, potwierdzenia przelewów, powiadomienia Allegro, proformy, spam) — każdy to osobne zdarzenie z tym samym tematem. Tylko 6 grup tematycznych ma równocześnie resolved + inną rozmowę (kandydaci na „fork").

**Prawdziwa przyczyna „wątek nie wraca":** odpowiedź klienta, która **nie ma pasującego `In-Reply-To`/`References`** (nowy mail zamiast „Odpowiedz", klient gubiący nagłówki, relay marketplace przepisujący nagłówki), tworzy **nową** rozmowę. Stara resolved słusznie zostaje resolved. Reply *wrócił* do „Wszystkich" — ale jako nowy rekord. To **forking wątkowania**, nie bug reopen.

**Konsekwencje dla planu:**
- F6a „napraw reopen" — **nic do naprawiania w reopen**. Ewentualne wymuszenie „każdy mail klienta kontynuuje ostatni wątek" = zmiana kodu (nowa strategia wątkowania) i ryzykowne dla allegro@/erli@ (każde zamówienie powinno być osobne — troska F7). Do świadomej decyzji, nie automat.
- **F6b (wyszarzenie zamiast znikania) to realny, czysty win** i trafia w głębszą potrzebę („chcę widzieć, nie chcę żeby znikały"). Front (fork `KLIMABAZAR`). Następny krok: brainstorming → spec, po uprzednim sprawdzeniu, co realnie pokazuje filtr „Wszystkie" w UI listy rozmów.

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
