# F7 — Raporty bez etykiet szumu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raporty (V2: overview/summary/timeseries oraz per agent/inbox/team) wykluczają rozmowy z etykietami szumu (`spam`, `kurier`, `marketplace`, `powiadomienia`), żeby auto-resolve/istnienie tych rozmów nie fałszowało metryk.

**Architecture:** Jeden współdzielony moduł (lista etykiet + podzapytanie id rozmów-szumu + dwa helpery owijające relacje) dołączany do dwóch ścieżek liczenia raportów: `ReportHelper` (overview/summary, dziedziczone też przez `V2::ReportBuilder`) i `Reports::RawDataSource` (timeseries + summary przez `Reports::DataSource`). Każde zapytanie do `reporting_events`/`conversations`/`messages` jest owijane wykluczeniem `where.not(... IN <noise subquery>)`. Wzorzec istnieje już w kodzie (`exclude_bot_handoffs`).

**Tech Stack:** Ruby on Rails, acts_as_taggable_on (`label_list`/`tagged_with`), gem `groupdate` (group_by_period).

**Spec/spike:** [F7-spike.md](F7-spike.md) (sekcja o wpływie na raporty). Etykiety zsynchronizowane z frontem `HIDDEN_LABELS` w `ChatList.vue`.

---

## Mapa plików
- Create: `app/services/concerns/report_noise_filter.rb` — moduł: stała `KLIMABAZAR_NOISE_LABELS`, `noise_conversation_ids`, `exclude_noise_events`, `exclude_noise_conversations`.
- Modify: `app/helpers/report_helper.rb` — `include ReportNoiseFilter` + owinięcie scope'ów (overview/summary; dziedziczy `V2::ReportBuilder`).
- Modify: `app/builders/v2/report_builder.rb` — owinięcie `live_conversations` (overview „otwarte/nieobsłużone").
- Modify: `app/services/reports/raw_data_source.rb` — `include ReportNoiseFilter` + owinięcie scope'ów (timeseries + summary).

Uwaga: `bot_resolutions`/`bot_handoffs`/`bot_metrics_builder` i `label_summary_builder` zostają nietknięte (brak botów; raport per-etykieta z definicji dotyczy konkretnej etykiety).

---

### Task 1: Współdzielony moduł `ReportNoiseFilter`

**Files:**
- Create: `app/services/concerns/report_noise_filter.rb`

- [ ] **Step 1: Utwórz moduł**

```ruby
# KLIMABAZAR F7: wykluczanie rozmow z etykietami szumu z raportow.
# Lista zsynchronizowana z frontem (HIDDEN_LABELS w ChatList.vue).
module ReportNoiseFilter
  KLIMABAZAR_NOISE_LABELS = %w[spam kurier marketplace powiadomienia].freeze

  # Podzapytanie: id rozmow konta majacych dowolna z etykiet szumu.
  def noise_conversation_ids
    @noise_conversation_ids ||=
      account.conversations
             .tagged_with(KLIMABAZAR_NOISE_LABELS, any: true)
             .reorder(nil)
             .select(:id)
  end

  # Owija relacje liczace po conversation_id (reporting_events, messages).
  def exclude_noise_events(relation)
    relation.where.not(conversation_id: noise_conversation_ids)
  end

  # Owija relacje conversations (wyklucza po id).
  def exclude_noise_conversations(relation)
    relation.where.not(id: noise_conversation_ids)
  end
end
```

- [ ] **Step 2: Sanity-check ładowania (autoload)**

Run: `docker compose exec -T rails bundle exec rails runner "puts ReportNoiseFilter::KLIMABAZAR_NOISE_LABELS.inspect"`
Expected: `["spam", "kurier", "marketplace", "powiadomienia"]`

- [ ] **Step 3: Commit**

```bash
git add app/services/concerns/report_noise_filter.rb
git commit -m "feat(klimabazar): F7 modul ReportNoiseFilter (wykluczanie etykiet szumu z raportow)"
```

---

### Task 2: `ReportHelper` — owinięcie scope'ów (overview/summary)

**Files:**
- Modify: `app/helpers/report_helper.rb`

- [ ] **Step 1: Dołącz moduł** (po `module ReportHelper`)

```ruby
module ReportHelper
  include ReportNoiseFilter # KLIMABAZAR F7
  private
```

- [ ] **Step 2: Owiń scope'y rozmów/wiadomości** (l. 43–57)

```ruby
  def conversations
    exclude_noise_conversations(
      scope.conversations.where(account_id: account.id, created_at: range)
    )
  end

  def incoming_messages
    exclude_noise_events(
      scope.messages.where(account_id: account.id, created_at: range).incoming.unscope(:order)
    )
  end

  def outgoing_messages
    exclude_noise_events(
      scope.messages.where(account_id: account.id, created_at: range).outgoing.unscope(:order)
    )
  end

  def resolutions
    exclude_noise_events(
      scope.reporting_events.where(account_id: account.id, name: :conversation_resolved, created_at: range)
    )
  end
```

- [ ] **Step 3: Owiń timeseries avg/ reply** (l. 73–92)

```ruby
  def avg_first_response_time
    grouped_reporting_events = get_grouped_values(
      exclude_noise_events(scope.reporting_events.where(name: 'first_response', account_id: account.id))
    )
    return grouped_reporting_events.average(:value_in_business_hours) if params[:business_hours]

    grouped_reporting_events.average(:value)
  end

  def reply_time
    grouped_reporting_events = get_grouped_values(
      exclude_noise_events(scope.reporting_events.where(name: 'reply_time', account_id: account.id))
    )
    return grouped_reporting_events.average(:value_in_business_hours) if params[:business_hours]

    grouped_reporting_events.average(:value)
  end

  def avg_resolution_time
    grouped_reporting_events = get_grouped_values(
      exclude_noise_events(scope.reporting_events.where(name: 'conversation_resolved', account_id: account.id))
    )
    return grouped_reporting_events.average(:value_in_business_hours) if params[:business_hours]

    grouped_reporting_events.average(:value)
  end
```

- [ ] **Step 4: Owiń summary avg** (l. 94–130)

```ruby
  def avg_resolution_time_summary
    reporting_events = exclude_noise_events(
      scope.reporting_events.where(name: 'conversation_resolved', account_id: account.id, created_at: range)
    )
    avg_rt = if params[:business_hours].present?
               reporting_events.average(:value_in_business_hours)
             else
               reporting_events.average(:value)
             end
    return 0 if avg_rt.blank?

    avg_rt
  end

  def reply_time_summary
    reporting_events = exclude_noise_events(
      scope.reporting_events.where(name: 'reply_time', account_id: account.id, created_at: range)
    )
    reply_time = params[:business_hours] ? reporting_events.average(:value_in_business_hours) : reporting_events.average(:value)
    return 0 if reply_time.blank?

    reply_time
  end

  def avg_first_response_time_summary
    reporting_events = exclude_noise_events(
      scope.reporting_events.where(name: 'first_response', account_id: account.id, created_at: range)
    )
    avg_frt = if params[:business_hours].present?
                reporting_events.average(:value_in_business_hours)
              else
                reporting_events.average(:value)
              end
    return 0 if avg_frt.blank?

    avg_frt
  end
```

> `bot_resolutions`/`bot_handoffs` — bez zmian (brak botów; nieistotne).

- [ ] **Step 5: Lint**

Run: `eval "$(rbenv init -)" && bundle exec rubocop -a app/helpers/report_helper.rb app/services/concerns/report_noise_filter.rb`
Expected: brak offensów (lub auto-poprawione).

- [ ] **Step 6: Commit**

```bash
git add app/helpers/report_helper.rb
git commit -m "feat(klimabazar): F7 ReportHelper wyklucza etykiety szumu (overview/summary)"
```

---

### Task 3: `V2::ReportBuilder#live_conversations` — overview „otwarte/nieobsłużone"

**Files:**
- Modify: `app/builders/v2/report_builder.rb:129-138`

> `V2::ReportBuilder` `include ReportHelper` (l.3), więc `exclude_noise_conversations` jest już dostępne po Task 2.

- [ ] **Step 1: Owiń `live_conversations`**

```ruby
  def live_conversations
    @open_conversations = exclude_noise_conversations(
      scope.conversations.where(account_id: @account.id)
    ).open
    metric = {
      open: @open_conversations.count,
      unattended: @open_conversations.unattended.count
    }
    metric[:unassigned] = @open_conversations.unassigned.count if params[:type].equal?(:account)
    metric[:pending] = @open_conversations.pending.count if params[:type].equal?(:account)
    metric
  end
```

- [ ] **Step 2: Lint + Commit**

```bash
eval "$(rbenv init -)" && bundle exec rubocop -a app/builders/v2/report_builder.rb
git add app/builders/v2/report_builder.rb
git commit -m "feat(klimabazar): F7 overview (live_conversations) wyklucza etykiety szumu"
```

---

### Task 4: `Reports::RawDataSource` — timeseries + summary (V2 DataSource)

**Files:**
- Modify: `app/services/reports/raw_data_source.rb`

- [ ] **Step 1: Dołącz moduł** (na górze klasy)

```ruby
class Reports::RawDataSource < Reports::DataSource
  include ReportNoiseFilter # KLIMABAZAR F7
```

- [ ] **Step 2: Owiń `average_scope`** (l. 62–64)

```ruby
  def average_scope
    exclude_noise_events(
      scope.reporting_events.where(name: raw_event_name, created_at: range, account_id: account.id)
    )
  end
```

- [ ] **Step 3: Owiń `count_scope`** (l. 66–77)

```ruby
  def count_scope
    case metric.to_s
    when 'conversations_count'
      exclude_noise_conversations(scope.conversations.where(account_id: account.id, created_at: range))
    when 'incoming_messages_count'
      exclude_noise_events(scope.messages.where(account_id: account.id, created_at: range).incoming.unscope(:order))
    when 'outgoing_messages_count'
      exclude_noise_events(scope.messages.where(account_id: account.id, created_at: range).outgoing.unscope(:order))
    else
      reporting_event_count_scope
    end
  end
```

- [ ] **Step 4: Owiń `reporting_event_count_scope`** (l. 79–90) — wyklucz szum na wejściu, reszta logiki bez zmian

```ruby
  def reporting_event_count_scope
    events = exclude_noise_events(
      scope.reporting_events.where(
        name: raw_event_name,
        account_id: account.id,
        created_at: range
      )
    )

    return events.where.not(conversation_id: bot_handoff_conversation_ids_subquery) if raw_count_strategy == :exclude_bot_handoffs
    return events unless raw_count_strategy == :distinct_conversation

    events.joins(:conversation).select(:conversation_id).distinct
  end
```

- [ ] **Step 5: Owiń `summary_scope` i `summary_conversation_counts`** (l. 100–112)

```ruby
  def summary_scope
    scope = exclude_noise_events(account.reporting_events.where(created_at: range))
    return scope.joins(:conversation) if dimension_type == 'team'

    scope
  end

  def summary_conversation_counts
    exclude_noise_conversations(account.conversations.where(created_at: range))
      .group(summary_conversation_group_by_key)
      .count
  end
```

> Uwaga: w `summary_scope` lokalna zmienna `scope` przesłania metodę `scope` (jak w oryginale) — zachowujemy zachowanie.

- [ ] **Step 6: Lint + Commit**

```bash
eval "$(rbenv init -)" && bundle exec rubocop -a app/services/reports/raw_data_source.rb
git add app/services/reports/raw_data_source.rb
git commit -m "feat(klimabazar): F7 RawDataSource wyklucza etykiety szumu (timeseries+summary)"
```

---

### Task 5: Weryfikacja na lokalnym devie

**Files:** brak (weryfikacja manualna; specy pomijamy zgodnie z CLAUDE.md — patrz „Opcjonalnie")

- [ ] **Step 1: Dane testowe — rozmowa szumu z resolve w oknie raportu**

Run:
```bash
docker compose exec -T rails bundle exec rails runner "
acc = Account.first
c = acc.conversations.find_by(display_id: 7) # Piotr
c.add_labels(['spam']) unless c.label_list.include?('spam')
c.update!(status: :resolved)
puts 'spam conv: status=' + c.reload.status + ' labels=' + c.label_list.to_s
"
```
(Jeśli `display_id 7` nie ma etykiety `spam`, najpierw `c.add_labels(['spam'])`.)

- [ ] **Step 2: Porównaj metryki z/bez wykluczenia (konsola)**

Run:
```bash
docker compose exec -T rails bundle exec rails runner "
acc = Account.first
p = { type: :account, since: 1.month.ago.to_i.to_s, until: Time.now.to_i.to_s, metric: 'resolutions_count', group_by: 'week' }
b = V2::ReportBuilder.new(acc, p)
puts 'resolutions_count summary: ' + b.summary[:resolutions_count].to_s
puts 'conversations_count summary: ' + b.summary[:conversations_count].to_s
"
```
Expected: liczby **nie** uwzględniają rozmów z etykietami szumu (np. rozwiązany spam nie dolicza się do `resolutions_count`).

- [ ] **Step 3: UI — Raporty → Przegląd / Rozmowy**

Otwórz `http://localhost:3001` → Raporty. Sprawdź, że „rozwiązane"/„utworzone" oraz średni czas rozwiązania nie skaczą przez rozmowy szumu (porównaj z liczbą rozmów oznaczonych szumem).

- [ ] **Step 4: Regresja — czy istniejące specy raportów przechodzą**

Run: `eval "$(rbenv init -)" && bundle exec rspec spec/helpers/report_helper_spec.rb spec/services/reports 2>/dev/null || echo 'brak/zielono'`
Expected: brak nowych czerwonych (zmiana dodaje tylko wykluczenie; jeśli specy zakładają liczby bez etykiet — zielono).

---

## Po wdrożeniu — CUSTOMIZATIONS.md + uwagi
- Dodać wpisy do rejestru: `report_noise_filter.rb` (nowy), `report_helper.rb`, `report_builder.rb`, `raw_data_source.rb` — z adnotacją **„backend-fork: czulszy przy mergach upstreamu (raporty bywają przebudowywane)"**.
- Lista etykiet w 2 miejscach (`ChatList.vue HIDDEN_LABELS` i `ReportNoiseFilter::KLIMABAZAR_NOISE_LABELS`) — trzymać w synchronizacji.
- Backfill nie dotyczy (wykluczenie liczone na bieżąco z taggings).

## Opcjonalnie (poza zakresem, jeśli poprosisz)
- RSpec dla `ReportNoiseFilter` + `ReportHelper`/`RawDataSource` (logika backendowa — spec zalecany, ale wg CLAUDE.md „avoid specs unless asked" pominięty domyślnie).
