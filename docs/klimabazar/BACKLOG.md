# Klimabazar Chatwoot — backlog featurów

Status na 2026-06-10. Każdy feature przechodzi cykl: brainstorming → spec → plan → implementacja (osobno).
Zasada **sidecar-first**: co da się zrobić jako sidecar / feature-flag / custom-attribute / ustawienie / inicjalizator-wolumen → NIE wchodzi do forka.

## Tabela

| # | Feature | Gdzie żyje | Ryzyko konfliktów upstream | Zależności / uwagi |
|---|---|---|---|---|
| **F1** | Kolejność zakładek „Rozmowy": Wszystkie → Moje → Nieprzypisane | Fork — front (Vue) | Niskie | Dobry pierwszy „rozgrzewkowy" na pełnej pętli build→deploy |
| **F2** | Kolorowanie agentów na listingu (każdy inny kolor) + podgląd 2 linijek wiadomości | Fork — front (Vue) | Średnie (komponent karty rozmowy) | Deterministyczny schemat kolorów (hash z ID/nazwy agenta) |
| **F3** | Ukrycie modułów: Captain, Kampanie, (ew. Raporty) | Najpierw feature-flagi/config; residuum → front | Niskie | **Spike:** co wyłączysz w Super Admin → Features, a co trzeba ukryć w nawigacji |
| **F4** | Integracja **wFirma** (po NIP: faktury, suma sprzedaży, zaległości) | **Sidecar** (FastAPI) + NIP jako custom attribute (natywnie) + wyświetlanie (patrz F5) | Backend: zero forka | **Zależność: dostęp do API wFirma** (token). Największy item |
| **F5** | BaseLinker + wFirma jako **natywne sekcje w prawym panelu Kontakt** (zamiast iframe Dashboard App) | Fork — front (Vue) | Średnie (panel kontaktu) | Wspólna infra dla BL i wFirma — budujemy raz. Dane dalej z sidecarów |
| **F6** | ✅ **ZROBIONE** — Wątki „rozwiązane": nie znikają (domyślny filtr=Wszystkie), status na pasku+chip, wracają po odpowiedzi (reopen działa natywnie) | F6b front | — | Spec/plan: `F6-design.md`, `F6-plan.md`. Deploy po 16:00 (sha `8d0eade16`) |
| **F7** | Foldery/filtrowanie spamu z marketplace (Allegro, ERLI…) | Najpierw natywne Custom Views / Inboxy; residuum → automatyzacje | Niskie–średnie | **Spike:** jak wpadają powiadomienia marketplace (osobne inboxy są już: allegro@, erli@) |

## Kolejność (wybór właściciela 2026-06-11)
1. ~~**F6** — resolved behavior~~ ✅ ZROBIONE (deploy po 16:00)
2. **F1** — reorder zakładek ← następny
3. **F2** — kolory agentów + 2 linijki
4. **F7** — foldery/spam marketplace
- Później (nieuszeregowane): F3 (ukrycie modułów), F5+F4 (panel Kontakt + wFirma)

## Co realnie dotyka forka
Tylko F1, F2, F5 oraz F6b. F4 (backend), F3 i F7 (w dużej części) oraz prawdopodobnie F6a idą **bez forka** → bez konfliktów przy aktualizacjach Chatwoota.

## Stan środowiska (referencja)
- Produkcja: `v4.14.1`, obraz z forka `ghcr.io/adayet/chatwoot:<sha>`, serwer Hetzner `/opt/chatwoot`.
- 9 inboxów e-mailowych, 0 aktywnych botów, Postgres `chatwoot_production` (281 open / 51 resolved).
- Dostęp/operacje serwerowe i pętla deploy: patrz `CLAUDE.local.md` w korzeniu forka (lokalny, niecommitowany).
