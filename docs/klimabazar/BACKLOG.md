# Klimabazar Chatwoot — backlog featurów

Status na 2026-06-10. Każdy feature przechodzi cykl: brainstorming → spec → plan → implementacja (osobno).
Zasada **sidecar-first**: co da się zrobić jako sidecar / feature-flag / custom-attribute / ustawienie / inicjalizator-wolumen → NIE wchodzi do forka.

## Tabela

| # | Feature | Gdzie żyje | Ryzyko konfliktów upstream | Zależności / uwagi |
|---|---|---|---|---|
| **F1** | ✅ **ZROBIONE** — Kolejność zakładek „Rozmowy": Wszystkie → Moje → Nieprzypisane + domyślnie „Wszystkie" | Fork — front (Vue) | Niskie | `ChatList.vue` (`ASSIGNEE_TAB_ORDER`) |
| **F2** | ✅ **ZROBIONE** — Agent (avatar + nazwa) przy statusie w prawym górnym rogu + podgląd 2 linijek | Fork — front (Vue) | Średnie (karta rozmowy) | `ConversationCard.vue`, `MessagePreview.vue` (prop `multiline`) |
| **F3** | ✅ **ZROBIONE** — Ukrycie modułów: Captain (front), Kampanie/Raporty (flaga konta) | Captain: fork `Sidebar.vue`; Kampanie/Raporty: flagi `campaigns`/`reports` (Super Admin → Features) | Niskie | Captain znika z nav; Kampanie po wyłączeniu flagi konta |
| **F4** | Integracja **wFirma** (po NIP: faktury, suma sprzedaży, zaległości) | **Sidecar** (FastAPI) + NIP jako custom attribute (natywnie) + wyświetlanie (patrz F5) | Backend: zero forka | **Zależność: dostęp do API wFirma** (token). Największy item |
| **F5** | BaseLinker + wFirma jako **natywne sekcje w prawym panelu Kontakt** (zamiast iframe Dashboard App) | Fork — front (Vue) | Średnie (panel kontaktu) | Wspólna infra dla BL i wFirma — budujemy raz. Dane dalej z sidecarów |
| **F6** | ✅ **ZROBIONE** — Wątki „rozwiązane": nie znikają (domyślny filtr=Wszystkie), status na pasku+chip, wracają po odpowiedzi (reopen działa natywnie) | F6b front | — | Spec/plan: `F6-design.md`, `F6-plan.md`. Deploy po 16:00 (sha `8d0eade16`) |
| **F7** | ✅ **ZROBIONE** — Foldery/filtrowanie marketplace+spam | **Natywnie** (właściciel): reguły automatyzacji `email`→`add_label` + foldery/widoki etykiet. **+ mały fork (Droga B):** domyślna lista wyklucza etykietę `spam` (znika z „Rozmowy", zostaje w `#spam`) | niska | `F7-spike.md`; fork w `ChatList.vue` (`HIDDEN_LABELS`) |
| **F9** | ✅ **ZROBIONE (czeka na deploy)** — Domyślne sortowanie listy po ostatniej realnej wiadomości (nie `last_activity_at`); wybieralne w dropdownie; wymuszone na wszystkich (reset `ui_settings` przy deployu) | Fork — backend (scope+finder) + front (komparator/dropdown) + i18n | Średnie (sort/finder + kilka plików front) | Spec/plan: `F9-sort-last-message-*.md`. Bez migracji |
| **F8** | ✅ **WDROŻONE (2026-06-11, `56b1b1734`)** — Karta rozmowy: badge = liczba realnych wiadomości w wątku (zamiast nieprzeczytanych); data = czas ostatniej realnej wiadomości (zamiast `last_activity_at`) | Fork — backend (serializer listy, 2 pola przez scope `Message.chat`) + front (obie karty + nowy `MessageCountBadge`) | Średnie (karty + jbuilder) | Spec/plan: `F8-card-meta-design.md` / `F8-card-meta-plan.md`. Backend → deploy przez CI |
| **F-rozw** | ✅ **ZROBIONE (kod, czeka na deploy)** — Zakładki „Rozwiązane"/„Nierozwiązane" w rzędzie listy (obok Wszystkie/Moje/Nieprzypisane), z licznikiem rozmów | Fork — front (Vue) + 1 linia backendu (finder `unresolved`) | Średnie (rząd zakładek `ChatList`) | Spec/plan: `F-rozw-resolved-tabs-*.md` |

## Postęp (2026-06-11)
**WDROŻONE NA PROD 2026-06-11** (obraz `56b1b1734`, deploy po 16:00): ~~**F1**~~ ✅, ~~**F2**~~ ✅, ~~**F3**~~ ✅, ~~**F6**~~ ✅, ~~**F7**~~ ✅ (front, Droga B), ~~**F8**~~ ✅. Backup bazy `2026-06-11-pre-F8.dump`. Brak migracji.

- **F3** — Captain ukryty frontem (`Sidebar.vue`, `KLIMABAZAR_HIDDEN_SIDEBAR`); Kampanie/Raporty = flaga konta `campaigns`/`reports` (Super Admin → Features, bez forka; Raporty wyłączone na prod).
- **F8** — karta rozmowy: badge = liczba realnych wiadomości (scope `Message.chat`, gdy >1), data = czas ostatniej realnej wiadomości (single `TimeAgo`). Backend (serializer, 2 pola) + front (obie karty + `MessageCountBadge`).
- **F7-raporty** (backend, wykluczanie szumu z metryk) — zaimplementowane i **cofnięte** na życzenie właściciela (zrezygnacja ze statystyk; Raporty ukryte flagą). Plan zostaje: `F7-reports-plan.md`.

Zostało:
- **F4** — integracja wFirma (sidecar; zależy od dostępu do API wFirma)
- **F5** — natywny panel Kontakt (BaseLinker + wFirma) zamiast iframe

## Co realnie dotyka forka
Tylko F1, F2, F5 oraz F6b. F4 (backend), F3 i F7 (w dużej części) oraz prawdopodobnie F6a idą **bez forka** → bez konfliktów przy aktualizacjach Chatwoota.

## Stan środowiska (referencja)
- Produkcja: `v4.14.1`, obraz z forka `ghcr.io/adayet/chatwoot:<sha>`, serwer Hetzner `/opt/chatwoot`.
- 9 inboxów e-mailowych, 0 aktywnych botów, Postgres `chatwoot_production` (281 open / 51 resolved).
- Dostęp/operacje serwerowe i pętla deploy: patrz `CLAUDE.local.md` w korzeniu forka (lokalny, niecommitowany).
