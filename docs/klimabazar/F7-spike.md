# F7 — Spike: foldery / filtrowanie spamu i marketplace

**Cel:** odseparować szum (marketplace, kurierzy, spam, dostawcy) od realnych zapytań klientów na liście rozmów.

Read-only diagnostyka prod 2026-06-11.

## Wniosek główny
**F7 wykonalne w 100% natywnie — BEZ forka i BEZ sidecara.** Chatwoot ma:
- warunek automatyzacji **`email`** (domena/adres nadawcy) oraz **`content`** (treść wiadomości),
- akcje: **`add_label`**, **`resolve_conversation`**, **`mute_conversation`**, **`snooze_conversation`**, **`assign_team`**, `send_webhook_event`,
- natywne **Custom Views** (zapisane filtry po etykietach/inboxie/statusie).

Czyli: reguły automatyzacji klasyfikują po domenie nadawcy → etykieta (+ ew. auto-resolve), a Custom Views robią foldery. Implementacja = **konfiguracja na serwerze** (UI/API), nie kod forka.

## Klasyfikacja (dane prod)

### Domeny nadawców per inbox (najczęstsze)
- **allegro@**: `allegro.pl` (111), `allegromail.pl` (26), `paczkomaty.pl` (5) — ~100% marketplace/kurier.
- **erli@**: `mail.erli.pl` (25), `erli.pl` (21) — ~100% ERLI.
- **kontakt@**: `furgonetka.pl` (14, kurier), `olx.pl` (4), `info.kaufland-marketplace.com` (2), `sprawdz-regulamin.pl` (2, spam).
- **sklep@**: `gmail.com` (15, realni klienci), `fast-hosting.mom` (9, spam), `paczkomaty.pl`/`gls-poland.com.pl` (kurierzy), `sprawdz-regulamin.pl` (3, spam), `alibaba-inc.com` (3, cold), dostawcy (arpol-tools, carbolinepolska, aeroexpert…).
- **finanse@**: dostawcy (`thermosilesia.pl`, `iglotech.com`, `caldo-wentylacja.pl`), kurierzy (`dpd.com.pl`, `dhl.com`), `base.com` (newsletter analytics).
- **dostawy@**: dostawcy + własna domena.

### Kategorie wg tematów
| Kategoria | Przykładowe tematy | Sygnał (domena) |
|---|---|---|
| **Marketplace** | „sprzedano przedmioty na erli.pl", „wiadomości dotyczące ogłoszeń", „dyskusja - nowa wiadomość od client", „nowe zamówienie: NNN" | allegro.pl, allegromail.pl, erli.pl, mail.erli.pl, kaufland-marketplace.com, olx.pl |
| **Kurierzy** (FYI, bez odpowiedzi) | „kurier inpost – kod do odbioru", „powiadomienie o zmianie statusu przesyłki", „potwierdzenie doręczenia zwrotu" | paczkomaty.pl, inpost, dpd.com.pl, dhl.com, gls-poland.com.pl, furgonetka.pl |
| **Spam / cold / marketing** | „⚠️ przypomnienie: zaktualizuj regulamin", „base analytics: spadek sprzedaży", „podsumowanie X dnia targów", „odkryj najnowszą innowację" | sprawdz-regulamin.pl, fast-hosting.mom, alibaba-inc.com, warsawexpo.eu, base.com |
| **Dostawcy / finanse** | „proforma do zamówienia", „potwierdzenie wysłania przelewu", „przypomnienie o terminie płatności", „thermosilesia - dokument sprzedaży" | thermosilesia.pl, iglotech.com, caldo-wentylacja.pl, dpd/dhl |
| **Realni klienci** (zostawić!) | „zapytanie ofertowe", zwykłe maile z gmail itp. | gmail.com i domeny firm klientów |

## Proponowany kierunek (do brainstormu)
1. **Reguły automatyzacji** (on conversation created), match po `email` (domena):
   - kurierzy → label `kurier` + `resolve_conversation` (czysto informacyjne, bez odpowiedzi).
   - spam/cold → label `spam` + `resolve` lub `mute`.
   - marketplace → label `marketplace` (NIE auto-resolve — kupujący piszą realnie).
   - dostawcy/finanse → label `dostawcy` (do decyzji: resolve czy nie).
2. **Custom Views** (foldery): „Klienci" = bez etykiet kurier/spam/marketplace; osobno „Marketplace", „Kurierzy", „Spam".
3. **Ryzyko false-positive** na realnych klientach — domeny kurierów/spamu są charakterystyczne (niskie ryzyko); auto-resolve tylko dla pewnych kategorii (kurier/spam), nie dla marketplace/dostawców.

## Pułapki / do ustalenia w brainstormie
- Które kategorie i jaka akcja per kategoria (label-only vs auto-resolve/mute).
- Czy `email` warunek wspiera operator „contains" (domena) — zweryfikować w UI automatyzacji.
- Subject-matching natywnie słabe (content = treść, nie temat) — ale domena nadawcy pokrywa większość przypadków.
- **Testować na lokalnym devie** (reguły + symulacja), dopiero potem ostrożnie na prod (ryzyko mislabel realnych klientów).
- Reguły działają od momentu włączenia (nie taguje wstecz) — ewentualny backfill osobno.

## Instrukcja samodzielnej konfiguracji (bez kodu, na koncie)

**Model:** „folder" = zapisany filtr (Custom View), nie fizyczny kontener. Reguła automatyzacji nadaje **etykietę**; folder pokazuje rozmowy z tą etykietą. „Auto-resolve" chowa z widoku „Otwarte", ale rozmowa zostaje (widoczna w folderze / przy filtrze „Wszystkie").

### A. Reguły (Ustawienia → Automatyzacja → Dodaj regułę)
- **Zdarzenie:** „Utworzono rozmowę".
- **Warunek:** `Email` **zawiera** `<domena>` (operator „zawiera"; dla kilku domen dodaj warunki z „LUB").
- **Akcje:** `Dodaj etykietę: <kategoria>` (+ opcjonalnie `Rozwiąż rozmowę` lub `Wycisz`).

Gotowe listy domen do wklejenia:
- **kurier** → `inpost`, `paczkomaty`, `dpd.com.pl`, `dhl`, `gls-poland`, `furgonetka` (+ ew. `Rozwiąż rozmowę`)
- **marketplace** → `allegro.pl`, `allegromail.pl`, `erli.pl`, `mail.erli.pl`, `kaufland-marketplace`, `olx.pl` (NIE auto-resolve — kupujący piszą realnie)
- **spam** → `sprawdz-regulamin.pl`, `fast-hosting.mom`, `alibaba-inc.com`, `warsawexpo.eu`, `base.com` (+ `Rozwiąż`/`Wycisz`)
- **dostawcy** → `thermosilesia.pl`, `iglotech.com`, `caldo-wentylacja.pl`, `carbolinepolska.pl`, `arpol-tools.com` (raczej tylko etykieta)

### B. Foldery (lista rozmów → ikona Filtr)
- Ustaw warunek (np. `Etykieta` = `kurier`) → zastosuj → **Zapisz jako folder** (nazwa np. „Kurierzy"). Folder pojawi się w lewym menu.
- „Klienci" (czysty widok): `Etykieta` **nie zawiera** `kurier`/`spam`/`marketplace` (jeśli operator „nie zawiera" dostępny dla etykiet).

### Do zweryfikowania w UI (1 rzecz)
- Czy warunek `Email` ma operator **„zawiera"** (do dopasowania po domenie). Jeśli tylko „równa się" — trzeba per pełny adres albo zgłoś, dobierzemy obejście.

### Zalecenie
Najpierw przetestować 1–2 reguły na **lokalnym devie** (lub na bezpiecznej kategorii typu „spam"), zanim włączysz na żywych inboxach — ryzyko mislabel realnego klienta.
