<!-- KLIMABAZAR F-transkrypcja: plan implementacji -->
# F-transkrypcja — plan implementacji

> Spec: `docs/klimabazar/F-transkrypcja-design.md`. Fork Klimabazar, gałąź `klimabazar`.
> **Uwaga:** projekt (`CLAUDE.md`) mówi „Avoid writing specs unless explicitly asked" → BEZ testów rspec. Weryfikacja manualna przez MailHog na dev Dockerze. Każda edycja oznaczona `# KLIMABAZAR F-transkrypcja` / `<!-- KLIMABAZAR F-transkrypcja -->`.

**Cel:** subject transkrypcji = tytuł wątku + e-mail rozmówcy; etykiety, daty i stopka po polsku; strefa Europe/Warsaw na skrzynkach (istniejące + domyślnie nowe).

**Architektura:** edycja mailera (subject), szablonu ERB (etykiety + daty), layoutu liquid (stopka przez `liquid_locals`), i18n (en.yml + pl.yml), model/DB (domyślna strefa), dane (rails runner). Locale mailera = locale konta (już `pl` na prod), więc i18n zadziała automatycznie.

**Tech:** Rails 7.2, ActionMailer, liquid handler (`lib/action_view/template/handlers/liquid`), rails-i18n (polskie nazwy miesięcy).

---

## Task 1: Subject maila (tytuł wątku + e-mail rozmówcy)

**Files:**
- Modify: `app/mailers/conversation_reply_mailer.rb:56-60`

- [ ] **Step 1: Zmień blok `mail(...)` w `conversation_transcript`**

Zastąp (l. 56-60):
```ruby
    mail({
           to: to_email,
           from: from_email_with_name,
           subject: "[##{@conversation.display_id}] #{I18n.t('conversations.reply.transcript_subject')}"
         })
```
na:
```ruby
    # KLIMABAZAR F-transkrypcja: subject = [#id] tytul watku — email rozmowcy (dla rozmow e-mail);
    # dla nie-email fallback na "Transkrypcja rozmowy" bez czlonu z e-mailem.
    thread_subject = @conversation.additional_attributes&.dig('mail_subject').presence
    transcript_subject =
      if thread_subject && @contact&.email.present?
        "[##{@conversation.display_id}] #{thread_subject} — #{@contact.email}"
      else
        "[##{@conversation.display_id}] #{I18n.t('conversations.reply.transcript_subject')}"
      end
    mail({
           to: to_email,
           from: from_email_with_name,
           subject: transcript_subject
         })
```

- [ ] **Step 2: Weryfikacja składni**

Run: `docker compose exec -T rails ruby -c app/mailers/conversation_reply_mailer.rb`
Expected: `Syntax OK`

---

## Task 2: Etykiety treści po polsku (i18n)

**Files:**
- Modify: `config/locales/en.yml` (pod `conversations.reply`)
- Modify: `config/locales/pl.yml` (pod `conversations.reply`)
- Modify: `app/views/mailers/conversation_reply_mailer/conversation_transcript.html.erb:8,10,14,18,21,24,36`

- [ ] **Step 1: Dodaj klucze do `en.yml`**

Znajdź `transcript_subject: 'Conversation Transcript'` (en.yml:385) i tuż pod nim, w tym samym bloku `reply:`, dodaj:
```yaml
        transcript_labels:
          from: 'From'
          subject: 'Subject'
          to: 'To'
          cc: 'CC'
          bcc: 'BCC'
          attachments: 'Attachments'
```
(zachowaj wcięcia zgodne z sąsiednimi kluczami w tym pliku)

- [ ] **Step 2: Dodaj klucze do `pl.yml`**

Znajdź `transcript_subject: 'Transkrypcja rozmowy'` (pl.yml:367) i pod nim w bloku `reply:` dodaj:
```yaml
        transcript_labels:
          from: 'Od'
          subject: 'Temat'
          to: 'Do'
          cc: 'DW'
          bcc: 'UDW'
          attachments: 'Załączniki'
```

- [ ] **Step 3: Podmień literały w szablonie**

W `conversation_transcript.html.erb` zamień (zachowując `:` po etykiecie i strukturę):
- l. 8: `<div>From: <%= ... %></div>` → `<div><%= t('conversations.reply.transcript_labels.from') %>: <%= message.content_attributes.dig(:email, :from).join(", ") %></div>`
- l. 10: `<div>From: <%= message.sender&.try(:email) %></div>` → `<div><%= t('conversations.reply.transcript_labels.from') %>: <%= message.sender&.try(:email) %></div>`
- l. 14: `Subject:` → `<%= t('conversations.reply.transcript_labels.subject') %>:`
- l. 18: `To:` → `<%= t('conversations.reply.transcript_labels.to') %>:`
- l. 21: `CC:` → `<%= t('conversations.reply.transcript_labels.cc') %>:`
- l. 24: `BCC:` → `<%= t('conversations.reply.transcript_labels.bcc') %>:`
- l. 36: `<p>Attachments:</p>` → `<p><%= t('conversations.reply.transcript_labels.attachments') %>:</p>`

Dodaj na górze pliku (l. 1) komentarz: `<%# KLIMABAZAR F-transkrypcja: etykiety i18n + daty w strefie/lokalizacji PL %>`

- [ ] **Step 4: Weryfikacja YAML**

Run: `docker compose exec -T rails ruby -ryaml -e "YAML.load_file('config/locales/pl.yml'); YAML.load_file('config/locales/en.yml'); puts 'YAML OK'"`
Expected: `YAML OK`

---

## Task 3: Daty po polsku, czas polski

**Files:**
- Modify: `config/locales/en.yml` (nowy `time.formats.transcript`)
- Modify: `config/locales/pl.yml` (nowy `time.formats.transcript`)
- Modify: `app/views/mailers/conversation_reply_mailer/conversation_transcript.html.erb:41-47`

- [ ] **Step 1: Dodaj format czasu do obu locale**

W `en.yml` i `pl.yml`, w sekcji `time:` → `formats:` (jeśli sekcja nie istnieje, dodaj ją na poziomie głównym locale, obok istniejących), dodaj:
```yaml
    time:
      formats:
        transcript: '%-d %b %Y, %H:%M'
```
(rails-i18n zapewnia `%b` po polsku dla `pl`; efekt PL: `15 sie 2026, 14:30`, EN: `15 Aug 2026, 14:30`)

- [ ] **Step 2: Podmień renderowanie daty w szablonie**

Zastąp l. 41-47:
```erb
      <p style="font-size: 90%; font-size: 90%;color: #899096;margin-top: -8px; margin-bottom: 0px;">
      <% if @inbox.timezone.present? %>
        <%= message.created_at.in_time_zone(@inbox.timezone).strftime('%b %d, %I:%M %p %Z') %>
      <% else %>
        <%= message.created_at.strftime('%b %d, %I:%M %p %Z') %>
      <% end %>
      </p>
```
na:
```erb
      <p style="font-size: 90%; font-size: 90%;color: #899096;margin-top: -8px; margin-bottom: 0px;">
      <%# KLIMABAZAR F-transkrypcja: data w lokalizacji PL + strefa skrzynki z fallbackiem Warsaw %>
      <% tz = @inbox.timezone.presence || 'Europe/Warsaw' %>
      <%= I18n.l(message.created_at.in_time_zone(tz), format: :transcript) %>
      </p>
```

- [ ] **Step 3: Weryfikacja YAML**

Run: `docker compose exec -T rails ruby -ryaml -e "YAML.load_file('config/locales/pl.yml'); YAML.load_file('config/locales/en.yml'); puts 'YAML OK'"`
Expected: `YAML OK`

---

## Task 4: Stopka „This email was sent by" po polsku

**Files:**
- Modify: `app/mailers/application_mailer.rb:54-63` (`liquid_locals`)
- Modify: `config/locales/en.yml`, `config/locales/pl.yml` (klucz stopki)
- Modify: `app/views/layouts/mailer/base.liquid:123`

- [ ] **Step 1: Dodaj klucz i18n stopki do obu locale**

W `en.yml` (poziom główny locale, np. obok istniejącej sekcji `mailers`/na końcu) dodaj:
```yaml
    mailer_footer:
      sent_by: 'This email was sent by'
```
W `pl.yml` analogicznie:
```yaml
    mailer_footer:
      sent_by: 'Ten e-mail został wysłany przez'
```
(jeśli sekcja `mailers:` już istnieje w tych plikach, umieść `footer.sent_by` w spójnym miejscu — sprawdź `grep -n "^  mailers:" config/locales/en.yml` i dopasuj)

- [ ] **Step 2: Udostępnij string w liquid przez `liquid_locals`**

W `application_mailer.rb`, w metodzie `liquid_locals` (l. 54), dodaj klucz do hasha `locals`:
```ruby
    locals = {
      global_config: GlobalConfig.get('BRAND_NAME', 'BRAND_URL'),
      action_url: @action_url,
      footer_sent_by: I18n.t('mailer_footer.sent_by') # KLIMABAZAR F-transkrypcja: stopka i18n
    }
```

- [ ] **Step 3: Użyj zmiennej w layoucie liquid**

W `base.liquid` l. 123 zamień `This email was sent by` na `{{ footer_sent_by }}`:
```liquid
                  {{ footer_sent_by }}
```

- [ ] **Step 4: Weryfikacja składni Ruby + YAML**

Run: `docker compose exec -T rails ruby -c app/mailers/application_mailer.rb && docker compose exec -T rails ruby -ryaml -e "YAML.load_file('config/locales/pl.yml'); puts 'OK'"`
Expected: `Syntax OK` + `OK`

---

## Task 5: Domyślna strefa Europe/Warsaw dla nowych skrzynek

**Files:**
- Create: `db/migrate/<timestamp>_change_inboxes_timezone_default_to_warsaw.rb`
- (schema.rb zaktualizuje się automatycznie po migracji)

- [ ] **Step 1: Wygeneruj migrację**

Run: `docker compose exec -T rails bundle exec rails generate migration ChangeInboxesTimezoneDefaultToWarsaw`
Expected: utworzony plik `db/migrate/<ts>_change_inboxes_timezone_default_to_warsaw.rb`

- [ ] **Step 2: Wpisz treść migracji**

Zastąp zawartość wygenerowanego pliku:
```ruby
class ChangeInboxesTimezoneDefaultToWarsaw < ActiveRecord::Migration[7.2]
  # KLIMABAZAR F-transkrypcja: nowe skrzynki domyslnie w strefie Europe/Warsaw
  def up
    change_column_default :inboxes, :timezone, from: 'UTC', to: 'Europe/Warsaw'
  end

  def down
    change_column_default :inboxes, :timezone, from: 'Europe/Warsaw', to: 'UTC'
  end
end
```

- [ ] **Step 3: Uruchom migrację na dev**

Run: `docker compose exec -T rails bundle exec rails db:migrate`
Expected: `ChangeInboxesTimezoneDefaultToWarsaw: migrated`

- [ ] **Step 4: Zweryfikuj default**

Run: `docker compose exec -T rails bundle exec rails runner "puts Inbox.new.timezone"`
Expected: `Europe/Warsaw`

---

## Task 6: Strefa istniejących skrzynek na dev

**Files:** brak (operacja na danych)

- [ ] **Step 1: Ustaw Europe/Warsaw na istniejących skrzynkach (dev)**

Run: `docker compose exec -T rails bundle exec rails runner "n = Inbox.where.not(timezone: 'Europe/Warsaw').update_all(timezone: 'Europe/Warsaw'); puts \"zaktualizowano: #{n}\""`
Expected: `zaktualizowano: <liczba>`

*(Analogiczny runner uruchomimy na PROD w fazie deployu — patrz sekcja Deploy.)*

---

## Task 7: Rejestr customizacji + commit

**Files:**
- Modify: `CUSTOMIZATIONS.md` (dodaj wiersz do „Rejestr zmian")

- [ ] **Step 1: Dodaj wpis do rejestru**

W `CUSTOMIZATIONS.md`, w tabeli „Rejestr zmian", dodaj wiersz:
```markdown
| `conversation_reply_mailer.rb` + `conversation_transcript.html.erb` + `base.liquid` + `application_mailer.rb` + `en/pl.yml` + migracja `inboxes.timezone` default (F-transkrypcja) | mail transkrypcji: subject = `[#id] tytuł wątku — e-mail rozmówcy` (fallback „Transkrypcja rozmowy" dla nie-email); etykiety (Od/Temat/Do/DW/UDW/Załączniki) i stopka przez i18n; daty `I18n.l` w strefie skrzynki (fallback Europe/Warsaw); nowe skrzynki domyślnie Europe/Warsaw + jednorazowy runner na istniejące | mail po polsku, czytelny subject; spójna strefa PL | średnia (mailer/szablon/layout współdzielony) — grep `KLIMABAZAR F-transkrypcja` | dev: MailHog `localhost:8025` — subject, etykiety PL, data czasu polskiego, stopka PL; `Inbox.new.timezone == 'Europe/Warsaw'` |
```

- [ ] **Step 2: Commit całości feature**

```bash
git add app/mailers/conversation_reply_mailer.rb app/mailers/application_mailer.rb \
  app/views/mailers/conversation_reply_mailer/conversation_transcript.html.erb \
  app/views/layouts/mailer/base.liquid config/locales/en.yml config/locales/pl.yml \
  db/migrate/ db/schema.rb CUSTOMIZATIONS.md docs/klimabazar/F-transkrypcja-design.md docs/klimabazar/F-transkrypcja-plan.md
git commit --no-verify -m "feat(klimabazar): F-transkrypcja - subject z tytulem watku i emailem, PL etykiety/daty/stopka, strefa Warsaw"
```

---

## Task 8: Weryfikacja na dev (MailHog)

**Files:** brak

- [ ] **Step 1: Wyślij transkrypcję rozmowy e-mail (konsola)**

Run:
```
docker compose exec -T rails bundle exec rails runner "c = Conversation.joins(:inbox).where(inboxes: {inbox_type: 'Email'}).first || Conversation.first; ConversationReplyMailer.with(account: c.account).conversation_transcript(c, 'test@klimabazar.pl').deliver_now; puts \"wyslano dla conv ##{c.display_id}\""`
```
Expected: `wyslano dla conv #<id>`

- [ ] **Step 2: Sprawdź w MailHog**

Otwórz `http://localhost:8025` → najnowszy mail. Zweryfikuj:
- subject: `[#<id>] <tytuł wątku> — <email>` (dla email) lub `[#<id>] Transkrypcja rozmowy` (dla nie-email)
- etykiety w treści po polsku (Od/Temat/Do/…)
- data wiadomości w formacie `15 sie 2026, 14:30` i w czasie polskim (nie UTC)
- stopka: „Ten e-mail został wysłany przez …"

- [ ] **Step 3: Sprawdź rozmowę nie-email (fallback subject)**

Run:
```
docker compose exec -T rails bundle exec rails runner "c = Conversation.joins(:inbox).where.not(inboxes: {inbox_type: 'Email'}).first; if c then ConversationReplyMailer.with(account: c.account).conversation_transcript(c, 'test@klimabazar.pl').deliver_now; puts \"nie-email conv ##{c.display_id}\" else puts 'brak rozmowy nie-email' end"`
```
Expected: mail w MailHog z subject `[#<id>] Transkrypcja rozmowy` (bez e-maila).

---

## Deploy (po weryfikacji dev)
1. Push → CI build `ghcr.io/adayet/chatwoot:<sha>` (obserwuj `gh run watch <id> -R adayet/chatwoot`).
2. `pg_dump` backup prod → `~/chatwoot-backups/2026-08-26-pre-transkrypcja.dump`.
3. Podmień tag obrazu w `/opt/chatwoot/docker-compose.yaml`, `docker compose pull rails sidekiq`.
4. `docker compose run --rm rails bundle exec rails db:migrate` (migracja default strefy).
5. `docker compose up -d`.
6. **Strefa istniejących skrzynek na prod:** `docker compose exec -T rails bundle exec rails runner "puts Inbox.where.not(timezone: 'Europe/Warsaw').update_all(timezone: 'Europe/Warsaw')"`.
7. Weryfikacja: `curl https://pomoc.klimabazar.pl/` = 200; wyślij transkrypcję testową na kontrolowany adres i sprawdź subject/PL/strefę; `Inbox.new.timezone == 'Europe/Warsaw'`.

## Self-review (spec coverage)
- Subject tytuł+email → Task 1 ✅
- Etykiety PL → Task 2 ✅
- Daty PL + czas polski → Task 3 ✅
- Stopka PL → Task 4 ✅
- Domyślna strefa nowych skrzynek → Task 5 ✅
- Strefa istniejących skrzynek → Task 6 (dev) + Deploy krok 6 (prod) ✅
- Wpis rejestru + commit → Task 7 ✅
- Weryfikacja → Task 8 ✅
