<!-- KLIMABAZAR F-podpis: spec sformatowanej stopki w edytorze odpowiedzi -->
# F-podpis — sformatowana stopka zamiast surowego HTML w edytorze

**Status:** zatwierdzony design (2026-09-07)
**Marker w kodzie:** `KLIMABAZAR F-podpis`
**Charakter:** front (Vue). Jeden plik upstreamowy (`ReplyBox.vue`) + jeden plik własny. Brak zmian w backendzie, brak odpowiedników w `enterprise/`.

## Cel
Agent pisząc odpowiedź ma widzieć stopkę **wyrenderowaną**, a nie jako blok kodu HTML. Treść wysyłanej wiadomości i mail u klienta mają pozostać bajt w bajt takie jak dziś.

## Kontekst kodu (stan przed zmianą)

Podpis (`users.message_signature`, u nas kolorowy HTML w jednej linii) jest **wplatany w treść drafta** i żyje w polu edytora jako zwykły tekst. Edytor to ProseMirror ze schematem markdownowym (`@chatwoot/prosemirror-schema` — zewnętrzny pakiet npm), który nie zna węzła „surowy HTML", więc HTML-a nie da się w nim pokazać jako sformatowanego bez dekoracji.

Punkty styku w `app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue`:

| l. | Miejsce | Co robi dziś |
|---|---|---|
| ~229 | `hasMeaningfulEditorContent()` | odejmuje podpis od treści, żeby sam podpis nie liczył się jako wiadomość |
| ~719 | `toggleSignatureForDraft()` | przy wczytaniu drafta dokleja albo usuwa podpis wg `sendWithSignature` |
| ~917 | `sendMessageAnalyticsData()` → `normalizeForComparison` | odejmuje podpis przed porównaniem treści z podpowiedzią Copilota |
| ~1044 | `clearMessage()` | po wysyłce czyści pole i od razu wkleja podpis z powrotem |
| ~1292 | `onReplyToMessage()` | ustawia kursor na `start`, gdy podpis jest włączony (bo zajmuje koniec dokumentu) |
| ~1435 | szablon, tag `<WootMessageEditor>` | przekazuje `:signature="messageSignature"` i `allow-signature` |

W `Editor.vue` całe wstawianie (`addSignature` / `removeSignature` / `toggleSignatureInEditor` i odejmowanie w `isBodyEmpty`) jest bramkowane przez computed `sendWithSignature`, który wymaga **`props.allowSignature`**.

## Decyzje

### 1. Zakres: `Editor.vue` zostaje nietknięty

Skoro cała ścieżka wstawiania jest bramkowana przez `props.allowSignature`, wystarczy przestać przekazywać `allow-signature` i `:signature` z `ReplyBox.vue`. Wtedy `sendWithSignature` w edytorze jest trwale `false`, watcher nie odpala `toggleSignatureInEditor`, a `isBodyEmpty` nie próbuje niczego odejmować.

To świadoma decyzja o kształcie zmiany: **najbardziej kruchy, najczęściej ruszany przez upstream plik wypada z zakresu**. Zostaje jeden plik upstreamowy do pilnowania przy mergach zamiast dwóch.

### 2. Podgląd pod edytorem — nowy `SignaturePreview.vue`

Nowy komponent `app/javascript/dashboard/components/widgets/conversation/SignaturePreview.vue`:
- props: `signature` (String);
- render przez dyrektywę `v-dompurify-html` (`vue-dompurify-html` jest już zarejestrowana globalnie w `entrypoints/dashboard.js` z `domPurifyConfig`, który dokłada wyłącznie hook `afterSanitizeAttributes` — domyślna allowlista DOMPurify przepuszcza `table`, `img` i atrybut `style`, czyli wszystko, czego stopka potrzebuje);
- nieedytowalny, wizualnie odseparowany od pola edycji (jasne tło, cieńsza ramka, mniejsza skala), żeby było jasne, że to podgląd, a nie treść do edycji;
- **tylko Tailwind**, zgodnie z regułą projektu; brak scoped CSS i inline styles po naszej stronie (inline style wewnątrz samej stopki to treść danych, nie nasz kod).

Miejsce w szablonie: bezpośrednio pod `<WootMessageEditor>`, w tym samym bloku co istniejący `QuotedEmailPreview` i `MessageSignatureMissingAlert` — te dwa komponenty są wzorcem konwencji (warunek `isDefaultEditorMode`, `class="mb-2"`).

Warunek widoczności: `isSignatureEnabledForInbox && isSignatureAvailable && isDefaultEditorMode`. Pierwsze dwa computed już istnieją i nie wymagają zmian, więc przełącznik podpisu w stopce edytora działa bez dodatkowej roboty — steruje widocznością podglądu tak, jak dziś steruje wstawianiem tekstu.

### 3. Doklejenie podpisu przy wysyłce — jedno miejsce

W `confirmOnSendReply()` (l. ~864) rozgałęzia się wysyłka: ścieżka wielowiadomościowa (WhatsApp / Instagram / TikTok) i zwykła. Podpis doklejamy **raz, przed rozgałęzieniem**, do lokalnej zmiennej, i obie ścieżki dostają już wersję z podpisem.

Alternatywa (doklejanie w `getMessagePayload`) była odrzucona: ominęłaby ścieżkę wielowiadomościową i wymagała drugiej, osobnej poprawki w `getMessagePayloadsForMultipleMessages`.

Forma doklejenia musi być **identyczna z tym, co dziś produkuje edytor**, czyli przez istniejący helper `appendSignature(message, signature, effectiveChannelType)` z `dashboard/helper/editorHelper.js` — ten sam, którego używa dziś `clearMessage()`. Dzięki temu rekord wiadomości i mail wychodzący nie zmieniają się ani o znak. Warunek doklejenia dokładnie jak dziś: `sendWithSignature && messageSignature && !isPrivate`.

### 4. Sprzątanie starych draftów

Drafty żyją w store (`draftMessages`) i przy wdrożeniu **zawierają już wklejone stopki**. Bez reakcji agent zobaczyłby stopkę w treści (stary draft) i podgląd pod spodem, a przy wysyłce dostałby ją dwa razy.

Dlatego `toggleSignatureForDraft()` nie znika, tylko upraszcza się do **bezwarunkowego `removeSignature(...)`** przy wczytaniu drafta. To nie jest spekulacyjny guard — stan „draft z wklejoną stopką" istnieje w chwili wdrożenia u każdego agenta z otwartym szkicem. Zostaje na stałe, bo chroni też przed ręcznym wklejeniem stopki przez agenta.

### 5. Uproszczenia wynikające z tego, że treść nie zawiera już stopki

- `hasMeaningfulEditorContent()` → `!!body.trim()`; cała gałąź z `removeSignature` i komentarz o przypadkowym zbiegu treści z podpisem stają się martwe.
- `normalizeForComparison()` w `sendMessageAnalyticsData()` — **bez zmian**. Pierwotnie zakładaliśmy, że też staje się martwy; weryfikacja w trakcie implementacji (2026-09-07) pokazała, że nie: jego argument `editorMessage` to trzeci parametr `sendMessage()`, któremu przekazujemy treść **już z doklejoną stopką**. Odejmowanie stopki jest tam nadal osiągalne i potrzebne, inaczej porównanie z podpowiedzią Copilota liczyłoby stopkę jako treść agenta.
- `clearMessage()` → `this.message = ''`, bez ponownego doklejania podpisu.
- `onReplyToMessage()` (l. ~1292) — **bez zmian**. `isSignatureEnabledForInbox` nadal istnieje (steruje podglądem), a wybór `start`/`end` przestaje mieć znaczenie dla pustego pola i pozostaje poprawny, gdy w treści jest cytat.

Zgodnie z regułą projektu „Remove dead/unreachable/unused code" martwe gałęzie usuwamy, a nie zostawiamy zakomentowane.

## Czego ta zmiana NIE robi

- **Nie naprawia dymka wysłanej wiadomości.** W historii rozmowy stopka nadal pokaże się jako źródło HTML, bo `MessageFormatter` tworzy markdown-it z `html: false`. Globalne włączenie `html: true` odpada — przez ten sam formatter przechodzą przychodzące maile od klientów, czyli byłby to wektor XSS. Osobny temat, świadomie poza zakresem.
- **Nie pozwala edytować stopki w pojedynczej wiadomości.** Zostaje przełącznik wł./wył. Przy stopce firmowej to akceptowalny koszt (świadoma decyzja właściciela).
- **Nie zmienia treści wysyłanej wiadomości ani maila.** To jest twarde kryterium akceptacji, nie skutek uboczny.

## Ryzyka

| Ryzyko | Ocena | Reakcja |
|---|---|---|
| `ReplyBox.vue` jest często zmieniany przez upstream | średnie | marker `KLIMABAZAR F-podpis` w każdym miejscu edycji + wpis w `CUSTOMIZATIONS.md` z listą punktów styku |
| Regres: pusta wiadomość przechodzi walidację albo odwrotnie | średnie | `hasMeaningfulEditorContent()` upraszcza się, ale steruje blokadą przycisku Wyślij — do sprawdzenia ręcznie w obu stanach przełącznika |
| Podwójna stopka ze starego drafta | wysokie bez reakcji | decyzja 4 (bezwarunkowe `removeSignature` przy wczytaniu drafta) |
| Kanały bez wsparcia dla podpisu | niskie | warunek doklejania kopiuje dzisiejszy (`sendWithSignature` czyta ustawienie per kanał), więc zachowanie się nie zmienia |

## Kryteria akceptacji

Weryfikacja na lokalnym dev Dockerze (`localhost:3001`), zgodnie z `CLAUDE.local.md`. Projekt mówi „Avoid writing specs unless explicitly asked" → bez specków, weryfikacja manualna.

1. Stopka **nie pojawia się** w polu edycji; pod polem widać ją wyrenderowaną (kolory, logo, pomarańczowa linia).
2. Wysłana wiadomość ma treść **identyczną** z tą sprzed zmiany — porównanie `messages.content` dla tej samej treści wejściowej przed i po.
3. Przełącznik podpisu chowa i pokazuje podgląd; przy wyłączonym podpis nie trafia do wysyłki.
4. Notatka prywatna: brak podglądu i brak doklejania.
5. Draft: wpisanie treści, przejście na inną rozmowę i powrót — treść zachowana, stopka nie zduplikowana.
6. Stary draft z wklejoną stopką (zasymulowany ręcznie w store) po wczytaniu ma czystą treść.
7. Przycisk Wyślij jest zablokowany przy pustym polu mimo włączonego podpisu.
8. Kanał bez wsparcia podpisu — zachowanie bez zmian.

## Pliki

| Plik | Charakter |
|---|---|
| `app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue` | **upstreamowy** — 8 punktów edycji (import, 5 metod, 2 miejsca w szablonie), marker w każdym |
| `app/javascript/dashboard/components/widgets/conversation/SignaturePreview.vue` | nowy, własny |
| `CUSTOMIZATIONS.md` | wpis w rejestrze zmian |
