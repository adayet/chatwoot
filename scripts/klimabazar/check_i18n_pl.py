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
        en = load(f)
        pl = load(f'{PL_DIR}/{name}')
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
