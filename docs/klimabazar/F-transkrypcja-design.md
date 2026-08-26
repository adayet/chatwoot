<!-- KLIMABAZAR F-transkrypcja: spec zmian maila transkrypcji rozmowy -->
# F-transkrypcja — customizacja maila z transkrypcją rozmowy

**Status:** zatwierdzony design (2026-08-26)
**Marker w kodzie:** `KLIMABAZAR F-transkrypcja`
**Charakter:** backend (mailer + szablon ERB + layout liquid + i18n + model Inbox + dane produkcji). Nie da się sidecar-em. Brak odpowiedników w `enterprise/`.

## Cel
Funkcja „Transkrypcja rozmowy" (wysyłka zapisu rozmowy na e-mail) ma:
1. mieć tytuł (subject) zawierający tytuł wątku i e-mail rozmówcy;
2. mieć elementy systemowe (etykiety, daty, stopka) po polsku;
3. pokazywać daty w polskim czasie (Europe/Warsaw), a strefa Warsaw ma obowiązywać na skrzynkach wszędzie gdzie to możliwe.

## Kontekst kodu (stan przed zmianą)
- Mailer: `app/mailers/conversation_reply_mailer.rb` — metoda `conversation_transcript` (l. 46-61). Subject ustawiany bezpośrednio w `mail(...)` w l. 59: `"[##{@conversation.display_id}] #{I18n.t('conversations.reply.transcript_subject')}"`.
- Szablon: `app/views/mailers/conversation_reply_mailer/conversation_transcript.html.erb` (jedyny; brak `.text.erb`/`.liquid`). Etykiety `From/Subject/To/CC/BCC/Attachments` to literały EN (l. 8,10,14,18,21,24,36). Daty: `strftime('%b %d, %I:%M %p %Z')` (l. 43,45), strefa z `@inbox.timezone` gdy ustawiona.
- Layout: `app/views/layouts/mailer/base.liquid` — stopka „This email was sent by" (l. 123), literał EN.
- i18n: `config/locales/en.yml` + `config/locales/pl.yml` (pl istnieje, dobrze wypełniony). `transcript_subject` już przetłumaczony (en.yml:385 / pl.yml:367).
- Locale mailera = **locale konta** (`ApplicationMailer#switch_locale`, konto prod ma `locale=pl`). Więc i18n zadziała po polsku automatycznie.
- Strefa skrzynek prod: obecnie `UTC`.
- Callerzy `conversation_transcript` (wszyscy przekazują `account`): `api/v1/accounts/conversations_controller.rb:77`, `api/v1/widget/conversations_controller.rb:82`, `services/action_service.rb:93`.

## Decyzje

### 1. Subject — `conversation_reply_mailer.rb:59`
Logika warunkowa:
- **rozmowa e-mail** (obecne `@conversation.additional_attributes['mail_subject']` ORAZ `@contact&.email`):
  `[#<display_id>] <mail_subject> — <contact.email>`
- **inaczej** (czat/WhatsApp itp.): `[#<display_id>] <I18n.t('conversations.reply.transcript_subject')>` (bez członu z e-mailem)

Separator: `—` (półpauza, U+2014). Warunek = obecność zarówno tytułu wątku, jak i e-maila; brak któregokolwiek → fallback.

### 2. Etykiety w treści → i18n — `conversation_transcript.html.erb`
Literały → `I18n.t`, nowe klucze w `en.yml` i `pl.yml`:
| literał EN | klucz (PL) |
|---|---|
| From: | Od: |
| Subject: | Temat: |
| To: | Do: |
| CC: | DW: |
| BCC: | UDW: |
| Attachments: | Załączniki: |

Rozmieszczenie kluczy: nowy blok pod `conversations.reply` (blisko `transcript_subject`), np. `conversations.reply.transcript_labels.*` — dokładna ścieżka w planie. Klucze dodać do **obu** plików (parytet en↔pl).

### 3. Daty → polskie + czas polski — `conversation_transcript.html.erb:43,45`
- `strftime(...)` → `I18n.l(message.created_at.in_time_zone(tz), format: :transcript)`.
- Nowy format `time.formats.transcript` w `pl.yml` i `en.yml`: efekt `15 sie 2026, 14:30` (polskie nazwy miesięcy z `rails-i18n`, 24h). Format bez `%Z` (strefa jednolita Warsaw).
- Strefa `tz` = `@inbox.timezone` z **fallbackiem `Europe/Warsaw`** gdy pusta.

### 4. Stopka → i18n — `layouts/mailer/base.liquid:123`
„This email was sent by …" → i18n (klucze w `en.yml`/`pl.yml`). Konta PL → PL, EN → EN.
**Do potwierdzenia w planie:** mechanizm i18n w szablonie `.liquid` (Chatwoot liquid nie ma bezpośrednio `I18n.t`) — prawdopodobnie przekazanie przetłumaczonego stringa jako zmiennej z warstwy renderującej layout, albo istniejący filtr/assign. Zbadać przed edycją.

### 5. Strefa Europe/Warsaw na skrzynkach
- **Dane**: `inbox.timezone = 'Europe/Warsaw'` na wszystkich istniejących skrzynkach — `rails runner` na dev i (przy deployu) na prod.
- **Kod**: nowe skrzynki domyślnie `Europe/Warsaw` zamiast UTC. Marker `KLIMABAZAR F-transkrypcja`.
  **Do ustalenia w planie:** mechanizm — domyślna wartość kolumny `timezone` (migracja `change_column_default`), `attribute :timezone, default: 'Europe/Warsaw'` na modelu `Inbox`, albo `before_validation`/`before_create` callback. Zbadać skąd bierze się obecny UTC (kolumna DB vs builder vs frontend) i wybrać najmniej inwazyjny punkt.

## Weryfikacja (dev Docker, 4.17.0)
1. Wysłać transkrypcję rozmowy **e-mail** → MailHog (`localhost:8025`): subject `[#id] <tytuł> — <email>`; etykiety PL (Od/Temat/Do/…); data `15 sie 2026, 14:30` czasu polskiego; stopka PL.
2. Wysłać transkrypcję rozmowy **nie-e-mail** (czat) → subject `[#id] Transkrypcja rozmowy` (bez e-maila).
3. Utworzyć nową skrzynkę → `timezone == 'Europe/Warsaw'`.
4. Istniejące skrzynki dev → po `rails runner` mają Warsaw.

## Deploy
Standardowa pętla: commit (`KLIMABAZAR F-transkrypcja`) → push → CI build → backup pg_dump → podmiana tagu → `db:migrate` (jeśli migracja default kolumny) → `up -d` → `rails runner` ustawiający strefę istniejących skrzynek na prod → weryfikacja (MailHog nie ma na prod — sprawdzić realną wysyłką na kontrolowany adres lub log).

## Pliki dotknięte
- `app/mailers/conversation_reply_mailer.rb` (subject)
- `app/views/mailers/conversation_reply_mailer/conversation_transcript.html.erb` (etykiety, daty)
- `app/views/layouts/mailer/base.liquid` (stopka)
- `config/locales/en.yml`, `config/locales/pl.yml` (nowe klucze + format daty)
- `app/models/inbox.rb` (domyślna strefa) — lub migracja `db/migrate/*` (default kolumny), do ustalenia
- `CUSTOMIZATIONS.md` (wpis do rejestru)
- (dane) `rails runner` — nie plik repo

## Otwarte kwestie do rozwiązania w planie
1. Mechanizm i18n w `base.liquid` (punkt 4).
2. Mechanizm domyślnej strefy nowej skrzynki (punkt 5) — kolumna default vs model attribute vs callback.
3. Czy `mail_subject` bywa niepustym stringiem dla nie-email (sanity) — potwierdzić że warunek dobrze rozróżnia.
