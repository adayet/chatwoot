# F-Auto: „Dodaj nową automatyzację" z listy konwersacji (prefill)

**Data:** 2026-06-12
**Fork:** `adayet/chatwoot`, gałąź `klimabazar`
**Marker zmian:** `KLIMABAZAR` (grep-owalne, jak w `CUSTOMIZATIONS.md`)

## Cel

Przyspieszyć tworzenie automatyzacji anty-spamowych (np. „kurier-spam"). Z listy
konwersacji agent/admin klika prawym przyciskiem na konwersację i wybiera
„Dodaj nową automatyzację". Otwiera się (bez przekierowania) modal formularza
reguły automatyzacji — ten sam, co w *Ustawienia → Automatyzacja* — z polami
wstępnie wypełnionymi danymi z klikniętej konwersacji.

## Zachowanie (happy path)

1. Prawy przycisk na karcie konwersacji → menu kontekstowe.
2. Pozycja **„Dodaj nową automatyzację"** (widoczna tylko dla admina).
3. Po kliknięciu otwiera się modal `AutomationRuleForm` w trybie `create`,
   z prefillem:
   - **Zdarzenie:** `conversation_created` (Konwersacja utworzona).
   - **Warunki** (dokładane tylko gdy wartość istnieje):
     - `email` `equal_to` `<email nadawcy>` — jeśli jest email,
     - `mail_subject` `equal_to` `<temat>` — jeśli jest temat.
   - **Akcja:** `add_label` z pustym `action_params` (admin sam wybierze etykietę).
4. Admin uzupełnia/koryguje i zapisuje. Reguła trafia do backendu przez
   `automations/create` jak każda inna.

### Przypadki brzegowe (decyzja produktowa)

- Pozycja w menu pojawia się **zawsze** (dla admina), niezależnie od kanału.
- Brak tematu → dokładamy tylko warunek `email`.
- Brak emaila i tematu → modal otwiera się z **pustym** formularzem
  (domyślny warunek `status`, jak w `START_VALUE`).
- Łączenie warunków: `query_operator` = `and`, ostatni warunek `null`
  (zgodnie z konwencją formularza).

## Architektura

Reużycie istniejącego, samowystarczalnego modala `AddAutomationRule.vue`
(sam ładuje labels/agents/inboxes/teams/contacts/campaigns w `onMounted`).
Jedna instancja montowana w `ChatList.vue` — tam, gdzie już żyją wszystkie
`provide()` dla menu kontekstowego (linie ~851–862). Przepływ danych przez
istniejący wzorzec provide/inject, bez nowego store'a i bez event-busa.

```
ConversationContextMenu (emit 'addAutomation')
        │
        ▼
ConversationItem  ── inject('openAutomationFromConversation')(source) ──┐
        │                                                               │
        ▼                                                               ▼
ChatList: provide('openAutomationFromConversation')          <AddAutomationRule ref>
          buduje prefill z konwersacji  ───────────────────►  open(prefill)
          @save-automation → dispatch('automations/create')
```

*Alternatywa odrzucona:* przekierowanie do trasy `Ustawienia → Automatyzacja`
z prefillem przez store/query — działa, ale daje redirect (niepożądany) i więcej
stanu współdzielonego między trasami.

## Zmiany w plikach (5)

### 1. `app/javascript/dashboard/components/widgets/conversation/contextMenu/Index.vue`
- Nowy klucz w obiekcie `MENU`: `ADD_AUTOMATION: 'add-automation'`.
- Nowa pozycja menu (np. ikona `flash`), `v-if="isAdmin"`, emituje `addAutomation`.
- Nowy wpis w `emits`.
- Etykieta przez i18n: `CONVERSATION.CARD_CONTEXT_MENU.ADD_AUTOMATION`.

### 2. `app/javascript/dashboard/components/ConversationItem.vue`
- `inject('openAutomationFromConversation')`.
- Handler `onAddAutomation` → `openAutomationFromConversation(props.source)` + zamknięcie menu.
- Podpięcie `@add-automation="onAddAutomation"` na `ConversationContextMenu`.

### 3. `app/javascript/dashboard/components/ChatList.vue`
- Import i montaż `<AddAutomationRule ref="automationFormRef" @save-automation="onSaveAutomationFromConversation" />`.
- `provide('openAutomationFromConversation', openAutomationFromConversation)`.
- `openAutomationFromConversation(conversation)`:
  - buduje prefill (event, conditions, actions) wg sekcji „Prefill" poniżej,
  - woła `automationFormRef.value.open(prefill)`.
- `onSaveAutomationFromConversation(payload)` → `dispatch('automations/create', payload)`
  + alert sukcesu/błędu (mirror z `settings/automation/Index.vue`).

### 4. `app/javascript/dashboard/routes/dashboard/settings/automation/AddAutomationRule.vue`
- `open(prefill)` przyjmuje opcjonalny argument:
  - `automation.value = prefill ? prefill : structuredClone(START_VALUE)`,
  - `manifestCustomAttributes()` i `formRef.value?.open()` bez zmian.
- Bez argumentu — zachowanie identyczne jak dziś (kompatybilne z użyciem
  w ustawieniach).

### 5. i18n
- `app/javascript/dashboard/i18n/locale/en/conversation.json` (lub właściwy plik
  z `CARD_CONTEXT_MENU`) — klucz `ADD_AUTOMATION`.
- Odpowiednik `pl/...` — bo instalacja PL-only (własność forka).

## Prefill — budowa obiektu

```js
const sender = conversation.meta?.sender || {};
const email = sender.email;
const subject = conversation.additional_attributes?.mail_subject;

const conditions = [];
if (email) {
  conditions.push({
    attribute_key: 'email',
    filter_operator: 'equal_to',
    values: email,
    query_operator: 'and',
    custom_attribute_type: '',
  });
}
if (subject) {
  conditions.push({
    attribute_key: 'mail_subject',
    filter_operator: 'equal_to',
    values: subject,
    query_operator: 'and',
    custom_attribute_type: '',
  });
}
// ostatni warunek: query_operator = null
if (conditions.length) {
  conditions[conditions.length - 1].query_operator = null;
}

const prefill = conditions.length
  ? {
      name: null,
      description: null,
      event_name: 'conversation_created',
      conditions,
      actions: [{ action_name: 'add_label', action_params: [] }],
    }
  : null; // null → modal otwiera pusty formularz (START_VALUE)
```

Uwaga: dla zdarzenia `conversation_created` formularz udostępnia w dropdownach
zarówno `email`, jak i `mail_subject` (potwierdzone w
`settings/automation/constants.js`), więc prefill renderuje się poprawnie.

## Uwagi dot. uprawnień

Pozycja menu tylko dla admina (`isAdmin` już dostępne w komponencie menu).
Nie-admin nie ma dostępu do tworzenia automatyzacji — ukrycie pozycji zapobiega
zapisowi kończącemu się błędem.

## Wpis do `CUSTOMIZATIONS.md`

Po implementacji dodać wiersz do rejestru zmian (kolumny: Plik / Zmiana / Po co /
Kruchość / Jak zweryfikować). Kruchość: średnia dla `ChatList.vue`,
`ConversationItem.vue`, `contextMenu/Index.vue` (pliki upstream, bywają
zmieniane); niska dla i18n. Weryfikacja: prawy przycisk na konwersacji email →
„Dodaj nową automatyzację" → modal z prefillem email+temat i pustą akcją label.

## Poza zakresem (YAGNI)

- Brak nowych endpointów/serwisów backendu (reużycie `automations/create`).
- Brak konfiguracji innych typów zdarzeń/akcji z poziomu menu.
- Brak dopasowywania reguły do istniejących automatyzacji.
- Brak zmian w Enterprise (funkcja czysto frontowa, reużywa OSS store/API).
