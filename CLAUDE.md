You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

---

## Zasady tego projektu

Trening matematyczny dla dziecka. Aplikacja statyczna, bez backendu i bez logowania.
Jeden tryb: działania z wybranych kryteriów (zakres liczb od–do wpisywany ręcznie, operacje, liczba składników)
— w grze albo na karcie do druku. Tabliczka mnożenia to po prostu mnożenie w zakresie 1–10.

### Architektura

```
src/app/
  domain/   czysty TypeScript — wyrażenia, generator, punktacja, karta zadań
  state/    sygnałowe stores: ustawienia, przebieg gry, motyw, localStorage
  ui/       klawiatura numeryczna
  setup/    ekran kryteriów
  game/     ekran ćwiczenia i podsumowanie
  sheet/    karta zadań do druku (PDF przez okno drukowania przeglądarki)
```

Trzy ekrany przełączane sygnałem w `App` — bez routera. Nie dokładaj tras ani
ekranów bez wyraźnej prośby.

**Twarda zasada: `domain/` nie wie nic o Angularze.** Zero importów z `@angular/*`,
zero DOM, zero I/O, zero `Math.random()` i `Date.now()` — losowość wchodzi z zewnątrz
jako `Rng`, dzięki czemu testy są deterministyczne (`seeded()`).

### Zależności

Zero zewnętrznych bibliotek runtime. Bez silnika gry, bez UI kitu, bez biblioteki
do matematyki. RxJS tylko tam, gdzie sygnał naprawdę nie wystarczy.

### Generator działań — rzeczy, bez których to nie działa

**Zakres dotyczy liczb, nie wyniku.** Każda liczba w działaniu jest z `min..max` (domyślnie 2–10).
Wynik (także pośredni) jest całkowity, nieujemny i najwyżej `MAX_RESULT` (9999 —
tyle mieści klawiatura). Przy wielu składnikach i małym zakresie część liczb
musi wyjść 1 — `2 × 1 × 4 …` to matematyka, nie błąd. Gdy dolna granica jest wysoka,
niektóre kryteria są niewykonalne (5 mnożeń liczb od 20); `canGenerate` to wykrywa
i ekran ustawień blokuje start z podpowiedzią.

**Dzielenie jest odwrotnością mnożenia.** Dzielnik i iloraz są z zakresu,
dzielna z nich wynika (`56 ÷ 7` przy zakresie 1–10). Dzielenia na początku
łańcucha wchodzą w pierwszą liczbę (`buildProduct`), dalsze dobierają dzielnik
spośród dzielników bieżącego wyniku — każdy wynik pośredni jest całkowity.

**Suma budowana od lewej, z ponawianiem.** Po każdym kroku sprawdzamy, czy wynik
jest w `0..MAX_RESULT`; przy samym odejmowaniu zostawiamy miejsce na kolejne
odjemniki. Generator losuje z ponawianiem (`MAX_ATTEMPTS`), a `fallback` to
ostateczność — test w `generator.spec.ts` pilnuje, że dla żadnej kombinacji
kryteriów nie wychodzi zła liczba składników ani niewybrane działanie.

**Nawias musi mieć gdzie zamieszkać.** `splitTerms` rezerwuje składnik o trzech
liczbach, gdy nawiasy są włączone — bez rezerwacji wypadałyby na tyle rzadko,
że dziecko by ich nie zobaczyło. Przy samym dodawaniu i odejmowaniu nawias ma
sens tylko po minusie: `10 − (3 + 2)`.

**Niewiadoma musi mieć jedno rozwiązanie.** x zastępuje liczbę z zakresu (nigdy dzielną),
a `solvesUniquely` skanuje cały zakres
przed pokazaniem zadania; inaczej dziecko mogłoby podać poprawną odpowiedź
i dostać czerwony ekran.

### Klawiatura

Odpowiedzi wpisuje się wyłącznie własną klawiaturą (`ui/keypad.ts`) — na telefonie
klawiatura systemowa nigdy nie zasłania działania. Nie zamieniaj tego na `<input>`.
Fizyczna klawiatura (cyfry, Backspace, Enter, Escape) jest obsługiwana w `game/play.ts`.

### Testy

Vitest dla `domain/` — pisane razem z kodem. Komponentów nie testujemy jednostkowo;
od tego jest przejście przez aplikację w przeglądarce.

```bash
npm run test:run   # cały zestaw jednostkowy, ~2 s
npm run build      # kompilacja produkcyjna
npm start          # ng serve
```

Po każdej zmianie w `game/`, `setup/` albo `ui/` przejdź ścieżkę w przeglądarce:
ustawienia → gra → odpowiedź poprawna i błędna → podsumowanie, w obu motywach.

### Pułapka układu

Ekran gry to siatka `auto / 1fr / auto` (statystyki, plansza, klawiatura), a `.shell`
ma `grid-template-columns: minmax(0, 1fr)` — elementy siatki mają domyślnie
`min-width: auto`, więc bez tego długie działanie rozpycha stronę w poziomie.

### Uwaga o npm

Globalny npm 10.7.0 nie potrafi rozwiązać drzewa zależności Vitest 4
(`Cannot read properties of null (reading 'edgesOut')`). Instaluj przez
`npx npm@11 install` albo zaktualizuj globalny npm.
