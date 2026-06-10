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
| (zmiany źródeł — dojdą w kolejnych planach) | — | — | — | — |

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
