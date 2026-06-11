# Pełne pokrycie pl — Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uzupełnić polskie tłumaczenia panelu agenta (`dashboard/i18n/locale/pl/*.json`) do pełnego pokrycia — braki + wartości identyczne z angielską — z wyłączeniem nazw własnych.

**Architecture:** Najpierw skrypt QA (parytet kluczy + integralność placeholderów + raport pokrycia). Potem plik po pliku wg priorytetu (częstość użycia przez agenta): tłumacz braki/nieprzetłumaczone wg glosariusza i reguł polskiej liczby mnogiej, uruchom QA, commit. Spec: [i18n-pl-coverage-design.md](i18n-pl-coverage-design.md).

**Tech Stack:** vue-i18n (JSON), Python3 (skrypt QA). Specy jednostkowe pomijamy (CLAUDE.md) — skrypt QA jest kontrolą.

---

## Reguły tłumaczenia (obowiązują w każdym pliku)

- **Nazwy własne zostają po EN:** Slack, Dialogflow, Dyte, Shopify, Webhooks, API, SDK, OAuth, CSV, URL, ID, HTML, CSAT, „Chatwoot" itp.
- **Placeholdery nienaruszone:** `{zmienna}`, `%{zmienna}`, `{count}`, linki `@:KLUCZ`, tagi HTML, markdown. Zbiór placeholderów w pl == w en.
- **Liczba mnoga PL:** vue-i18n `a | b` (2 formy en) → `jeden | kilka | wiele` (3 formy pl): 1 → „jeden"; 2–4 (poza 12–14) → „kilka"; 0/5+/12–14 → „wiele". Placeholdery w każdym segmencie.
- **Glosariusz:** Inbox→Skrzynka odbiorcza, Conversation→Rozmowa, Contact→Kontakt, Label→Etykieta, Team→Zespół, Settings→Ustawienia, Agent→Agent, Status→Status, Assignee→Przypisany, Macro→Makro, Report→Raport, Campaign→Kampania, Cancel→Anuluj, Delete→Usuń, Edit→Edytuj, Save→Zapisz, Create→Utwórz, Search→Szukaj, Email→E-mail, Name→Imię (osoba)/Nazwa (rzecz). Przy wątpliwości sprawdź istniejące pl w innym pliku.
- **Nie ruszaj** kluczy już przetłumaczonych (pl != en).

## Per-file procedure (stosowana w Task 1–3 dla każdego pliku z checklisty)

1. Odczytaj `app/javascript/dashboard/i18n/locale/en/<plik>` i `.../pl/<plik>`.
2. Dla każdego klucza, gdzie pl brak lub pl == en i NIE jest nazwą własną → przetłumacz wg reguł i glosariusza. Zachowaj strukturę, placeholdery, segmenty mnogiej (3 formy dla nowych).
3. Zapisz `pl/<plik>`.
4. QA: `python3 scripts/klimabazar/check_i18n_pl.py <plik>` → oczekiwane `OK` (0 braków kluczy, 0 naruszeń placeholderów; exit 0).
5. Commit: `git commit -am "i18n(klimabazar): pl <plik> — pelne tlumaczenie"`.

---

### Task 0: Skrypt QA `check_i18n_pl.py`

**Files:**
- Create: `scripts/klimabazar/check_i18n_pl.py`

- [ ] **Step 1: Utwórz skrypt**

```python
#!/usr/bin/env python3
# KLIMABAZAR: kontrola pokrycia i integralnosci tlumaczen pl dashboardu.
# Uzycie:
#   python3 scripts/klimabazar/check_i18n_pl.py             # raport pokrycia wszystkich plikow
#   python3 scripts/klimabazar/check_i18n_pl.py <plik.json> # kontrola jednego pliku (parytet kluczy + placeholdery)
import json, glob, os, re, sys

EN_DIR = 'app/javascript/dashboard/i18n/locale/en'
PL_DIR = 'app/javascript/dashboard/i18n/locale/pl'
PLACEHOLDER_RE = re.compile(r'%\{[^}]+\}|\{[^}]+\}|@:[\w.]+')

def flatten(d, pfx=''):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items():
            out.update(flatten(v, f'{pfx}.{k}' if pfx else k))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            out.update(flatten(v, f'{pfx}[{i}]'))
    else:
        out[pfx] = d
    return out

def load(path):
    return flatten(json.load(open(path))) if os.path.exists(path) else {}

def placeholders(s):
    return set(PLACEHOLDER_RE.findall(s)) if isinstance(s, str) else set()

def check_file(name):
    en = load(f'{EN_DIR}/{name}')
    pl = load(f'{PL_DIR}/{name}')
    missing = [k for k in en if k not in pl]
    ph = [(k, sorted(placeholders(v)), sorted(placeholders(pl[k])))
          for k, v in en.items()
          if k in pl and placeholders(v) != placeholders(pl[k])]
    return missing, ph

def report():
    total = 0
    for f in sorted(glob.glob(f'{EN_DIR}/*.json')):
        name = os.path.basename(f)
        en = load(f); pl = load(f'{PL_DIR}/{name}')
        miss = sum(1 for k in en if k not in pl)
        untr = sum(1 for k, v in en.items() if k in pl and isinstance(v, str) and pl[k] == v)
        if miss + untr:
            print(f'{name:28} brak={miss:4} nieprzetl={untr:4} / {len(en)}')
        total += miss + untr
    print(f'RAZEM luka: {total}')

if __name__ == '__main__':
    if len(sys.argv) == 2:
        missing, ph = check_file(os.path.basename(sys.argv[1]))
        ok = True
        if missing:
            ok = False
            print(f'BRAK KLUCZY ({len(missing)}): {missing[:20]}')
        if ph:
            ok = False
            print(f'NARUSZENIA PLACEHOLDEROW ({len(ph)}):')
            for k, e, p in ph[:20]:
                print(f'  {k}: en={e} pl={p}')
        print('OK' if ok else 'FAIL')
        sys.exit(0 if ok else 1)
    else:
        report()
```

- [ ] **Step 2: Sanity-check (raport pokrycia)**

Run: `python3 scripts/klimabazar/check_i18n_pl.py`
Expected: tabela braków + `RAZEM luka: 2650`.

- [ ] **Step 3: Sanity-check (kontrola pliku już 100%)**

Run: `python3 scripts/klimabazar/check_i18n_pl.py csatMgmt.json`
Expected: `OK` (exit 0).

- [ ] **Step 4: Commit**

```bash
git add scripts/klimabazar/check_i18n_pl.py
git commit -m "chore(klimabazar): skrypt QA pokrycia/placeholderow tlumaczen pl"
```

---

### Task 1: Tier Wysoki (codzienne ekrany agenta)

Stosuj „Per-file procedure" do każdego pliku. Kolejność:

- [ ] conversation.json (luka 139)
- [ ] chatlist.json (16)
- [ ] inbox.json (54)
- [ ] contact.json (152)
- [ ] search.json (26)
- [ ] snooze.json (47)
- [ ] macros.json (25)
- [ ] cannedMgmt.json (26)
- [ ] bulkActions.json (18)
- [ ] labelsMgmt.json (13)
- [ ] report.json (90)
- [ ] generalSettings.json (68)
- [ ] components.json (28)
- [ ] general.json (6)
- [ ] datePicker.json (9)
- [ ] advancedFilters.json (5)
- [ ] contactFilters.json (1)
- [ ] login.json (9)
- [ ] signup.json (13)
- [ ] resetPassword.json (2)
- [ ] mfa.json (83)
- [ ] onboarding.json (21)

> Po całym Tierze: `python3 scripts/klimabazar/check_i18n_pl.py` — luka spada o sumę powyższych. Najważniejsze ekrany agenta pokryte (możliwy punkt przerwania).

---

### Task 2: Tier Średni (ustawienia / administracja)

Stosuj „Per-file procedure" do każdego pliku:

- [ ] settings.json (356)
- [ ] inboxMgmt.json (341)
- [ ] agentMgmt.json (9)
- [ ] teamsSettings.json (10)
- [ ] customRole.json (38)
- [ ] attributesMgmt.json (9)
- [ ] automation.json (41)
- [ ] sla.json (53)
- [ ] companies.json (69)
- [ ] campaign.json (35)
- [ ] auditLogs.json (25)
- [ ] agentBots.json (31)
- [ ] helpCenter.json (226)
- [ ] integrationApps.json (5)

---

### Task 3: Tier Niski (rzadkie / dużo nazw własnych)

Stosuj „Per-file procedure". W `integrations.json` większość „nieprzetłumaczonych" to nazwy integracji — tłumacz tylko opisy/etykiety, nazwy zostaw:

- [ ] integrations.json (475 — głównie nazwy własne)
- [ ] whatsappTemplates.json (20)
- [ ] contentTemplates.json (20)
- [ ] yearInReview.json (36)

---

### Task 4: Finalny sweep + rejestr

**Files:**
- Modify: `CUSTOMIZATIONS.md`

- [ ] **Step 1: Pełny raport pokrycia**

Run: `python3 scripts/klimabazar/check_i18n_pl.py`
Expected: `RAZEM luka` znacząco zmniejszona; residualne „nieprzetłumaczone" to wyłącznie nazwy własne/technika (świadomie po EN). Zero „brak=" we wszystkich plikach.

- [ ] **Step 2: Pełna kontrola placeholderów (wszystkie pliki)**

Run:
```bash
for f in app/javascript/dashboard/i18n/locale/en/*.json; do python3 scripts/klimabazar/check_i18n_pl.py "$(basename "$f")" | grep -q '^OK$' || echo "FAIL: $(basename "$f")"; done; echo "koniec"
```
Expected: brak `FAIL:` (sam `koniec`).

- [ ] **Step 3: Wpis do CUSTOMIZATIONS.md** (tabela „Rejestr zmian")

```markdown
| `dashboard/i18n/locale/pl/*.json` (i18n, **wysoka kruchość przy mergach — pl jest własnością forka**) | uzupełnione pełne tłumaczenie pl (braki + nieprzetłumaczone), nazwy własne po EN, polska liczba mnoga (3 formy) | pełne pokrycie pl panelu agenta | wysoka (upstream Crowdin aktualizuje pl) — przy mergu brać wersję forka + dolać nowe klucze, potem przetłumaczyć | `python3 scripts/klimabazar/check_i18n_pl.py` (raport + per-plik) |
| `scripts/klimabazar/check_i18n_pl.py` (nowy) | kontrola QA: parytet kluczy en↔pl + integralność placeholderów + raport pokrycia | weryfikacja tłumaczeń, przydatne też przy mergach upstreamu | niska (plik własny) | uruchomienie skryptu |
```

- [ ] **Step 4: Commit**

```bash
git add CUSTOMIZATIONS.md
git commit -m "docs(klimabazar): rejestr - pelne pokrycie pl dashboardu + skrypt QA"
```

---

## Po wdrożeniu
- Front → na prod przez build CI (`git push` → `-R adayet/chatwoot`) + deploy (sygnał właściciela). Brak migracji.
- Weryfikacja na devie: `http://localhost:3001`, przeklik ekranów (rozmowy, ustawienia, kontakty) — brak angielskich napisów poza nazwami własnymi.
- Przy następnym wciąganiu upstreamu: po mergu uruchom skrypt QA — pokaże nowe klucze do dotłumaczenia.

## Opcjonalnie (poza zakresem)
- Backend `config/locales/pl.yml` (maile/powiadomienia, ~256 luki), widget (~10).
- Rebranding „Chatwoot"→„Klimabazar" w stringach.
