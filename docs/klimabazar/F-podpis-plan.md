<!-- KLIMABAZAR F-podpis: plan implementacji -->
# F-podpis — plan implementacji

> **Dla wykonawcy:** implementuj zadanie po zadaniu, krok po kroku. Kroki mają checkboxy (`- [ ]`) do odhaczania.
> Spec: `docs/klimabazar/F-podpis-design.md`. Fork Klimabazar, gałąź `klimabazar`.
> **Uwaga:** projekt (`CLAUDE.md`) mówi „Avoid writing specs unless explicitly asked" → **bez testów jednostkowych**. Weryfikacja manualna na lokalnym dev Dockerze (`localhost:3001`, login `john@acme.inc` / `Password1!`). Każda edycja oznaczona `// KLIMABAZAR F-podpis` lub `<!-- KLIMABAZAR F-podpis -->`.

**Cel:** agent widzi stopkę wyrenderowaną pod polem edycji zamiast surowego HTML w treści, a wysyłana wiadomość zostaje bajt w bajt taka sama jak dziś.

**Architektura:** stopka przestaje być wplatana w treść edytora (odcięcie przez zaprzestanie przekazywania `allow-signature` do `Editor.vue`), pojawia się jako nieedytowalny podgląd pod polem edycji (`SignaturePreview.vue`, render przez `v-dompurify-html`), a do treści dokleja się dopiero w chwili wysyłki, tym samym helperem `appendSignature`, którego używał edytor.

**Tech:** Vue 3 (Options API w `ReplyBox.vue`, `<script setup>` w nowym komponencie), Tailwind (bez custom CSS), `vue-dompurify-html` (zarejestrowana globalnie), helpery z `dashboard/helper/editorHelper.js`.

**Kolejność ma znaczenie.** Zadanie 2 jest atomowe: odcięcie edytora i doklejenie przy wysyłce muszą wejść jednym commitem. Rozdzielenie ich daje albo stopkę wysyłaną dwa razy, albo w ogóle niewysyłaną.

---

## Task 1: Komponent podglądu stopki

**Files:**
- Create: `app/javascript/dashboard/components/widgets/conversation/SignaturePreview.vue`
- Modify: `app/javascript/dashboard/i18n/locale/en/conversation.json:275`
- Modify: `app/javascript/dashboard/i18n/locale/pl/conversation.json:281`

- [ ] **Step 1: Dodaj klucz i18n w `en/conversation.json`**

Po linii z `"MESSAGE_SIGNATURE_NOT_CONFIGURED"` (w bloku `CONVERSATION.FOOTER`) dodaj:

```json
      "MESSAGE_SIGNATURE_NOT_CONFIGURED": "Message signature is not configured, please configure it in profile settings.",
      "SIGNATURE_PREVIEW_LABEL": "Signature",
```

- [ ] **Step 2: Dodaj ten sam klucz w `pl/conversation.json`**

```json
      "MESSAGE_SIGNATURE_NOT_CONFIGURED": "Podpis wiadomości nie jest skonfigurowany, należy go skonfigurować w ustawieniach profilu.",
      "SIGNATURE_PREVIEW_LABEL": "Podpis",
```

- [ ] **Step 3: Utwórz `SignaturePreview.vue`**

Wzorzec skopiowany z sąsiedniego `QuotedEmailPreview.vue` (ten sam katalog): `<script setup>`, `v-dompurify-html`, tokeny `n-*` z Tailwinda.

Tło kontenera stopki jest **celowo białe w obu motywach** — stopka ma własne kolory dobrane pod białe tło maila (ciemny tekst, `#f05a28`), więc na ciemnym tle panelu byłaby nieczytelna. Podgląd ma pokazywać to, co zobaczy klient.

```vue
<!-- KLIMABAZAR F-podpis: nieedytowalny podgląd stopki pod polem edycji -->
<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  signature: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
</script>

<template>
  <div class="mt-2">
    <span class="block mb-1 text-xs text-n-slate-11">
      {{ t('CONVERSATION.FOOTER.SIGNATURE_PREVIEW_LABEL') }}
    </span>
    <div
      class="rounded-md border border-n-strong bg-white px-3 py-2 max-h-40 overflow-y-auto select-none"
    >
      <div
        v-dompurify-html="signature"
        class="origin-top-left scale-90 w-[111%] pointer-events-none"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 4: Sprawdź lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/conversation/SignaturePreview.vue`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/SignaturePreview.vue app/javascript/dashboard/i18n/locale/en/conversation.json app/javascript/dashboard/i18n/locale/pl/conversation.json
git commit -m "feat(klimabazar): F-podpis - komponent podgladu stopki"
```

---

## Task 2: Przeniesienie stopki z edytora do wysyłki (atomowe)

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue` (metody `toggleSignatureForDraft` ~719, `confirmOnSendReply` ~864, `clearMessage` ~1041, szablon ~1435)

- [ ] **Step 1: Odetnij edytor od stopki — szablon, tag `<WootMessageEditor>` (~l. 1435)**

Usuń dwie linie `:signature="messageSignature"` i `allow-signature`. To wyłącza całą ścieżkę wstawiania w `Editor.vue` (jej computed `sendWithSignature` wymaga `props.allowSignature`), dzięki czemu **`Editor.vue` nie wymaga żadnych zmian**.

Było:
```vue
          :variables="messageVariables"
          :signature="messageSignature"
          allow-signature
          :channel-type="channelType"
```

Ma być:
```vue
          :variables="messageVariables"
          :channel-type="channelType"
```

Komentarz z markerem wstaw **nad** całym tagiem `<WootMessageEditor` (komentarz HTML w środku listy atrybutów jest niepoprawny):

```vue
        <!-- KLIMABAZAR F-podpis: stopka nie trafia do edytora; podgląd pod polem, doklejenie przy wysyłce -->
        <WootMessageEditor
```

- [ ] **Step 2: Zamień `toggleSignatureForDraft` na `stripSignatureFromDraft` (~l. 719)**

Metoda ma jednego wywołującego (l. 717), więc zmiana nazwy jest bezpieczna. Nazwa `toggle` przestaje być prawdziwa — stopka jest już tylko odejmowana.

Było:
```js
    toggleSignatureForDraft(message) {
      if (this.isPrivate) {
        return message;
      }

      // Even when editor is disabled (e.g. WhatsApp/API can't reply), we must
      // still normalize stale signatures out of drafts when signature is off.
      if (this.isEditorDisabled && this.sendWithSignature) {
        return message;
      }

      const effectiveChannelType = getEffectiveChannelType(
        this.channelType,
        this.inbox?.medium || ''
      );

      return this.sendWithSignature
        ? appendSignature(message, this.messageSignature, effectiveChannelType)
        : removeSignature(message, this.messageSignature, effectiveChannelType);
    },
```

Ma być:
```js
    // KLIMABAZAR F-podpis: stopka nigdy nie żyje w treści edytora. Odejmujemy ją
    // bezwarunkowo, bo drafty zapisane przed tą zmianą mają ją wklejoną — bez tego
    // agent dostałby ją dwa razy (raz w treści, raz przy wysyłce).
    stripSignatureFromDraft(message) {
      if (this.isPrivate) {
        return message;
      }

      return removeSignature(
        message,
        this.messageSignature,
        getEffectiveChannelType(this.channelType, this.inbox?.medium || '')
      );
    },
```

- [ ] **Step 3: Popraw wywołanie w `getFromDraft` (~l. 717)**

Było:
```js
        this.message = this.toggleSignatureForDraft(messageFromStore);
```

Ma być:
```js
        this.message = this.stripSignatureFromDraft(messageFromStore);
```

- [ ] **Step 4: Dodaj doklejanie stopki w `confirmOnSendReply` (~l. 864)**

Jedno miejsce, przed rozgałęzieniem na ścieżkę wielowiadomościową (WhatsApp/Instagram/TikTok) i zwykłą — obie dostają tę samą treść.

Było:
```js
        const isOnInstagram = this.isAnInstagramChannel;
        const isOnTiktok = this.isATiktokChannel;
        if ((isOnWhatsApp || isOnInstagram || isOnTiktok) && !this.isPrivate) {
          this.sendMessageAsMultipleMessages(
            this.message,
            copilotAcceptedMessage
          );
        } else {
          const messagePayload = this.getMessagePayload(this.message);
          this.sendMessage(
            messagePayload,
            this.message,
            copilotAcceptedMessage
          );
        }
```

Ma być:
```js
        const isOnInstagram = this.isAnInstagramChannel;
        const isOnTiktok = this.isATiktokChannel;
        // KLIMABAZAR F-podpis: stopki nie ma już w treści edytora, więc doklejamy ją
        // tutaj — tym samym helperem, którego używał edytor, żeby wysłana treść była
        // identyczna z dotychczasową. Warunek kopiuje dotychczasowy.
        const messageWithSignature =
          !this.isPrivate && this.sendWithSignature && this.messageSignature
            ? appendSignature(
                this.message,
                this.messageSignature,
                getEffectiveChannelType(this.channelType, this.inbox?.medium || '')
              )
            : this.message;
        if ((isOnWhatsApp || isOnInstagram || isOnTiktok) && !this.isPrivate) {
          this.sendMessageAsMultipleMessages(
            messageWithSignature,
            copilotAcceptedMessage
          );
        } else {
          const messagePayload = this.getMessagePayload(messageWithSignature);
          this.sendMessage(
            messagePayload,
            messageWithSignature,
            copilotAcceptedMessage
          );
        }
```

- [ ] **Step 5: Uprość `clearMessage` (~l. 1041)**

Było:
```js
    clearMessage() {
      this.message = '';
      this.clearCopilotAcceptedMessage();
      if (this.sendWithSignature && !this.isPrivate) {
        // if signature is enabled, append it to the message
        const effectiveChannelType = getEffectiveChannelType(
          this.channelType,
          this.inbox?.medium || ''
        );
        this.message = appendSignature(
          this.message,
          this.messageSignature,
          effectiveChannelType
        );
      }
      this.attachedFiles = [];
```

Ma być:
```js
    clearMessage() {
      // KLIMABAZAR F-podpis: stopka nie wraca do pola po wysyłce — jest doklejana
      // dopiero przy wysyłce, a agent widzi ją jako podgląd pod edytorem.
      this.message = '';
      this.clearCopilotAcceptedMessage();
      this.attachedFiles = [];
```

- [ ] **Step 6: Sprawdź lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue`
Expected: brak błędów. Jeśli ESLint zgłosi nieużywany import `appendSignature` — to znaczy, że Step 4 nie został wykonany; `appendSignature` musi zostać w imporcie.

- [ ] **Step 7: Weryfikacja ręczna — treść wysyłanej wiadomości bez zmian**

Na dev Dockerze (`docker compose up -d`, `localhost:3001`):
1. Otwórz rozmowę na skrzynce e-mail, włącz podpis (ikona podpisu w stopce edytora).
2. Wpisz `Testowa treść` i wyślij.
3. Sprawdź zapisaną treść:

Run:
```bash
docker compose exec -T rails bundle exec rails runner 'm = Message.where(message_type: 1).order(:id).last; puts m.content.inspect'
```
Expected: `"Testowa treść\n\n--\n\n<div style=…"` — czyli treść + `\n\n--\n\n` + stopka w jednej linii. Pole edycji podczas pisania **nie zawierało** HTML-a.

- [ ] **Step 8: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue
git commit -m "feat(klimabazar): F-podpis - stopka doklejana przy wysylce zamiast w edytorze"
```

---

## Task 3: Podpięcie podglądu w ReplyBox

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue` (import ~l. 19, rejestracja ~l. 84, szablon ~l. 1452)

- [ ] **Step 1: Dodaj import (obok `QuotedEmailPreview`, l. 19)**

```js
import QuotedEmailPreview from './QuotedEmailPreview.vue';
// KLIMABAZAR F-podpis
import SignaturePreview from './SignaturePreview.vue';
```

- [ ] **Step 2: Zarejestruj komponent (blok `components`, ~l. 84)**

```js
    QuotedEmailPreview,
    SignaturePreview,
    CopilotEditorSection,
```

- [ ] **Step 3: Wstaw podgląd w szablonie, pod `<QuotedEmailPreview>` (~l. 1452)**

Warunek korzysta z istniejących computed `isSignatureEnabledForInbox` (l. 403), `isSignatureAvailable` (l. 406) i `isDefaultEditorMode` — żaden nie wymaga zmian, więc przełącznik podpisu w stopce edytora od razu steruje widocznością podglądu.

```vue
        <QuotedEmailPreview
          v-if="shouldShowQuotedPreview && isDefaultEditorMode"
          :quoted-email-text="quotedEmailText"
          :preview-text="quotedEmailPreviewText"
          class="mb-2"
          @toggle="toggleQuotedReply"
        />

        <!-- KLIMABAZAR F-podpis: stopka jako podgląd, nie jako treść edytora -->
        <SignaturePreview
          v-if="
            isSignatureEnabledForInbox &&
            isSignatureAvailable &&
            isDefaultEditorMode
          "
          :signature="messageSignature"
          class="mb-2"
        />
```

- [ ] **Step 4: Sprawdź lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue`
Expected: brak błędów.

- [ ] **Step 5: Weryfikacja ręczna — podgląd**

Na `localhost:3001`, rozmowa na skrzynce e-mail:
1. Podgląd stopki widoczny pod polem edycji, wyrenderowany (kolory, logo, pomarańczowa linia) — nie jako kod.
2. Kliknięcie w podgląd nie ustawia kursora ani nie zaznacza treści (`pointer-events-none` + `select-none`).
3. Wyłączenie podpisu ikoną w stopce edytora → podgląd znika; włączenie → wraca.
4. Notatka prywatna → brak podglądu.

- [ ] **Step 6: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue
git commit -m "feat(klimabazar): F-podpis - podglad stopki pod edytorem"
```

---

## Task 4: Usunięcie martwego kodu odejmującego stopkę z treści

Po Zadaniu 2 treść edytora nigdy nie zawiera stopki, więc dwa miejsca odejmujące ją z treści są nieosiągalne. `CLAUDE.md`: „Remove dead/unreachable/unused code".

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue` (`hasMeaningfulEditorContent` ~l. 229, `sendMessageAnalyticsData` ~l. 917)

- [ ] **Step 1: Uprość `hasMeaningfulEditorContent` (~l. 229)**

Było:
```js
    hasMeaningfulEditorContent() {
      const body = this.message || '';
      // Only strip the signature when it's actually being auto-appended.
      // If the toggle is off, the agent's text might happen to match their
      // saved signature and we'd incorrectly treat it as empty.
      const shouldStripSignature =
        !this.isPrivate && this.sendWithSignature && !!this.messageSignature;
      if (!shouldStripSignature) return !!body.trim();
      const stripped = removeSignature(
        body,
        this.messageSignature,
        getEffectiveChannelType(this.channelType, this.inbox?.medium || '')
      );
      return !!stripped.trim();
    },
```

Ma być:
```js
    // KLIMABAZAR F-podpis: treść edytora nigdy nie zawiera stopki, więc nie ma
    // czego odejmować — puste pole to po prostu puste pole.
    hasMeaningfulEditorContent() {
      return !!(this.message || '').trim();
    },
```

- [x] **Step 2: ~~Uprość `normalizeForComparison`~~ — KROK ANULOWANY (2026-09-07)**

Weryfikacja w trakcie implementacji: `normalizeForComparison` **nie jest martwy**. Jego argument `editorMessage` to trzeci parametr `sendMessage()`, a po Zadaniu 2 przekazujemy tam treść **z doklejoną stopką** (`messageWithSignature`, a w ścieżce wielowiadomościowej `messagePayload.message`). Usunięcie odejmowania stopki sprawiłoby, że porównanie z podpowiedzią Copilota liczyłoby stopkę jako treść napisaną przez agenta.

**Zostaw ten kod bez zmian.** Poniższy blok „było" zachowany wyłącznie jako zapis tego, czego NIE ruszamy:

Było:
```js
      const normalizeForComparison = message => {
        let normalizedMessage = message || '';

        if (this.sendWithSignature && this.messageSignature && !isPrivate) {
          const effectiveChannelType = getEffectiveChannelType(
            this.channelType,
            this.inbox?.medium || ''
          );
          normalizedMessage = removeSignature(
            normalizedMessage,
            this.messageSignature,
            effectiveChannelType
          );
        }

        return trimContent(normalizedMessage);
      };
```


- [ ] **Step 3: Sprawdź, czy `removeSignature` jest jeszcze używany**

Run: `rg -n "removeSignature|appendSignature" app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue`
Expected: `removeSignature` w `stripSignatureFromDraft`, `appendSignature` w `confirmOnSendReply` — oba nadal używane, import (l. 47-53) zostaje bez zmian. Jeśli któryś nie ma już użycia, usuń go z importu.

- [ ] **Step 4: Sprawdź lint**

Run: `pnpm eslint app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue`
Expected: brak błędów, w szczególności brak `no-unused-vars`.

- [ ] **Step 5: Weryfikacja ręczna — blokada przycisku Wyślij**

1. Puste pole, podpis włączony → przycisk **Wyślij zablokowany** (to jest sedno tego kroku: wcześniej stopka w treści udawała treść).
2. Jedna spacja w polu → nadal zablokowany.
3. Dowolny tekst → odblokowany.

- [ ] **Step 6: Commit**

```bash
git add app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue
git commit -m "refactor(klimabazar): F-podpis - usuniecie martwego odejmowania stopki z tresci"
```

---

## Task 5: Pełna weryfikacja i wpis w rejestrze customizacji

**Files:**
- Modify: `CUSTOMIZATIONS.md` (tabela „Rejestr zmian", dopisz wiersz na końcu)

- [ ] **Step 1: Przejdź całą listę kryteriów akceptacji ze spec**

Na `localhost:3001`, po `pnpm eslint` bez błędów:

| # | Scenariusz | Oczekiwane |
|---|---|---|
| 1 | Rozmowa e-mail, podpis wł. | Pole edycji bez HTML; podgląd pod polem wyrenderowany |
| 2 | Wysyłka `Testowa treść` | `Message.last.content` = treść + `\n\n--\n\n` + stopka (jak w Task 2 Step 7) |
| 3 | Podpis wył. → wysyłka | `content` = sama treść, bez `--` i bez stopki |
| 4 | Notatka prywatna | Brak podglądu, `content` bez stopki |
| 5 | Draft: wpisz tekst, przejdź do innej rozmowy i wróć | Treść zachowana, stopka niezduplikowana |
| 6 | Stary draft ze stopką (patrz Step 2) | Po wczytaniu w polu sama treść |
| 7 | Puste pole, podpis wł. | Wyślij zablokowany |
| 8 | Kanał bez podpisu (np. WhatsApp, jeśli skonfigurowany) | Zachowanie bez zmian |

- [ ] **Step 2: Zasymuluj stary draft (scenariusz 6)**

W konsoli przeglądarki, przy otwartej rozmowie, wstrzyknij draft z wklejoną stopką i przeładuj widok rozmowy:

```js
// podmień <ID> na id otwartej rozmowy (widoczne w URL)
const sig = window.__store.getters.getMessageSignature;
window.__store.dispatch('draftMessages/set', {
  key: `draft-<ID>-REPLY`,
  message: `Stara tresc\n\n--\n\n${sig}`,
});
```

Jeśli `window.__store` nie jest wystawiony w tym buildzie, alternatywa: wpisz treść, przełącz rozmowę, a draft z podpisem wygeneruj przez tymczasowe cofnięcie Step 5 z Zadania 2 (przywrócenie doklejania w `clearMessage`), wyślij wiadomość, cofnij zmianę i wróć do rozmowy.

Expected: po wczytaniu pole zawiera `Stara tresc`, bez HTML-a, a wysyłka daje pojedynczą stopkę.

- [ ] **Step 3: Dopisz wiersz do `CUSTOMIZATIONS.md`**

Na końcu tabeli „Rejestr zmian":

```markdown
| `ReplyBox.vue` (F-podpis, **upstreamowy — czulszy przy mergach**) + `SignaturePreview.vue` (nowy) | stopka nie jest wplatana w treść edytora: usunięte `:signature`/`allow-signature` z `<WootMessageEditor>` (to samo bramkuje całą ścieżkę w `Editor.vue`, dzięki czemu **`Editor.vue` zostaje nietknięty**), `toggleSignatureForDraft`→`stripSignatureFromDraft` (bezwarunkowe odejmowanie — drafty sprzed zmiany mają stopkę wklejoną), doklejenie przez `appendSignature` w `confirmOnSendReply` przed rozgałęzieniem wysyłki (obie ścieżki), `clearMessage` bez ponownego wklejania, martwe odejmowanie stopki usunięte z `hasMeaningfulEditorContent` i `normalizeForComparison`; nowy `SignaturePreview.vue` renderuje stopkę pod polem edycji przez `v-dompurify-html` (białe tło w obu motywach — stopka ma kolory pod białe tło maila) | F-podpis: agent widzi sformatowaną stopkę zamiast surowego HTML; treść wysyłanej wiadomości bez zmian. Spec: `docs/klimabazar/F-podpis-{design,plan}.md` | **średnia** (`ReplyBox.vue` często ruszany przez upstream — grep `KLIMABAZAR F-podpis`) | pole edycji bez HTML; podgląd pod polem; `Message.last.content` = treść + `\n\n--\n\n` + stopka; wyłączony podpis = brak stopki w treści; puste pole = Wyślij zablokowany |
```

- [ ] **Step 4: Commit**

```bash
git add CUSTOMIZATIONS.md docs/klimabazar/F-podpis-design.md docs/klimabazar/F-podpis-plan.md
git commit -m "docs(klimabazar): F-podpis - spec, plan i wpis w rejestrze customizacji"
```

---

## Uwagi dla wykonawcy

- **Nie dotykaj `Editor.vue`.** Jeśli wygląda na to, że trzeba — wróć do spec, sekcja „Zakres". Cała ścieżka wstawiania jest bramkowana przez `props.allowSignature`, który przestajemy przekazywać.
- **Nie zmieniaj `MessageFormatter`** (`html: false`). Dymek wysłanej wiadomości nadal będzie pokazywał źródło HTML — to świadomie poza zakresem, bo przez ten sam formatter przechodzą przychodzące maile od klientów.
- **Nie zmieniaj formy doklejania.** `appendSignature` z `editorHelper.js` musi zostać użyty dokładnie tak jak dziś (z `getEffectiveChannelType`), bo kryterium akceptacji nr 2 to „treść bajt w bajt jak dotąd".
- Podpisy na produkcji są **jednoliniowym HTML-em** — patrz `docs/klimabazar/F-podpis-design.md` i historia zmian z 2026-09-07. Każdy `\n` w podpisie renderuje się u klienta jako widoczny ukośnik.
