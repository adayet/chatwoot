# Pełne pokrycie pl — Dashboard — Design

Status: zatwierdzony 2026-06-11. Następny krok: plan implementacji (writing-plans).

## Cel

Doprowadzić polskie tłumaczenie panelu agenta (Dashboard) do pełnego pokrycia. Dziś realne pokrycie ~53%: na 5647 kluczy string en, 2997 przetłumaczone, **64 brakuje** w pl, **2586 ma wartość identyczną z angielską** (nieprzetłumaczone). Cel: uzupełnić braki i nieprzetłumaczone — z wyłączeniem nazw własnych, które celowo zostają po angielsku.

## Zakres

- **W zakresie:** `app/javascript/dashboard/i18n/locale/pl/*.json` (44 pliki).
- **Poza zakresem:** backend `config/locales/pl.yml` (maile/powiadomienia), widget (`app/javascript/widget/i18n/locale/pl.json`), survey (już 100%), rebranding „Chatwoot"→„Klimabazar" w stringach.

## Reguły tłumaczenia

1. **Nazwy własne zostają po EN** — nazwy produktów/integracji (Slack, Dialogflow, Dyte, Shopify, Webhooks, API, SDK, OAuth, CSV, URL, ID, HTML, CSAT itp.), marka „Chatwoot".
2. **Placeholdery nienaruszone** — `{zmienna}`, `%{zmienna}`, `{count}`, linki vue-i18n `@:KLUCZ`, tagi HTML, markdown, znaki ucieczki. Zbiór placeholderów w tłumaczeniu pl MUSI być identyczny jak w en (poza segmentami liczby mnogiej — patrz niżej).
3. **Liczba mnoga (PL)** — vue-i18n używa segmentów oddzielonych `|`. Angielskie 2 formy (`singular | plural`) → polskie **3** formy (`jeden | kilka | wiele`) wg fleksji: 1 → forma „jeden"; 2–4 (oprócz 12–14) → „kilka"; 0, 5+, 12–14 → „wiele". Każdy segment zachowuje placeholdery.
4. **Ton** — bezosobowy/tryb rozkazujący dla UI (Zapisz, Anuluj, Usuń), spójny z istniejącymi tłumaczeniami.
5. **Zachowanie istniejących** — klucze już przetłumaczone (pl != en) zostają nietknięte; uzupełniamy tylko brakujące i te z pl == en (o ile nie są nazwą własną).

## Glosariusz (zakotwiczony w istniejących pl)

Inbox→Skrzynka odbiorcza · Conversation→Rozmowa · Contact→Kontakt · Label→Etykieta · Team→Zespół · Settings→Ustawienia · Agent→Agent · Status→Status · Assignee→Przypisany · Macro→Makro · Report→Raport · Campaign→Kampania · Cancel→Anuluj · Delete→Usuń · Edit→Edytuj · Save→Zapisz · Create→Utwórz · Search→Szukaj · Name→Imię (osoba) / Nazwa (rzecz) · Email→E-mail. Pełny glosariusz wyprowadzany ze wszystkich istniejących pl, żeby nie tworzyć rozjazdów terminologicznych.

## Kolejność plików (priorytet = częstość użycia przez agenta)

1. **Wysoki:** conversation, inbox, inboxMgmt, contact, report, generalSettings, agentMgmt, label, teamsSettings, automation, macros, cannedMgmt, snooze, sla, notification, login.
2. **Średni:** settings, helpCenter, campaign, customRole, companies, mfa, integrations-app (bez nazw własnych).
3. **Niski:** integrations (głównie nazwy własne — mało tekstu), pozostałe drobne pliki.

## Proces na plik

1. Wczytaj `en/<plik>` i `pl/<plik>`.
2. Dla każdego klucza: jeśli brak w pl LUB pl == en (i nie jest nazwą własną) → przetłumacz; w przeciwnym razie zostaw istniejące pl.
3. Zachowaj strukturę, placeholdery, segmenty liczby mnogiej (3 formy dla nowych).
4. Zapisz `pl/<plik>`.
5. Uruchom kontrolę QA (niżej).
6. Commit.

## Kontrola QA (skrypt, przed każdym commitem)

Skrypt porównujący `en/<plik>` z `pl/<plik>`:
- (a) **Parytet kluczy** — pl zawiera wszystkie klucze en (0 braków).
- (b) **Integralność placeholderów** — dla każdego klucza zbiór `{...}` / `%{...}` / `@:...` w pl (suma po segmentach mnogiej) == zbiór w en. Łapie zgubione zmienne i zepsute formy mnogie.
- (c) **Poprawny JSON** (parsowanie).

Plik commitowany dopiero po przejściu (a)+(b)+(c). Specy jednostkowe pomijamy (CLAUDE.md) — ten skrypt jest właściwą kontrolą dla tłumaczeń.

## Kruchość przy mergach upstreamu

Edycja `pl/*.json` to odejście od upstreamowego Crowdina → **wysokie ryzyko konfliktów** przy każdym wciąganiu upstreamu; `pl` staje się de facto własnością forka. Mitigacja: wpis do `CUSTOMIZATIONS.md`; przy mergu brać wersję forka dla `pl/*.json` i ewentualnie dolać nowe klucze z upstreamu (a potem przetłumaczyć). Świadomy koszt pełnego pokrycia teraz.

## Commit

Po każdym pliku: `i18n(klimabazar): pl <plik> — pełne tłumaczenie`. Możliwość przerwania po obszarze „Wysoki" z najważniejszymi ekranami pokrytymi.

## Build/deploy

Front (vue-i18n). Żeby trafiło na prod: push → build CI → deploy (sygnał właściciela). Brak migracji.
