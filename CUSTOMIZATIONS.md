# Customizacje Klimabazar (fork chatwoot/chatwoot)

Fork: `adayet/chatwoot`, gałąź `klimabazar`. Przypięta do stabilnego tagu upstream
(start: **v4.14.1**, commit `d58b6a6`).
Build: GitHub Actions → `ghcr.io/adayet/chatwoot`. Serwer pobiera gotowy obraz (nie kompiluje).

## Reguła sidecar-first
Co da się zrobić jako sidecar / feature-flag / custom-attribute / inicjalizator-wolumen
→ NIE wchodzi do forka. Forkujemy głównie front Vue. Backendy danych (BaseLinker, wFirma)
żyją w osobnym repo `adayet/chatwoot-integrations`.

## Marker zmian
Każda edycja w źródłach oznaczona `KLIMABAZAR` (grep-owalne).

## Rejestr zmian
| Plik | Zmiana | Po co | Kruchość przy upgrade | Jak zweryfikować |
|---|---|---|---|---|
| `.github/workflows/build-image.yml` | nowy workflow build→GHCR | własny obraz bez kompilacji na prod | niska (plik własny) | run zielony, obraz w GHCR |
| `vite.config.ts` | env-gated `server.allowedHosts` (flaga `VITE_ALLOW_ALL_HOSTS`) | lokalny dev w Dockerze (Vite 5.4 blokuje Host `vite` → 403 → blank screen); no-op bez flagi, prod bez dev-servera | niska (no-op domyślnie) | `curl localhost:3001/vite-dev/@vite/client` = 200, dashboard renderuje |
| `ChatList.vue` (l.~76, ~365), `store/.../conversations/index.js` (l.~15) | domyślny filtr listy `OPEN` → `ALL` | F6: rozwiązane nie znikają z widoku | średnia (linie mogą się przesunąć — grep `KLIMABAZAR F6`) | wejście na listę → filtr „Wszystkie" |
| `composables/useConversationHandlingState.js` (nowy) | wspólna logika stanu obsługi (nowy/w toku/rozwiązane/uśpione/oczekujące) → klasy `n-*` | F6: jedno źródło prawdy dla obu kart listy | niska (plik własny) | jednostkowo: status+assignee+first_reply → stan |
| `ConversationCard.vue` (legacy/domyślny) + `components-next/.../ConversationCardExpanded.vue` | wariant C: neutralne tło; status = **prawy** pasek (osobny element absolutny, NIE border — bo reguła Chatwoota `[&>div:has(+ div .active)>*]:!border-n-surface-1` szarzy bordery wiersza nad aktywnym) + chip (prawy górny róg); active = **lewy** niebieski pasek (border-l) + tło slate-3; hover = slate-2 | F6: widać status, odróżnia nieobsłużone od obsługiwanych; lewa=active, prawa=status; obie karty | średnia (struktura kart) | Nowy=bez koloru, W toku=amber, Rozwiązane=teal, Oczekujące=ruby, Uśpione=slate; pasek statusu zachowany też nad aktywnym wierszem |
| `ChatList.vue` (F1) | kolejność zakładek assignee: Wszystkie→Moje→Nieprzypisane (sort `ASSIGNEE_TAB_ORDER`) + domyślnie aktywna zakładka = Wszystkie | F1: właściciel chce widzieć całość od wejścia | niska (1 plik) | zakładki w tej kolejności; po wejściu aktywna „Wszystkie" |
| `ChatList.vue` (F7, Droga B) | domyślna lista wyklucza rozmowy z etykietami `HIDDEN_LABELS` (`['spam']`); pomija gdy folder/filtr/widok-etykiety (`props.label`) | F7: spam znika z domyślnego widoku (po F6 „rozwiąż" już nie chowa), ale zostaje dostępny w `#spam`/folderze/szukajce | niska–średnia (computed `conversationList`); licznik zakładki nieskorygowany (kosmetyka) | rozmowa z `spam` znika z „Rozmowy", widoczna w widoku etykiety `#spam` |
| `ConversationCard.vue` + `MessagePreview.vue` (F2) | F2: agent (avatar + neutralna nazwa) przeniesiony do prawego górnego rogu, na lewo od chipu statusu, oddzielony kropką; podgląd wiadomości w 2 liniach (prop `multiline` w MessagePreview, domyślnie 1 — bez wpływu na inne użycia) | „kto prowadzi" przy statusie + więcej kontekstu wiadomości | średnia (karta + współdzielony MessagePreview) | agent z avatarem • chip w prawym górnym rogu; podgląd do 2 linii |
| `i18n/locale/{en,pl}/chatlist.json` | blok `CHAT_LIST.HANDLING_STATE` (5 etykiet) | F6: etykiety badge; `pl` bo instalacja PL-only | niska | badge po polsku w UI |

## Cykl wciągania upstreamu
1. `git fetch upstream --tags`
2. Wybierz kolejny stabilny tag `vX.Y.Z` (NIE `develop`).
3. `git merge vX.Y.Z` do `klimabazar`; rozwiąż konflikty (grep `KLIMABAZAR`).
4. Build CI → test lokalny (Docker, parytet).
5. **Backup Postgresa** (`pg_dump -Fc chatwoot_production`), potem deploy: `pull → db:migrate → up -d`.
6. Po deployu sprawdź pozycje z kolumny „Jak zweryfikować" powyżej.

## Stan produkcji (referencja)
- Serwer: Hetzner `178.105.179.180` (Ubuntu 24.04, 4 GB RAM), deployment w `/opt/chatwoot`.
- Postgres: `pgvector/pgvector:pg16`, baza `chatwoot_production`, user `postgres`.
- Compose: serwis `base` (obraz dziedziczony przez `rails`/`sidekiq`), `postgres`, `redis`.
- Łatka wolumenowa: `patches/zz_html_signature.rb` (kolorowy podpis w mailach) — sprawdź log `patch applied`.

## Twarde reguły
- Nigdy `docker compose down -v`.
- `pg_dump` przed każdym deployem z migracją lub mergem upstreamu.
- Build tylko w CI — serwer 4 GB nie udźwignie kompilacji.
