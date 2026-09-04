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

Nauka tabliczki mnożenia dla dziecka. Jeden ekran, statyczna, bez backendu,
bez logowania. Dziewięć progów trudności — próg to zakres wyniku działania.

### Architektura

```
src/app/
  domain/   czysty TypeScript — model, mastery, scheduler, trudność, sesja
  data/     serializacja, IndexedDB, preferencje
  state/    FactStore — jedyne źródło prawdy o postępach
  game/     ekran ćwiczenia i numpad
```

Jeden ekran, więc bez routera. Nie dokładaj tras ani ekranów bez wyraźnej prośby.

**Twarda zasada: `domain/` nie wie nic o Angularze.** Zero importów z `@angular/*`,
zero DOM, zero I/O, zero `Date.now()` — czas wpływa z zewnątrz jako argument.
`domain/` musi dać się przetestować bez uruchamiania Angulara.

### Zależności

Zero zewnętrznych bibliotek runtime. Bez silnika gry, bez UI kitu, bez Dexie.
RxJS tylko tam, gdzie sygnał naprawdę nie wystarczy.

### Testy

Vitest dla `domain/` i dla czystej serializacji w `data/` — pisane razem z kodem.
Komponentów nie testujemy jednostkowo; od tego jest `npm run check:browser`,
który przechodzi całą ścieżkę w prawdziwym Chrome przez CDP.

```bash
npm run test:domain    # sama domena, ~0,7 s
npm run test:run       # cały zestaw jednostkowy
npm run check:browser  # end-to-end w przeglądarce
```

Po każdej zmianie w `game/` albo `ui/` uruchom `check:browser` — pętla gry
i persystencja nie mają innego zabezpieczenia.

### Dobór pytań — dwie rzeczy, bez których to nie działa

Zestaw roboczy krąży niezależnie od kolejki Leitnera. Poprawna odpowiedź wysyła
działanie do pudełka 2, czyli o dziesięć minut, a sesja trwa kilka minut — bez
zestawu żadne działanie nie zrobiłoby serii dwóch trafień i nigdy nie awansowało.

Karencja pilnuje, żeby pytanie nie wróciło przed upływem kilku innych. Sam zakaz
powtórki „dwa razy pod rząd" za mało rozrzuca pytania i sesja robi się nużąca.
Zestaw roboczy musi być większy od karencji.

### Pułapka układu

Wiersz szerszy od ekranu (np. zawijane chipy) rozpycha siatkę CSS, bo elementy
siatki mają domyślnie `min-width: auto`. Ekran ma `grid-template-columns: minmax(0, 1fr)` —
nie usuwaj tego, bo numpad wyjedzie poza widok.

### Uwaga o npm

Globalny npm 10.7.0 nie potrafi rozwiązać drzewa zależności Vitest 4
(`Cannot read properties of null (reading 'edgesOut')`). Instaluj przez
`npx npm@11 install` albo zaktualizuj globalny npm.
